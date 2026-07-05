from fastapi import APIRouter
from pydantic import BaseModel

from app.core.db import AsyncSessionLocal
from app.core.models import UserProfile

router = APIRouter()

PROFILE_ID = 1


class ProfileData(BaseModel):
    name: str = ""
    timezone: str = "UTC"
    wake_time: str = "07:00"
    sleep_time: str = "23:00"
    meal_times: dict[str, str] = {}
    work_start: str = "09:00"
    work_end: str = "17:00"


@router.get("/api/profile", response_model=ProfileData)
async def get_profile() -> ProfileData:
    async with AsyncSessionLocal() as db:
        profile = await db.get(UserProfile, PROFILE_ID)
        if profile is None:
            return ProfileData()
        return ProfileData.model_validate(profile, from_attributes=True)


@router.put("/api/profile", response_model=ProfileData)
async def update_profile(data: ProfileData) -> ProfileData:
    async with AsyncSessionLocal() as db:
        profile = await db.get(UserProfile, PROFILE_ID)
        if profile is None:
            profile = UserProfile(id=PROFILE_ID, **data.model_dump())
            db.add(profile)
        else:
            for field, value in data.model_dump().items():
                setattr(profile, field, value)
        await db.commit()
        await db.refresh(profile)
        return ProfileData.model_validate(profile, from_attributes=True)
