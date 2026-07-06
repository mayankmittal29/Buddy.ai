from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.db import AsyncSessionLocal
from app.core.models import Notification, NotificationPreferences

router = APIRouter()

PREFS_ID = 1


class NotificationPreferencesData(BaseModel):
    email_address: str = ""
    channels: dict[str, bool] = {"email": False}


@router.get("/api/notification-preferences", response_model=NotificationPreferencesData)
async def get_notification_preferences() -> NotificationPreferencesData:
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        if prefs is None:
            return NotificationPreferencesData()
        return NotificationPreferencesData.model_validate(prefs, from_attributes=True)


@router.put("/api/notification-preferences", response_model=NotificationPreferencesData)
async def update_notification_preferences(
    data: NotificationPreferencesData,
) -> NotificationPreferencesData:
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        if prefs is None:
            prefs = NotificationPreferences(id=PREFS_ID, **data.model_dump())
            db.add(prefs)
        else:
            for field, value in data.model_dump().items():
                setattr(prefs, field, value)
        await db.commit()
        await db.refresh(prefs)
        return NotificationPreferencesData.model_validate(prefs, from_attributes=True)


# ---------------------------------------------------------------------------
# Notification feed
# ---------------------------------------------------------------------------


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str
    source_skill: str | None
    source_id: int | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationUpdate(BaseModel):
    read: bool


@router.get("/api/notifications", response_model=list[NotificationOut])
async def list_notifications(days: int | None = None) -> list[Notification]:
    """All notifications, newest first. Pass ?days=N to only return ones
    created in the last N days — search and any other filtering happens
    client-side (same pattern as the Tasks list)."""
    async with AsyncSessionLocal() as db:
        stmt = select(Notification).order_by(Notification.created_at.desc())
        if days is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            stmt = stmt.where(Notification.created_at >= cutoff)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.get("/api/notifications/unread-count")
async def unread_notification_count() -> dict:
    async with AsyncSessionLocal() as db:
        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.read.is_(False))
        )
        result = await db.execute(stmt)
        return {"count": result.scalar_one()}


@router.patch("/api/notifications/{notification_id}", response_model=NotificationOut)
async def update_notification(
    notification_id: int, data: NotificationUpdate
) -> Notification:
    async with AsyncSessionLocal() as db:
        notification = await db.get(Notification, notification_id)
        if notification is None:
            raise HTTPException(
                status_code=404, detail=f"notification {notification_id} not found"
            )
        notification.read = data.read
        await db.commit()
        await db.refresh(notification)
        return notification
