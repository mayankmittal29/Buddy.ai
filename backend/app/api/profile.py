import asyncio

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.models import UserProfile

router = APIRouter()

PROFILE_ID = 1

settings = get_settings()

if settings.cloudinary_cloud_name:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


class ProfileData(BaseModel):
    name: str = ""
    avatar_url: str = ""
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


@router.post("/api/profile/avatar", response_model=ProfileData)
async def upload_avatar(file: UploadFile = File(...)) -> ProfileData:
    """Upload a profile picture to Cloudinary and store its URL.

    Only the resulting secure_url is persisted in Postgres — the image
    itself lives in Cloudinary.
    """
    if not settings.cloudinary_cloud_name:
        raise HTTPException(
            status_code=503,
            detail="Image storage isn't configured (missing Cloudinary credentials).",
        )

    contents = await file.read()
    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            contents,
            folder="buddy/avatars",
            resource_type="image",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upload failed: {exc}") from exc

    avatar_url = result["secure_url"]

    async with AsyncSessionLocal() as db:
        profile = await db.get(UserProfile, PROFILE_ID)
        if profile is None:
            profile = UserProfile(id=PROFILE_ID, avatar_url=avatar_url)
            db.add(profile)
        else:
            profile.avatar_url = avatar_url
        await db.commit()
        await db.refresh(profile)
        return ProfileData.model_validate(profile, from_attributes=True)
