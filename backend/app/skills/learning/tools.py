import json
import logging
from datetime import date, timedelta

from google.genai import types
from sqlalchemy import select

from app.common.gemini_client import get_gemini_client
from app.core.db import AsyncSessionLocal
from app.core.models import (
    Certification,
    CertificationStatus,
    Course,
    CourseStatus,
    RevisionItem,
)

logger = logging.getLogger(__name__)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


def _course_to_dict(course: Course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "provider": course.provider,
        "status": course.status.value,
        "deadline": course.deadline.isoformat() if course.deadline else None,
        "roadmap_position": course.roadmap_position,
        "roadmap_rationale": course.roadmap_rationale,
    }


async def add_course(title: str, provider: str | None = None, deadline: str | None = None) -> dict:
    """Add a course to track.

    Args:
      title: Course name.
      provider: Where it's from (e.g. "Coursera", "Udemy"), or null if unknown.
      deadline: ISO date (YYYY-MM-DD) to finish it by, or null if there's no deadline.

    Returns:
      The created course.
    """
    async with AsyncSessionLocal() as db:
        course = Course(title=title, provider=provider, deadline=_parse_date(deadline))
        db.add(course)
        await db.commit()
        await db.refresh(course)
        return _course_to_dict(course)


async def list_courses(status: str | None = None) -> list[dict] | dict:
    """List tracked courses, optionally filtered by status.

    Args:
      status: One of "planned", "in_progress", "done", or null for all.

    Returns:
      A list of courses ordered by roadmap position (if generated), or an
      {"error": ...} dict if status is invalid.
    """
    status_enum = None
    if status is not None:
        try:
            status_enum = CourseStatus(status)
        except ValueError:
            return {
                "error": f"invalid status '{status}'. Must be one of: planned, in_progress, done."
            }
    async with AsyncSessionLocal() as db:
        stmt = select(Course).order_by(Course.roadmap_position.asc().nulls_last())
        if status_enum is not None:
            stmt = stmt.where(Course.status == status_enum)
        result = await db.execute(stmt)
        return [_course_to_dict(c) for c in result.scalars().all()]


async def mark_course_done(course_id: int) -> dict:
    """Mark a course as done.

    Args:
      course_id: id of the course to mark done.

    Returns:
      The updated course, or an {"error": ...} dict if it doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        course = await db.get(Course, course_id)
        if course is None:
            return {"error": f"course {course_id} not found"}
        course.status = CourseStatus.done
        course.inactivity_nudge_sent = False
        await db.commit()
        await db.refresh(course)
        return _course_to_dict(course)


def _cert_to_dict(cert: Certification) -> dict:
    return {
        "id": cert.id,
        "title": cert.title,
        "issuer": cert.issuer,
        "date_received": cert.date_received.isoformat() if cert.date_received else None,
        "status": cert.status.value,
        "file_url": cert.file_url,
    }


async def add_certification(title: str, issuer: str | None = None) -> dict:
    """Add a certification to track (planned or in progress toward).

    Args:
      title: Certification name.
      issuer: Who issues it (e.g. "AWS", "Google"), or null if unknown.

    Returns:
      The created certification.
    """
    async with AsyncSessionLocal() as db:
        cert = Certification(title=title, issuer=issuer)
        db.add(cert)
        await db.commit()
        await db.refresh(cert)
        return _cert_to_dict(cert)


async def list_certifications(status: str | None = None) -> list[dict] | dict:
    """List tracked certifications, optionally filtered by status.

    Args:
      status: One of "pending", "completed", or null for all.

    Returns:
      A list of certifications, or an {"error": ...} dict if status is invalid.
    """
    status_enum = None
    if status is not None:
        try:
            status_enum = CertificationStatus(status)
        except ValueError:
            return {"error": f"invalid status '{status}'. Must be one of: pending, completed."}
    async with AsyncSessionLocal() as db:
        stmt = select(Certification).order_by(Certification.created_at.asc())
        if status_enum is not None:
            stmt = stmt.where(Certification.status == status_enum)
        result = await db.execute(stmt)
        return [_cert_to_dict(c) for c in result.scalars().all()]


async def mark_certification_done(cert_id: int, date_received: str | None = None) -> dict:
    """Mark a certification as completed/received.

    Args:
      cert_id: id of the certification to mark completed.
      date_received: ISO date (YYYY-MM-DD) it was received, or null to use today.

    Returns:
      The updated certification, or an {"error": ...} dict if it doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        cert = await db.get(Certification, cert_id)
        if cert is None:
            return {"error": f"certification {cert_id} not found"}
        cert.status = CertificationStatus.completed
        cert.date_received = _parse_date(date_received) or date.today()
        cert.inactivity_nudge_sent = False
        await db.commit()
        await db.refresh(cert)
        return _cert_to_dict(cert)


def _revision_to_dict(item: RevisionItem) -> dict:
    return {
        "id": item.id,
        "topic": item.topic,
        "notes": item.notes,
        "next_review_at": item.next_review_at.isoformat(),
        "interval_days": item.interval_days,
    }


async def add_revision_item(topic: str, notes: str | None = None, interval_days: int = 1) -> dict:
    """Add a topic to the revision planner, due for review starting today.

    Args:
      topic: What to revise.
      notes: Any notes to jog memory next time, or null.
      interval_days: Days between reviews once started. Defaults to 1 (review
        starting tomorrow after first mark-revised).

    Returns:
      The created revision item.
    """
    async with AsyncSessionLocal() as db:
        item = RevisionItem(
            topic=topic, notes=notes, interval_days=interval_days, next_review_at=date.today()
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return _revision_to_dict(item)


async def list_due_revision_items() -> list[dict]:
    """List revision topics due for review today or earlier.

    Returns:
      A list of due revision items, soonest first.
    """
    async with AsyncSessionLocal() as db:
        stmt = (
            select(RevisionItem)
            .where(RevisionItem.next_review_at <= date.today())
            .order_by(RevisionItem.next_review_at.asc())
        )
        result = await db.execute(stmt)
        return [_revision_to_dict(i) for i in result.scalars().all()]


async def mark_revision_done(item_id: int) -> dict:
    """Mark a revision topic as reviewed — doubles its interval and pushes
    the next review date forward by that new interval.

    Args:
      item_id: id of the revision item just reviewed.

    Returns:
      The updated revision item, or an {"error": ...} dict if it doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        item = await db.get(RevisionItem, item_id)
        if item is None:
            return {"error": f"revision item {item_id} not found"}
        item.interval_days = max(1, item.interval_days * 2)
        item.next_review_at = date.today() + timedelta(days=item.interval_days)
        await db.commit()
        await db.refresh(item)
        return _revision_to_dict(item)


async def generate_learning_roadmap(goal: str | None = None) -> dict:
    """Generate an ordered learning roadmap across all planned/in-progress courses.

    Reasons about a sensible ordering — foundational topics before advanced
    ones, related topics grouped together — optionally guided by a stated
    goal, and saves the ordering + a short rationale onto each course.

    Args:
      goal: What the user is ultimately working toward (e.g. "become
        job-ready for backend roles"), if they've mentioned one. Null if no
        goal has been stated.

    Returns:
      {"roadmap": [{"course_id", "title", "position", "rationale"}, ...]},
      or an {"error": ...} dict if there are no planned/in-progress courses
      or roadmap generation failed.
    """
    async with AsyncSessionLocal() as db:
        stmt = select(Course).where(
            Course.status.in_([CourseStatus.planned, CourseStatus.in_progress])
        )
        result = await db.execute(stmt)
        courses = list(result.scalars().all())

    if not courses:
        return {"error": "No planned or in-progress courses to build a roadmap from."}

    course_list = "\n".join(
        f"- id={c.id}: {c.title}" + (f" ({c.provider})" if c.provider else "") for c in courses
    )
    goal_line = f"The user's goal: {goal}\n\n" if goal else ""
    prompt = (
        f"{goal_line}Here are the user's planned/in-progress courses:\n{course_list}\n\n"
        "Order these into a sensible learning roadmap - foundational topics before "
        "advanced ones, related topics grouped together. Return ONLY a JSON array, "
        "one object per course, each with exactly these keys: \"id\" (the course id, "
        "integer), \"position\" (1-based order, integer), \"rationale\" (one short "
        "sentence on why it's placed there)."
    )

    try:
        response = await get_gemini_client().aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        ordering = json.loads(response.text or "[]")
    except Exception:
        logger.warning("generate_learning_roadmap failed", exc_info=True)
        return {"error": "Failed to generate a roadmap — try again."}

    roadmap = []
    async with AsyncSessionLocal() as db:
        for entry in ordering:
            course = await db.get(Course, entry.get("id"))
            if course is None:
                continue
            course.roadmap_position = entry.get("position")
            course.roadmap_rationale = entry.get("rationale")
            roadmap.append(
                {
                    "course_id": course.id,
                    "title": course.title,
                    "position": course.roadmap_position,
                    "rationale": course.roadmap_rationale,
                }
            )
        await db.commit()

    roadmap.sort(key=lambda r: r["position"] or 0)
    return {"roadmap": roadmap}


TOOLS = [
    add_course,
    list_courses,
    mark_course_done,
    add_certification,
    list_certifications,
    mark_certification_done,
    add_revision_item,
    list_due_revision_items,
    mark_revision_done,
    generate_learning_roadmap,
]
SUB_AGENTS = []
