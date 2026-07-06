from fastapi import APIRouter

from app.common.analytics import generate_weekly_report, get_analytics_overview
from app.core.db import AsyncSessionLocal

router = APIRouter(prefix="/api/analytics")

RANGE_DAYS = {"week": 7, "month": 30}


@router.get("/overview")
async def analytics_overview(range: str = "week") -> dict:
    days = RANGE_DAYS.get(range, 7)
    async with AsyncSessionLocal() as db:
        return await get_analytics_overview(db, days)


@router.post("/weekly-report")
async def weekly_report(range: str = "week") -> dict:
    days = RANGE_DAYS.get(range, 7)
    async with AsyncSessionLocal() as db:
        return await generate_weekly_report(db, days)
