from app.common.analytics import generate_weekly_report as _generate_weekly_report
from app.core.db import AsyncSessionLocal


async def generate_weekly_report() -> dict:
    """Generate a short natural-language report on the last 7 days across
    tasks, planner, finance, learning, and habits — what went well, what
    slipped, and one concrete suggestion.

    Returns:
      {"report": str, "overview": {...aggregate numbers the report is
      grounded in...}}.
    """
    async with AsyncSessionLocal() as db:
        return await _generate_weekly_report(db, days=7)


TOOLS = [generate_weekly_report]
