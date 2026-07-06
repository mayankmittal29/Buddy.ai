"""Cross-skill analytics — straightforward SQL aggregate queries, one
function per domain, combined into a single overview by
get_analytics_overview(). Built last since it depends on every other skill
having real data to aggregate; read-only except for generate_weekly_report's
model call, which writes nothing to the database either.
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.finance import get_expense_summary
from app.common.habits import get_habit_streaks
from app.core.model_router import complete_with_fallback
from app.core.models import (
    Budget,
    Course,
    CourseStatus,
    Habit,
    JobApplication,
    JobApplicationStatus,
    PlannerItem,
    PlannerStatus,
    Task,
    TaskStatus,
)

REPORT_SKILL_ID = "analytics"


async def get_task_completion_rate(db: AsyncSession, days: int) -> dict:
    """Of tasks created in the last `days` days, what fraction are done."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(Task.status, func.count())
        .where(Task.created_at >= cutoff)
        .group_by(Task.status)
    )
    result = await db.execute(stmt)
    counts = {status.value: count for status, count in result.all()}
    done = counts.get(TaskStatus.done.value, 0)
    total = sum(counts.values())
    return {
        "days": days,
        "total": total,
        "done": done,
        "completion_rate": round(done / total * 100, 1) if total else 0.0,
    }


async def get_planner_adherence(db: AsyncSession, days: int) -> dict:
    """Of planner items created in the last `days` days, planned vs completed."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(PlannerItem.status, func.count())
        .where(PlannerItem.created_at >= cutoff)
        .group_by(PlannerItem.status)
    )
    result = await db.execute(stmt)
    counts = {status.value: count for status, count in result.all()}
    completed = counts.get(PlannerStatus.done.value, 0)
    planned = sum(counts.values())
    return {
        "days": days,
        "planned": planned,
        "completed": completed,
        "adherence_rate": round(completed / planned * 100, 1) if planned else 0.0,
    }


async def get_finance_summary(db: AsyncSession) -> dict:
    """This month's spend vs total budgeted, across all categories — reuses
    the Finance skill's own summary logic (app/common/finance.py) so the
    numbers can never disagree with the Finance page itself."""
    summary = await get_expense_summary(db, None)
    total_budget_stmt = select(func.coalesce(func.sum(Budget.monthly_limit), 0.0))
    total_budget = (await db.execute(total_budget_stmt)).scalar_one()
    return {
        "month": summary["month"],
        "spend": summary["total"],
        "budget": float(total_budget),
        "pct_used": (
            round(summary["total"] / total_budget * 100, 1) if total_budget else None
        ),
        "by_category": summary["by_category"],
    }


async def get_learning_progress(db: AsyncSession) -> dict:
    """Courses by status, all-time — done vs in-progress vs planned."""
    stmt = select(Course.status, func.count()).group_by(Course.status)
    result = await db.execute(stmt)
    counts = {status.value: count for status, count in result.all()}
    done = counts.get(CourseStatus.done.value, 0)
    total = sum(counts.values())
    return {
        "total": total,
        "done": done,
        "in_progress": counts.get(CourseStatus.in_progress.value, 0),
        "planned": counts.get(CourseStatus.planned.value, 0),
        "completion_rate": round(done / total * 100, 1) if total else 0.0,
    }


async def get_habit_streaks_summary(db: AsyncSession) -> dict:
    """Aggregate current-streak stats across all tracked habits."""
    habits = (await db.execute(select(Habit))).scalars().all()
    if not habits:
        return {
            "total_habits": 0,
            "avg_current_streak": 0.0,
            "longest_current_streak": 0,
            "done_today": 0,
        }

    today = date.today()
    streaks = []
    done_today = 0
    for habit in habits:
        current, _longest = await get_habit_streaks(db, habit.id)
        streaks.append(current)
        if habit.last_done == today:
            done_today += 1

    return {
        "total_habits": len(habits),
        "avg_current_streak": round(sum(streaks) / len(streaks), 1),
        "longest_current_streak": max(streaks),
        "done_today": done_today,
    }


async def get_career_pipeline_summary(db: AsyncSession) -> dict:
    """All-time job application counts by status — the full pipeline from
    "just found" through offer/rejected/withdrawn."""
    stmt = select(JobApplication.status, func.count()).group_by(JobApplication.status)
    result = await db.execute(stmt)
    counts = {status.value: count for status, count in result.all()}
    by_status = {
        status.value: counts.get(status.value, 0) for status in JobApplicationStatus
    }
    total = sum(by_status.values())
    return {
        "total": total,
        "by_status": by_status,
        "offer_rate": round(by_status["offer"] / total * 100, 1) if total else 0.0,
    }


async def get_analytics_overview(db: AsyncSession, days: int = 7) -> dict:
    return {
        "range_days": days,
        "productivity": await get_task_completion_rate(db, days),
        "goals": await get_planner_adherence(db, days),
        "finance": await get_finance_summary(db),
        "learning": await get_learning_progress(db),
        "habits": await get_habit_streaks_summary(db),
        "career": await get_career_pipeline_summary(db),
    }


async def generate_weekly_report(db: AsyncSession, days: int = 7) -> dict:
    """A short natural-language report (what went well, what slipped, one
    suggestion) grounded strictly in the aggregate numbers below — never
    invents figures, and skips the model call entirely when there's
    genuinely no activity yet (avoids the same fabricated-numbers failure
    mode seen with an all-zero Finance insights prompt)."""
    overview = await get_analytics_overview(db, days)

    has_data = any(
        [
            overview["productivity"]["total"],
            overview["goals"]["planned"],
            overview["finance"]["spend"],
            overview["learning"]["total"],
            overview["habits"]["total_habits"],
            overview["career"]["total"],
        ]
    )
    if not has_data:
        return {
            "report": "Not enough activity yet to generate a report.",
            "overview": overview,
        }

    prompt = (
        "You are a terse personal-productivity coach. Below is REAL aggregate data across the "
        "user's tasks, planner, finance, learning, and habits — the only numbers that exist. Do "
        "not invent, assume, or reference any number not listed here. Write a short report (3-5 "
        "sentences, no markdown) covering: what went well, what slipped, and one concrete "
        "suggestion.\n\n"
        f"{overview}"
    )
    report = await complete_with_fallback(
        REPORT_SKILL_ID, [{"role": "user", "content": prompt}]
    )
    if not report:
        report = (
            f"Tasks: {overview['productivity']['done']}/{overview['productivity']['total']} done. "
            f"Goals: {overview['goals']['completed']}/{overview['goals']['planned']} completed. "
            f"Finance: spent {overview['finance']['spend']} of {overview['finance']['budget']} budgeted. "
            f"Learning: {overview['learning']['done']}/{overview['learning']['total']} courses done. "
            f"Habits: {overview['habits']['done_today']}/{overview['habits']['total_habits']} done today. "
            f"Career: {overview['career']['total']} applications tracked, "
            f"{overview['career']['by_status']['offer']} offer(s)."
        )
    return {"report": report, "overview": overview}
