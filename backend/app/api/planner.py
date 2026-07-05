from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.models import PlannerItem, PlannerMode, PlannerStatus, UserProfile
from app.skills.planner.tools import compute_daily_schedule

router = APIRouter()


class PlannerItemCreate(BaseModel):
    mode: PlannerMode
    title: str
    details: str | None = None
    hours_needed: float | None = None
    deadline: date | None = None
    status: PlannerStatus = PlannerStatus.pending


class PlannerItemUpdate(BaseModel):
    title: str | None = None
    details: str | None = None
    hours_needed: float | None = None
    deadline: date | None = None
    status: PlannerStatus | None = None


class PlannerItemOut(BaseModel):
    id: int
    mode: PlannerMode
    title: str
    details: str | None
    hours_needed: float | None
    deadline: date | None
    status: PlannerStatus
    created_at: datetime

    model_config = {"from_attributes": True}


async def _today_bounds_utc() -> tuple[datetime, datetime]:
    """Return (start-of-today, start-of-tomorrow) in UTC, per the user's
    profile timezone — so "today" lines up with their actual local day."""
    async with AsyncSessionLocal() as db:
        profile = await db.get(UserProfile, 1)
    tz_name = profile.timezone if profile and profile.timezone else "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    now_local = datetime.now(tz)
    today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start_local = today_start_local + timedelta(days=1)
    return (
        today_start_local.astimezone(timezone.utc),
        tomorrow_start_local.astimezone(timezone.utc),
    )


@router.get("/api/planner", response_model=list[PlannerItemOut])
async def list_planner_items_endpoint(
    mode: PlannerMode | None = None, status: PlannerStatus | None = None
) -> list[PlannerItem]:
    async with AsyncSessionLocal() as db:
        stmt = select(PlannerItem).order_by(PlannerItem.created_at.asc())
        if mode is not None:
            stmt = stmt.where(PlannerItem.mode == mode)
        if status is not None:
            stmt = stmt.where(PlannerItem.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/api/planner", response_model=PlannerItemOut, status_code=201)
async def create_planner_item(data: PlannerItemCreate) -> PlannerItem:
    async with AsyncSessionLocal() as db:
        item = PlannerItem(**data.model_dump())
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item


@router.get("/api/planner/daily-schedule")
async def get_daily_schedule() -> dict:
    return await compute_daily_schedule()


@router.get("/api/planner/export")
async def export_planner_pdf(mode: PlannerMode = Query(...)) -> StreamingResponse:
    async with AsyncSessionLocal() as db:
        stmt = (
            select(PlannerItem)
            .where(PlannerItem.mode == mode)
            .order_by(PlannerItem.created_at.asc())
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, title=f"{mode.value.capitalize()} Plan")
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"{mode.value.capitalize()} Plan", styles["Title"]), Spacer(1, 12)]

    table_data = [["Task", "Hours", "Deadline", "Status"]]
    for item in items:
        table_data.append(
            [
                item.title,
                f"{item.hours_needed:g}" if item.hours_needed is not None else "—",
                item.deadline.isoformat() if item.deadline else "—",
                item.status.value.capitalize(),
            ]
        )

    table = Table(table_data, colWidths=[3 * inch, 0.9 * inch, 1.2 * inch, 1 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F6FA")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    buffer.seek(0)

    filename = f"{mode.value}-plan.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/planner/morning-briefing")
async def morning_briefing() -> dict:
    """All pending items created before today, grouped by mode — a recap of
    what's still outstanding from earlier."""
    today_start_utc, _ = await _today_bounds_utc()
    async with AsyncSessionLocal() as db:
        stmt = (
            select(PlannerItem)
            .where(PlannerItem.status == PlannerStatus.pending)
            .where(PlannerItem.created_at < today_start_utc)
            .order_by(PlannerItem.created_at.asc())
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

    grouped: dict[str, list[dict]] = {"daily": [], "weekly": [], "monthly": []}
    for item in items:
        grouped[item.mode.value].append(
            PlannerItemOut.model_validate(item).model_dump(mode="json")
        )
    return grouped


@router.get("/api/planner/evening-review")
async def evening_review() -> dict:
    """Today's items (created today), split into completed vs pending."""
    today_start_utc, tomorrow_start_utc = await _today_bounds_utc()
    async with AsyncSessionLocal() as db:
        stmt = (
            select(PlannerItem)
            .where(PlannerItem.created_at >= today_start_utc)
            .where(PlannerItem.created_at < tomorrow_start_utc)
            .order_by(PlannerItem.created_at.asc())
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

    completed = [
        PlannerItemOut.model_validate(i).model_dump(mode="json")
        for i in items
        if i.status == PlannerStatus.done
    ]
    pending = [
        PlannerItemOut.model_validate(i).model_dump(mode="json")
        for i in items
        if i.status == PlannerStatus.pending
    ]
    return {"completed": completed, "pending": pending}


@router.patch("/api/planner/{item_id}", response_model=PlannerItemOut)
async def update_planner_item(item_id: int, data: PlannerItemUpdate) -> PlannerItem:
    async with AsyncSessionLocal() as db:
        item = await db.get(PlannerItem, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"planner item {item_id} not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        await db.commit()
        await db.refresh(item)
        return item


@router.delete("/api/planner/{item_id}", status_code=204)
async def delete_planner_item(item_id: int) -> None:
    async with AsyncSessionLocal() as db:
        item = await db.get(PlannerItem, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"planner item {item_id} not found")
        await db.delete(item)
        await db.commit()
