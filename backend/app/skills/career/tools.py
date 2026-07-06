import re
from datetime import date

import httpx
from app.common.text_extraction import extract_docx_text, extract_pdf_text
from app.core.db import AsyncSessionLocal
from app.core.models import JobApplication, JobApplicationStatus, Resume
from sqlalchemy import select

_STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
    "as",
    "by",
    "at",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "from",
    "into",
    "about",
    "than",
    "then",
    "so",
    "such",
    "not",
    "no",
    "yes",
    "will",
    "would",
    "can",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "do",
    "does",
    "did",
    "have",
    "has",
    "had",
    "you",
    "your",
    "we",
    "our",
    "they",
    "their",
    "he",
    "she",
    "his",
    "her",
    "i",
    "me",
    "my",
    "us",
    "them",
    "who",
    "whom",
    "which",
    "what",
    "when",
    "where",
    "why",
    "how",
    "all",
    "any",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "only",
    "own",
    "same",
    "also",
    "etc",
}

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+#]*(?:\.[a-zA-Z0-9+#]+)*")


def _tokenize(text: str) -> set[str]:
    words = _WORD_RE.findall(text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 1}


async def _download_file(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=15)
        response.raise_for_status()
        return response.content


def _application_to_dict(app: JobApplication) -> dict:
    return {
        "id": app.id,
        "company": app.company,
        "role": app.role,
        "date_applied": app.date_applied.isoformat() if app.date_applied else None,
        "ctc": app.ctc,
        "source_link": app.source_link,
        "referral_taken_by": app.referral_taken_by,
        "status": app.status.value,
        "hr_contact": app.hr_contact,
        "notes": app.notes,
    }


async def list_resumes() -> list[dict]:
    """List all uploaded resume versions.

    Returns:
      A list of {"id", "version_label", "filename", "is_active"} dicts.
    """
    async with AsyncSessionLocal() as db:
        stmt = select(Resume).order_by(Resume.uploaded_at.desc())
        result = await db.execute(stmt)
        return [
            {
                "id": r.id,
                "version_label": r.version_label,
                "filename": r.filename,
                "is_active": r.is_active,
            }
            for r in result.scalars().all()
        ]


async def skill_gap_analysis(resume_id: int, jd_text: str) -> dict:
    """Compare a resume's keyword set against a job description's to find gaps.

    Extracts plain text from the resume file (PDF or DOCX), tokenizes both
    it and the JD (case-insensitive, common stopwords filtered), and reports
    what fraction of the JD's distinct keywords appear in the resume.

    Args:
      resume_id: id of the resume version to check (see list_resumes).
      jd_text: The job description as plain text. If the user uploaded a
        PDF/image of the JD rather than pasting text, its text should
        already have been extracted (via the app's own upload flow) before
        this is called — this tool only accepts plain text.

    Returns:
      {"match_percentage", "matched_keywords", "missing_keywords",
       "resume_version"}, or an {"error": ...} dict if the resume doesn't
      exist or its text couldn't be extracted.
    """
    async with AsyncSessionLocal() as db:
        resume = await db.get(Resume, resume_id)
    if resume is None:
        return {"error": f"resume {resume_id} not found"}

    try:
        contents = await _download_file(resume.file_path)
    except Exception as exc:
        return {"error": f"couldn't download resume file: {exc}"}

    filename = resume.filename.lower()
    try:
        if filename.endswith(".pdf"):
            resume_text = extract_pdf_text(contents)
        elif filename.endswith(".docx"):
            resume_text = extract_docx_text(contents)
        else:
            return {"error": f"unsupported resume file type for '{resume.filename}'"}
    except Exception as exc:
        return {"error": f"couldn't extract text from resume: {exc}"}

    if not resume_text.strip():
        return {"error": "couldn't extract any text from the resume file"}

    resume_keywords = _tokenize(resume_text)
    jd_keywords = _tokenize(jd_text)
    if not jd_keywords:
        return {"error": "the job description text is empty"}

    matched = jd_keywords & resume_keywords
    missing = jd_keywords - resume_keywords
    match_percentage = round(len(matched) / len(jd_keywords) * 100, 1)

    return {
        "match_percentage": match_percentage,
        "matched_keywords": sorted(matched),
        "missing_keywords": sorted(missing),
        "resume_version": resume.version_label,
    }


async def list_job_applications(status: str | None = None) -> list[dict] | dict:
    """List tracked job applications, optionally filtered by status.

    Args:
      status: One of "applied", "interview", "offer", "rejected", "withdrawn",
        or null for all.

    Returns:
      A list of applications (most recent first), or an {"error": ...} dict.
    """
    status_enum = None
    if status is not None:
        try:
            status_enum = JobApplicationStatus(status)
        except ValueError:
            return {
                "error": f"invalid status '{status}'. Must be one of: "
                "applied, interview, offer, rejected, withdrawn."
            }
    async with AsyncSessionLocal() as db:
        stmt = select(JobApplication).order_by(JobApplication.created_at.desc())
        if status_enum is not None:
            stmt = stmt.where(JobApplication.status == status_enum)
        result = await db.execute(stmt)
        return [_application_to_dict(a) for a in result.scalars().all()]


async def add_job_application(
    company: str,
    role: str,
    ctc: str | None = None,
    source_link: str | None = None,
    referral_taken_by: str | None = None,
    hr_contact: str | None = None,
    notes: str | None = None,
) -> dict:
    """Add a job application, defaulting to "applied" status with today's date.

    Args:
      company: Company name.
      role: Job title/role applied for.
      ctc: Compensation offered/discussed (any format, e.g. "12 LPA"), or null.
      source_link: Link to the job posting, or null.
      referral_taken_by: Who referred you, if anyone, or null.
      hr_contact: Recruiter/HR contact info, if known, or null.
      notes: Any other notes, or null.

    Returns:
      The created application.
    """
    async with AsyncSessionLocal() as db:
        application = JobApplication(
            company=company,
            role=role,
            date_applied=date.today(),
            ctc=ctc,
            source_link=source_link,
            referral_taken_by=referral_taken_by,
            hr_contact=hr_contact,
            notes=notes,
        )
        db.add(application)
        await db.commit()
        await db.refresh(application)
        return _application_to_dict(application)


async def update_job_application_status(application_id: int, status: str) -> dict:
    """Update a job application's status (e.g. after an interview or offer).

    Args:
      application_id: id of the application to update.
      status: One of "applied", "interview", "offer", "rejected", "withdrawn".

    Returns:
      The updated application, or an {"error": ...} dict.
    """
    try:
        status_enum = JobApplicationStatus(status)
    except ValueError:
        return {
            "error": f"invalid status '{status}'. Must be one of: "
            "applied, interview, offer, rejected, withdrawn."
        }
    async with AsyncSessionLocal() as db:
        application = await db.get(JobApplication, application_id)
        if application is None:
            return {"error": f"application {application_id} not found"}
        application.status = status_enum
        await db.commit()
        await db.refresh(application)
        return _application_to_dict(application)


TOOLS = [
    list_resumes,
    skill_gap_analysis,
    list_job_applications,
    add_job_application,
    update_job_application_status,
]
SUB_AGENTS = []
