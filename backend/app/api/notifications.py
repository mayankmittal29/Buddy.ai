from fastapi import APIRouter
from pydantic import BaseModel

from app.core.db import AsyncSessionLocal
from app.core.models import NotificationPreferences

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
