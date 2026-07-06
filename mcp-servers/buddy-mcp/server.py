"""buddy-mcp — a custom MCP server exposing Buddy's finance tools.

Runs as a standalone process (stdio transport) and talks directly to the
same Postgres database as the main FastAPI backend, reusing its SQLAlchemy
models and business logic (app.common.finance) rather than re-implementing
it — the backend directory is added to sys.path below so `import app...`
resolves to backend/app, exactly like the FastAPI process itself.

Run standalone for local testing:
    python server.py
(it will sit waiting for MCP stdio messages — see README.md for how to poke
it with the `mcp` CLI's dev inspector). In normal operation it is instead
spawned automatically as a subprocess by the Finance skill's ADK agent
(see backend/app/skills/finance/tools.py), which speaks MCP to it over
stdio — nothing needs to be started by hand for the app to work.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from mcp.server.fastmcp import FastMCP  # noqa: E402

from app.common.finance import (  # noqa: E402
    add_expense as _add_expense,
    add_subscription as _add_subscription,
    check_budget_status as _check_budget_status,
    get_expense_summary as _get_expense_summary,
    get_monthly_insights as _get_monthly_insights,
    get_savings_progress as _get_savings_progress,
)
from app.core.db import AsyncSessionLocal  # noqa: E402
from app.core.models import BillingCycle  # noqa: E402

mcp = FastMCP("buddy-finance")


@mcp.tool()
async def add_expense(amount: float, category: str, note: str = "") -> dict:
    """Log a new expense spent today.

    Args:
      amount: How much was spent, in the user's currency (a positive number).
      category: Spending category, e.g. "food", "transport", "rent".
      note: Optional short note about the expense.

    Returns:
      The created expense: id, amount, category, note, spent_at.
    """
    async with AsyncSessionLocal() as db:
        expense = await _add_expense(db, amount, category, note or None)
        await db.commit()
        return {
            "id": expense.id,
            "amount": expense.amount,
            "category": expense.category,
            "note": expense.note,
            "spent_at": expense.spent_at.isoformat(),
        }


@mcp.tool()
async def get_expense_summary(month: str = "") -> dict:
    """Get total spend and a per-category breakdown for a month.

    Args:
      month: Month to summarize, as "YYYY-MM". Empty string means the
        current month.

    Returns:
      {month, total, by_category: {category: amount}}.
    """
    async with AsyncSessionLocal() as db:
        return await _get_expense_summary(db, month or None)


@mcp.tool()
async def check_budget_status(category: str) -> dict:
    """Check this month's spend in a category against its budget.

    Args:
      category: The spending category to check, e.g. "dining".

    Returns:
      {category, monthly_limit, spent, remaining, pct_used, over_budget}.
      monthly_limit/remaining/pct_used are null if no budget is set for
      this category yet.
    """
    async with AsyncSessionLocal() as db:
        return await _check_budget_status(db, category)


@mcp.tool()
async def add_subscription(name: str, amount: float, cycle: str) -> dict:
    """Add a recurring subscription.

    Args:
      name: Subscription name, e.g. "Netflix".
      amount: Amount charged each cycle.
      cycle: Billing cycle — one of "weekly", "monthly", "yearly".

    Returns:
      The created subscription, with its computed next_charge_at, or an
      {"error": ...} dict if `cycle` isn't one of the three valid values.
    """
    try:
        billing_cycle = BillingCycle(cycle.lower())
    except ValueError:
        return {"error": f"invalid cycle {cycle!r} — must be weekly, monthly, or yearly"}
    async with AsyncSessionLocal() as db:
        subscription = await _add_subscription(db, name, amount, billing_cycle)
        await db.commit()
        return {
            "id": subscription.id,
            "name": subscription.name,
            "amount": subscription.amount,
            "billing_cycle": subscription.billing_cycle.value,
            "next_charge_at": subscription.next_charge_at.isoformat(),
        }


@mcp.tool()
async def get_savings_progress(goal_id: int) -> dict:
    """Get progress toward a savings goal.

    Args:
      goal_id: id of the savings goal.

    Returns:
      {id, title, target_amount, current_amount, target_date, pct_complete},
      or an {"error": ...} dict if the goal doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        progress = await _get_savings_progress(db, goal_id)
        if progress is None:
            return {"error": f"savings goal {goal_id} not found"}
        return progress


@mcp.tool()
async def get_monthly_insights() -> dict:
    """Summarize this month's finances: total spend, top 3 categories,
    budget overruns, and a short natural-language insight.

    Returns:
      {month, total_spend, top_categories, budget_overruns, insight}.
    """
    async with AsyncSessionLocal() as db:
        return await _get_monthly_insights(db)


if __name__ == "__main__":
    mcp.run(transport="stdio")
