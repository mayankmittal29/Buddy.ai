import asyncio
from datetime import date, datetime, timedelta

import cloudinary.uploader
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select

from app.common.cloudinary_client import ensure_cloudinary_configured
from app.core.db import AsyncSessionLocal
from app.core.models import (
    Certification,
    CertificationStatus,
    Course,
    CourseStatus,
    RevisionItem,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------


class CourseCreate(BaseModel):
    title: str
    provider: str | None = None
    deadline: date | None = None
    status: CourseStatus = CourseStatus.planned


class CourseUpdate(BaseModel):
    title: str | None = None
    provider: str | None = None
    deadline: date | None = None
    status: CourseStatus | None = None


class CourseOut(BaseModel):
    id: int
    title: str
    provider: str | None
    status: CourseStatus
    deadline: date | None
    roadmap_position: int | None
    roadmap_rationale: str | None
    last_updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/learning/courses", response_model=list[CourseOut])
async def list_courses(status: CourseStatus | None = None) -> list[Course]:
    async with AsyncSessionLocal() as db:
        stmt = select(Course).order_by(
            Course.roadmap_position.asc().nulls_last(), Course.created_at.asc()
        )
        if status is not None:
            stmt = stmt.where(Course.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/api/learning/courses", response_model=CourseOut, status_code=201)
async def create_course(data: CourseCreate) -> Course:
    async with AsyncSessionLocal() as db:
        course = Course(**data.model_dump())
        db.add(course)
        await db.commit()
        await db.refresh(course)
        return course


@router.patch("/api/learning/courses/{course_id}", response_model=CourseOut)
async def update_course(course_id: int, data: CourseUpdate) -> Course:
    async with AsyncSessionLocal() as db:
        course = await db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail=f"course {course_id} not found")
        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(course, field, value)
        # Any real edit "touches" the row — reset the nudge dedup flags so
        # future inactivity/deadline checks can fire again from this point.
        if updates:
            course.inactivity_nudge_sent = False
            if "deadline" in updates:
                course.deadline_reminder_sent = False
        await db.commit()
        await db.refresh(course)
        return course


@router.delete("/api/learning/courses/{course_id}", status_code=204)
async def delete_course(course_id: int) -> None:
    async with AsyncSessionLocal() as db:
        course = await db.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail=f"course {course_id} not found")
        await db.delete(course)
        await db.commit()


# ---------------------------------------------------------------------------
# Certifications
# ---------------------------------------------------------------------------


class CertificationCreate(BaseModel):
    title: str
    issuer: str | None = None
    date_received: date | None = None
    status: CertificationStatus = CertificationStatus.pending
    credential_id: str | None = None
    credential_url: str | None = None
    tags: list[str] | None = None


class CertificationUpdate(BaseModel):
    title: str | None = None
    issuer: str | None = None
    date_received: date | None = None
    status: CertificationStatus | None = None
    credential_id: str | None = None
    credential_url: str | None = None
    tags: list[str] | None = None


class CertificationOut(BaseModel):
    id: int
    title: str
    issuer: str | None
    date_received: date | None
    status: CertificationStatus
    credential_id: str | None
    credential_url: str | None
    tags: list[str] | None
    file_url: str | None
    file_type: str | None
    last_updated_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/learning/certifications", response_model=list[CertificationOut])
async def list_certifications(status: CertificationStatus | None = None) -> list[Certification]:
    async with AsyncSessionLocal() as db:
        stmt = select(Certification).order_by(Certification.created_at.asc())
        if status is not None:
            stmt = stmt.where(Certification.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/api/learning/certifications", response_model=CertificationOut, status_code=201)
async def create_certification(data: CertificationCreate) -> Certification:
    async with AsyncSessionLocal() as db:
        cert = Certification(**data.model_dump())
        db.add(cert)
        await db.commit()
        await db.refresh(cert)
        return cert


@router.patch("/api/learning/certifications/{cert_id}", response_model=CertificationOut)
async def update_certification(cert_id: int, data: CertificationUpdate) -> Certification:
    async with AsyncSessionLocal() as db:
        cert = await db.get(Certification, cert_id)
        if cert is None:
            raise HTTPException(status_code=404, detail=f"certification {cert_id} not found")
        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(cert, field, value)
        if updates:
            cert.inactivity_nudge_sent = False
        await db.commit()
        await db.refresh(cert)
        return cert


@router.delete("/api/learning/certifications/{cert_id}", status_code=204)
async def delete_certification(cert_id: int) -> None:
    async with AsyncSessionLocal() as db:
        cert = await db.get(Certification, cert_id)
        if cert is None:
            raise HTTPException(status_code=404, detail=f"certification {cert_id} not found")

        if cert.storage_key:
            try:
                await asyncio.to_thread(
                    cloudinary.uploader.destroy,
                    cert.storage_key,
                    resource_type=cert.storage_resource_type or "image",
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502, detail=f"Couldn't delete the stored file: {exc}"
                ) from exc

        await db.delete(cert)
        await db.commit()


@router.post("/api/learning/certifications/{cert_id}/file", response_model=CertificationOut)
async def upload_certification_file(cert_id: int, file: UploadFile = File(...)) -> Certification:
    """Upload a certificate image/PDF to Cloudinary and store its URL.

    Only the resulting secure_url (and a coarse "image"/"pdf" type, for the
    frontend to pick a preview widget) is persisted — the file itself lives
    in Cloudinary.
    """
    if not ensure_cloudinary_configured():
        raise HTTPException(
            status_code=503,
            detail="File storage isn't configured (missing Cloudinary credentials).",
        )

    async with AsyncSessionLocal() as db:
        cert = await db.get(Certification, cert_id)
        if cert is None:
            raise HTTPException(status_code=404, detail=f"certification {cert_id} not found")
        old_storage_key = cert.storage_key
        old_storage_resource_type = cert.storage_resource_type

    content_type = file.content_type or ""
    is_pdf = content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf")
    file_type = "pdf" if is_pdf else "image"

    contents = await file.read()
    try:
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            contents,
            folder="buddy/certifications",
            resource_type="auto",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upload failed: {exc}") from exc

    file_url = result["secure_url"]
    storage_key = result["public_id"]
    storage_resource_type = result["resource_type"]

    # Replacing a previously-uploaded file — clean up the old one so it
    # doesn't linger in Cloudinary as an orphan.
    if old_storage_key:
        try:
            await asyncio.to_thread(
                cloudinary.uploader.destroy,
                old_storage_key,
                resource_type=old_storage_resource_type or "image",
            )
        except Exception:
            pass

    async with AsyncSessionLocal() as db:
        cert = await db.get(Certification, cert_id)
        if cert is None:
            raise HTTPException(status_code=404, detail=f"certification {cert_id} not found")
        cert.file_url = file_url
        cert.file_type = file_type
        cert.storage_key = storage_key
        cert.storage_resource_type = storage_resource_type
        cert.inactivity_nudge_sent = False
        await db.commit()
        await db.refresh(cert)
        return cert


# ---------------------------------------------------------------------------
# Revision items
# ---------------------------------------------------------------------------


class RevisionItemCreate(BaseModel):
    topic: str
    notes: str | None = None
    interval_days: int = 1
    # Defaults to today if not given, so a freshly-added topic is due right away.
    next_review_at: date | None = None


class RevisionItemUpdate(BaseModel):
    topic: str | None = None
    notes: str | None = None
    interval_days: int | None = None
    next_review_at: date | None = None


class RevisionItemOut(BaseModel):
    id: int
    topic: str
    notes: str | None
    next_review_at: date
    interval_days: int
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/learning/revision-items", response_model=list[RevisionItemOut])
async def list_revision_items(due: str | None = None) -> list[RevisionItem]:
    """List revision topics. Pass due=today to filter to only what's due
    (next_review_at <= today)."""
    async with AsyncSessionLocal() as db:
        stmt = select(RevisionItem).order_by(RevisionItem.next_review_at.asc())
        if due == "today":
            stmt = stmt.where(RevisionItem.next_review_at <= date.today())
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/api/learning/revision-items", response_model=RevisionItemOut, status_code=201)
async def create_revision_item(data: RevisionItemCreate) -> RevisionItem:
    async with AsyncSessionLocal() as db:
        item = RevisionItem(
            topic=data.topic,
            notes=data.notes,
            interval_days=data.interval_days,
            next_review_at=data.next_review_at or date.today(),
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item


@router.patch("/api/learning/revision-items/{item_id}", response_model=RevisionItemOut)
async def update_revision_item(item_id: int, data: RevisionItemUpdate) -> RevisionItem:
    async with AsyncSessionLocal() as db:
        item = await db.get(RevisionItem, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"revision item {item_id} not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        await db.commit()
        await db.refresh(item)
        return item


@router.post("/api/learning/revision-items/{item_id}/mark-revised", response_model=RevisionItemOut)
async def mark_revision_item_revised(item_id: int) -> RevisionItem:
    """Mark a topic as revised: doubles the interval and pushes next_review_at
    forward by that new interval (simple spaced-repetition — not full SM-2)."""
    async with AsyncSessionLocal() as db:
        item = await db.get(RevisionItem, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"revision item {item_id} not found")
        item.interval_days = max(1, item.interval_days * 2)
        item.next_review_at = date.today() + timedelta(days=item.interval_days)
        await db.commit()
        await db.refresh(item)
        return item


@router.delete("/api/learning/revision-items/{item_id}", status_code=204)
async def delete_revision_item(item_id: int) -> None:
    async with AsyncSessionLocal() as db:
        item = await db.get(RevisionItem, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"revision item {item_id} not found")
        await db.delete(item)
        await db.commit()
