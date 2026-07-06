"""Shared finance business logic — used by both the REST API (app/api/finance.py,
in-process) and the standalone buddy-mcp server (mcp-servers/buddy-mcp/server.py,
a separate process that imports this same module) so the two never drift
apart on how a summary/budget-status/insight number is actually computed.
"""

import calendar
from datetime import date, timedelta

from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.gemini_client import get_gemini_client
from app.core.models import BillingCycle, Budget, Expense, SavingsGoal, Subscription

INSIGHTS_MODEL = "gemini-2.5-flash"


def _month_bounds(month: str | None) -> tuple[str, date, date]:
    """`month` as "YYYY-MM", defaulting to the current month. Returns
    (normalized "YYYY-MM", first day, first day of the next month)."""
    if month:
        year, mon = (int(p) for p in month.split("-"))
    else:
        today = date.today()
        year, mon = today.year, today.month
    start = date(year, mon, 1)
    next_month = mon + 1
    next_year = year + (1 if next_month > 12 else 0)
    next_month = next_month if next_month <= 12 else 1
    end = date(next_year, next_month, 1)
    return f"{year:04d}-{mon:02d}", start, end


def _add_cycle(d: date, cycle: BillingCycle) -> date:
    if cycle == BillingCycle.weekly:
        return d + timedelta(days=7)
    if cycle == BillingCycle.yearly:
        return d.replace(year=d.year + 1)
    month = d.month + 1
    year = d.year + (1 if month > 12 else 0)
    month = month if month <= 12 else 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


async def add_expense(
    db: AsyncSession,
    amount: float,
    category: str,
    note: str | None = None,
    spent_at: date | None = None,
) -> Expense:
    expense = Expense(
        amount=amount, category=category, note=note, spent_at=spent_at or date.today()
    )
    db.add(expense)
    await db.flush()
    return expense


async def add_subscription(
    db: AsyncSession,
    name: str,
    amount: float,
    billing_cycle: BillingCycle,
    next_charge_at: date | None = None,
) -> Subscription:
    subscription = Subscription(
        name=name,
        amount=amount,
        billing_cycle=billing_cycle,
        next_charge_at=next_charge_at or _add_cycle(date.today(), billing_cycle),
    )
    db.add(subscription)
    await db.flush()
    return subscription


async def get_expense_summary(db: AsyncSession, month: str | None = None) -> dict:
    """Total spend and per-category breakdown for a given month ("YYYY-MM",
    defaults to the current month)."""
    normalized, start, end = _month_bounds(month)
    stmt = (
        select(Expense.category, func.sum(Expense.amount))
        .where(Expense.spent_at >= start, Expense.spent_at < end)
        .group_by(Expense.category)
    )
    result = await db.execute(stmt)
    by_category = {category: float(total) for category, total in result.all()}
    return {
        "month": normalized,
        "total": round(sum(by_category.values()), 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
    }


async def check_budget_status(db: AsyncSession, category: str) -> dict:
    """How this month's spend in `category` compares to its budget, if any."""
    budget_stmt = select(Budget).where(func.lower(Budget.category) == category.lower())
    budget = (await db.execute(budget_stmt)).scalar_one_or_none()

    _, start, end = _month_bounds(None)
    spent_stmt = select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
        func.lower(Expense.category) == category.lower(),
        Expense.spent_at >= start,
        Expense.spent_at < end,
    )
    spent = float((await db.execute(spent_stmt)).scalar_one())

    monthly_limit = budget.monthly_limit if budget else None
    return {
        "category": category,
        "monthly_limit": monthly_limit,
        "spent": round(spent, 2),
        "remaining": (
            round(monthly_limit - spent, 2) if monthly_limit is not None else None
        ),
        "pct_used": round(spent / monthly_limit * 100, 1) if monthly_limit else None,
        "over_budget": monthly_limit is not None and spent > monthly_limit,
    }


async def get_savings_progress(db: AsyncSession, goal_id: int) -> dict | None:
    goal = await db.get(SavingsGoal, goal_id)
    if goal is None:
        return None
    pct = (
        (goal.current_amount / goal.target_amount * 100) if goal.target_amount else 0.0
    )
    return {
        "id": goal.id,
        "title": goal.title,
        "target_amount": goal.target_amount,
        "current_amount": goal.current_amount,
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "pct_complete": round(pct, 1),
    }


async def get_monthly_insights(db: AsyncSession) -> dict:
    """Total spend, top 3 categories, budget overruns for the current month,
    plus a short natural-language insight generated by Gemini from those
    aggregated numbers (no raw expense rows are sent to the model)."""
    summary = await get_expense_summary(db, None)
    top_categories = sorted(
        summary["by_category"].items(), key=lambda kv: kv[1], reverse=True
    )[:3]

    budgets = (await db.execute(select(Budget))).scalars().all()
    overruns = []
    for budget in budgets:
        status = await check_budget_status(db, budget.category)
        if status["over_budget"]:
            overruns.append(
                {
                    "category": budget.category,
                    "spent": status["spent"],
                    "monthly_limit": status["monthly_limit"],
                    "over_by": round(status["spent"] - status["monthly_limit"], 2),
                }
            )

    insight = ""
    if summary["total"] > 0:
        # Only bother calling the model when there's actually something to
        # summarize — also sidesteps a real failure mode seen in testing:
        # a fast model asked to riff on "e.g. dining is over budget"-style
        # phrasing will sometimes invent a plausible-looking example scenario
        # instead of using the real (possibly all-zero) numbers below.
        prompt = (
            "You are a terse personal-finance assistant. Below is this month's "
            "REAL aggregated spending data — the only numbers that exist. Do not "
            "invent, assume, or reference any category or amount that is not "
            "listed here. Write ONE short, plain-language sentence (max ~25 words, "
            "no markdown) using ONLY these numbers, highlighting the most useful "
            "thing to notice (an overrun if any, else the dominant category).\n\n"
            f"Total spend: {summary['total']}\n"
            f"Top categories: {top_categories}\n"
            f"Budget overruns: {overruns}"
        )
        try:
            response = await get_gemini_client().aio.models.generate_content(
                model=INSIGHTS_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=200,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            insight = (response.text or "").strip()
        except Exception:
            insight = ""
    if not insight:
        insight = (
            f"You've spent {summary['total']} so far this month across "
            f"{len(summary['by_category'])} categories."
            if summary["total"] > 0
            else "No expenses logged yet this month."
        )

    return {
        "month": summary["month"],
        "total_spend": summary["total"],
        "top_categories": [{"category": c, "amount": a} for c, a in top_categories],
        "budget_overruns": overruns,
        "insight": insight,
    }
