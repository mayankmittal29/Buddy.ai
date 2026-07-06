import asyncio
import uuid
from datetime import date, datetime

import cloudinary.uploader
import httpx
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, update

from app.common.cloudinary_client import ensure_cloudinary_configured
from app.common.r2_client import delete_from_r2, ensure_r2_configured, upload_to_r2
from app.common.text_extraction import extract_image_text, extract_pdf_text
from app.core.db import AsyncSessionLocal
from app.core.models import JobApplication, JobApplicationStatus, Resume

router = APIRouter()

SUPPORTED_RESUME_EXTENSIONS = ("pdf", "docx")

DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


# ---------------------------------------------------------------------------
# Resumes
# ---------------------------------------------------------------------------


class ResumeUpdate(BaseModel):
    version_label: str | None = None
    is_active: bool | None = None


class ResumeOut(BaseModel):
    id: int
    filename: str
    version_label: str
    file_path: str
    uploaded_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("/api/career/resumes", response_model=list[ResumeOut])
async def list_resumes() -> list[Resume]:
    async with AsyncSessionLocal() as db:
        stmt = select(Resume).order_by(Resume.uploaded_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/api/career/resumes", response_model=ResumeOut, status_code=201)
async def upload_resume(
    version_label: str = Form(...), file: UploadFile = File(...)
) -> Resume:
    """Upload a resume file and record a new version.

    PDFs go to Cloudflare R2 once it's configured (so they can be served for
    inline browser preview, not forced-download) — until then, they
    automatically fall back to Cloudinary (same as DOCX) so uploads keep
    working with just Cloudinary configured. No code change needed to switch
    over later: add the R2_* credentials to .env and PDFs start landing in R2
    on their own.
    """
    filename = file.filename or "resume"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in SUPPORTED_RESUME_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX resumes are supported."
        )

    contents = await file.read()

    # Remember exactly how to delete this file later — Cloudinary's destroy()
    # needs the public_id + resource_type, R2's delete_object needs the key.
    storage_provider: str
    storage_key: str | None = None
    storage_resource_type: str | None = None

    if ext == "pdf" and ensure_r2_configured():
        key = f"resumes/{uuid.uuid4().hex}.pdf"
        try:
            file_path = await asyncio.to_thread(
                upload_to_r2, contents, key, "application/pdf"
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Upload failed: {exc}"
            ) from exc
        storage_provider = "r2"
        storage_key = key
    else:
        if not ensure_cloudinary_configured():
            raise HTTPException(
                status_code=503,
                detail="File storage isn't configured (missing Cloudinary credentials).",
            )
        resource_type = "image" if ext == "pdf" else "raw"
        try:
            result = await asyncio.to_thread(
                cloudinary.uploader.upload,
                contents,
                folder="buddy/resumes",
                # PDFs as "image" — Cloudinary serves those inline
                # (Content-Type: application/pdf, no forced attachment),
                # unlike "raw" which always forces a download. DOCX has no
                # such option, so it stays "raw" (browsers can't preview it
                # inline either way).
                resource_type=resource_type,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Upload failed: {exc}"
            ) from exc
        file_path = result["secure_url"]
        storage_provider = "cloudinary"
        storage_key = result["public_id"]
        storage_resource_type = resource_type

    async with AsyncSessionLocal() as db:
        resume = Resume(
            filename=filename,
            version_label=version_label,
            file_path=file_path,
            storage_provider=storage_provider,
            storage_key=storage_key,
            storage_resource_type=storage_resource_type,
        )
        db.add(resume)
        await db.commit()
        await db.refresh(resume)
        return resume


@router.get("/api/career/resumes/{resume_id}/download")
async def download_resume(resume_id: int) -> Response:
    """Proxy-download a resume with a forced attachment disposition —
    reliable across browsers/storage providers, unlike relying on an <a
    download> attribute against a cross-origin URL."""
    async with AsyncSessionLocal() as db:
        resume = await db.get(Resume, resume_id)
    if resume is None:
        raise HTTPException(status_code=404, detail=f"resume {resume_id} not found")

    async with httpx.AsyncClient() as client:
        response = await client.get(resume.file_path, timeout=20)
        response.raise_for_status()

    ext = resume.filename.lower().rsplit(".", 1)[-1] if "." in resume.filename else ""
    media_type = "application/pdf" if ext == "pdf" else DOCX_MEDIA_TYPE

    return Response(
        content=response.content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{resume.filename}"'},
    )


@router.patch("/api/career/resumes/{resume_id}", response_model=ResumeOut)
async def update_resume(resume_id: int, data: ResumeUpdate) -> Resume:
    async with AsyncSessionLocal() as db:
        resume = await db.get(Resume, resume_id)
        if resume is None:
            raise HTTPException(status_code=404, detail=f"resume {resume_id} not found")
        updates = data.model_dump(exclude_unset=True)
        if updates.get("is_active") is True:
            # Only one resume can be "active" at a time.
            await db.execute(
                update(Resume).where(Resume.id != resume_id).values(is_active=False)
            )
        for field, value in updates.items():
            setattr(resume, field, value)
        await db.commit()
        await db.refresh(resume)
        return resume


@router.delete("/api/career/resumes/{resume_id}", status_code=204)
async def delete_resume(resume_id: int) -> None:
    async with AsyncSessionLocal() as db:
        resume = await db.get(Resume, resume_id)
        if resume is None:
            raise HTTPException(status_code=404, detail=f"resume {resume_id} not found")

        if resume.storage_key:
            try:
                if resume.storage_provider == "r2":
                    await asyncio.to_thread(delete_from_r2, resume.storage_key)
                elif resume.storage_provider == "cloudinary":
                    await asyncio.to_thread(
                        cloudinary.uploader.destroy,
                        resume.storage_key,
                        resource_type=resume.storage_resource_type or "raw",
                    )
            except Exception as exc:
                raise HTTPException(
                    status_code=502, detail=f"Couldn't delete the stored file: {exc}"
                ) from exc

        await db.delete(resume)
        await db.commit()


# ---------------------------------------------------------------------------
# Job applications
# ---------------------------------------------------------------------------


class JobApplicationCreate(BaseModel):
    company: str
    role: str
    date_applied: date | None = None
    ctc: str | None = None
    source_link: str | None = None
    referral_taken_by: str | None = None
    status: JobApplicationStatus = JobApplicationStatus.applied
    category: str | None = None
    hr_contact: str | None = None
    notes: str | None = None


class JobApplicationUpdate(BaseModel):
    company: str | None = None
    role: str | None = None
    date_applied: date | None = None
    ctc: str | None = None
    source_link: str | None = None
    referral_taken_by: str | None = None
    status: JobApplicationStatus | None = None
    category: str | None = None
    hr_contact: str | None = None
    notes: str | None = None


class JobApplicationOut(BaseModel):
    id: int
    company: str
    role: str
    date_applied: date | None
    ctc: str | None
    source_link: str | None
    referral_taken_by: str | None
    status: JobApplicationStatus
    category: str | None
    hr_contact: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/career/applications", response_model=list[JobApplicationOut])
async def list_applications(
    status: JobApplicationStatus | None = None,
) -> list[JobApplication]:
    async with AsyncSessionLocal() as db:
        stmt = select(JobApplication).order_by(JobApplication.created_at.desc())
        if status is not None:
            stmt = stmt.where(JobApplication.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post(
    "/api/career/applications", response_model=JobApplicationOut, status_code=201
)
async def create_application(data: JobApplicationCreate) -> JobApplication:
    async with AsyncSessionLocal() as db:
        application = JobApplication(**data.model_dump())
        db.add(application)
        await db.commit()
        await db.refresh(application)
        return application


@router.patch("/api/career/applications/{app_id}", response_model=JobApplicationOut)
async def update_application(app_id: int, data: JobApplicationUpdate) -> JobApplication:
    async with AsyncSessionLocal() as db:
        application = await db.get(JobApplication, app_id)
        if application is None:
            raise HTTPException(
                status_code=404, detail=f"application {app_id} not found"
            )
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(application, field, value)
        await db.commit()
        await db.refresh(application)
        return application


@router.delete("/api/career/applications/{app_id}", status_code=204)
async def delete_application(app_id: int) -> None:
    async with AsyncSessionLocal() as db:
        application = await db.get(JobApplication, app_id)
        if application is None:
            raise HTTPException(
                status_code=404, detail=f"application {app_id} not found"
            )
        await db.delete(application)
        await db.commit()


# ---------------------------------------------------------------------------
# JD text extraction (for the skill-gap analysis chat flow)
# ---------------------------------------------------------------------------


@router.post("/api/career/extract-jd-text")
async def extract_jd_text(file: UploadFile = File(...)) -> dict:
    """Extract plain text from an uploaded job description file (PDF or image),
    so it can be pasted into the skill-gap-analysis chat flow as plain text."""
    content_type = file.content_type or ""
    filename = (file.filename or "").lower()
    contents = await file.read()

    if content_type == "application/pdf" or filename.endswith(".pdf"):
        text = await asyncio.to_thread(extract_pdf_text, contents)
    elif content_type.startswith("image/") or filename.endswith(
        (".png", ".jpg", ".jpeg", ".webp")
    ):
        text = await extract_image_text(contents, content_type or "image/png")
    else:
        raise HTTPException(
            status_code=400, detail="Unsupported file type — upload a PDF or image."
        )

    return {"text": text}
