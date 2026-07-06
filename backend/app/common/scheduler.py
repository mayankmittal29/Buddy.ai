import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.common.notifications import send_email
from app.common.recurrence import compute_next_due_at
from app.core.db import AsyncSessionLocal
from app.core.models import (
    Certification,
    CertificationStatus,
    Course,
    CourseStatus,
    NotificationPreferences,
    Task,
    TaskStatus,
)

logger = logging.getLogger(__name__)

REMINDER_WINDOW_MINUTES = 10
CHECK_INTERVAL_MINUTES = 1
LEARNING_CHECK_INTERVAL_MINUTES = 60
DEADLINE_WINDOW_DAYS = 1
INACTIVITY_DAYS = 10
PREFS_ID = 1

scheduler = AsyncIOScheduler()


async def check_due_tasks() -> None:
    """Find tasks due within the next 10 minutes and email a reminder for each.

    Skips entirely unless the user has explicitly opted into email
    notifications from the Profile page (human-in-the-loop opt-in) — never
    sends anything on a channel the user hasn't confirmed.

    One-off tasks get reminder_sent=True after a successful send. Recurring
    tasks (recurrence_rule set) instead roll due_at forward to the next
    occurrence and reset reminder_sent=False, so they keep firing on
    schedule rather than being reminded once and left pending forever.
    """
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        if prefs is None or not prefs.channels.get("email"):
            return
        if not prefs.email_address:
            return

        now = datetime.now(timezone.utc)
        window_end = now + timedelta(minutes=REMINDER_WINDOW_MINUTES)

        stmt = select(Task).where(
            Task.status == TaskStatus.pending,
            Task.reminder_sent.is_(False),
            Task.due_at.is_not(None),
            Task.due_at >= now,
            Task.due_at <= window_end,
        )
        result = await db.execute(stmt)
        due_tasks = result.scalars().all()

        for task in due_tasks:
            subject = f"Reminder: \"{task.title}\" is due soon"
            body = (
                f'"{task.title}" is due at {task.due_at.isoformat()}.'
                + (f"\n\n{task.notes}" if task.notes else "")
            )
            try:
                await asyncio.to_thread(send_email, prefs.email_address, subject, body)
            except Exception:
                logger.exception("Failed to send reminder email for task %s", task.id)
                continue

            if task.recurrence_rule:
                next_due_at = compute_next_due_at(task.due_at, task.recurrence_rule)
                if next_due_at is not None:
                    # Recurring task: roll forward to the next occurrence
                    # instead of marking it done, and re-arm the reminder.
                    task.due_at = next_due_at
                    task.reminder_sent = False
                else:
                    logger.warning(
                        "Unparseable recurrence_rule %r on task %s — treating as one-off",
                        task.recurrence_rule,
                        task.id,
                    )
                    task.reminder_sent = True
            else:
                task.reminder_sent = True

        await db.commit()


async def check_course_deadlines() -> None:
    """Email a reminder for courses with a deadline within 1 day.

    Same human-in-the-loop opt-in gating as check_due_tasks. Each course
    gets reminded once per deadline (deadline_reminder_sent) — resets if the
    deadline is later changed (see app/api/learning.py).
    """
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        if prefs is None or not prefs.channels.get("email"):
            return
        if not prefs.email_address:
            return

        now = datetime.now(timezone.utc)
        window_end = now + timedelta(days=DEADLINE_WINDOW_DAYS)

        stmt = select(Course).where(
            Course.status != CourseStatus.done,
            Course.deadline_reminder_sent.is_(False),
            Course.deadline.is_not(None),
            Course.deadline >= now.date(),
            Course.deadline <= window_end.date(),
        )
        result = await db.execute(stmt)
        courses = result.scalars().all()

        for course in courses:
            subject = f'Reminder: "{course.title}" is due soon'
            body = f'"{course.title}" has a deadline of {course.deadline.isoformat()}.'
            try:
                await asyncio.to_thread(send_email, prefs.email_address, subject, body)
            except Exception:
                logger.exception(
                    "Failed to send deadline reminder for course %s", course.id
                )
                continue
            course.deadline_reminder_sent = True

        await db.commit()


async def check_inactive_learning_items() -> None:
    """Email a single nudge digest for courses/certifications untouched for
    10+ days and not yet done.

    Each item is nudged once per inactivity period (inactivity_nudge_sent) —
    resets whenever the row is next meaningfully edited (see
    app/api/learning.py), so a new nudge can fire after another 10 quiet days.
    """
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        if prefs is None or not prefs.channels.get("email"):
            return
        if not prefs.email_address:
            return

        cutoff = datetime.now(timezone.utc) - timedelta(days=INACTIVITY_DAYS)

        course_result = await db.execute(
            select(Course).where(
                Course.status != CourseStatus.done,
                Course.inactivity_nudge_sent.is_(False),
                Course.last_updated_at <= cutoff,
            )
        )
        inactive_courses = course_result.scalars().all()

        cert_result = await db.execute(
            select(Certification).where(
                Certification.status != CertificationStatus.completed,
                Certification.inactivity_nudge_sent.is_(False),
                Certification.last_updated_at <= cutoff,
            )
        )
        inactive_certs = cert_result.scalars().all()

        if not inactive_courses and not inactive_certs:
            return

        lines = [
            f'- Course "{c.title}" — no updates in over {INACTIVITY_DAYS} days'
            for c in inactive_courses
        ] + [
            f'- Certification "{c.title}" — no updates in over {INACTIVITY_DAYS} days'
            for c in inactive_certs
        ]
        subject = "You've got some stalled learning items"
        body = "These haven't been touched in a while:\n\n" + "\n".join(lines)

        try:
            await asyncio.to_thread(send_email, prefs.email_address, subject, body)
        except Exception:
            logger.exception("Failed to send inactivity nudge email")
            return

        for course in inactive_courses:
            course.inactivity_nudge_sent = True
        for cert in inactive_certs:
            cert.inactivity_nudge_sent = True
        await db.commit()


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(
            check_due_tasks,
            "interval",
            minutes=CHECK_INTERVAL_MINUTES,
            id="task_due_reminders",
            replace_existing=True,
        )
        scheduler.add_job(
            check_course_deadlines,
            "interval",
            minutes=LEARNING_CHECK_INTERVAL_MINUTES,
            id="course_deadline_reminders",
            replace_existing=True,
        )
        scheduler.add_job(
            check_inactive_learning_items,
            "interval",
            minutes=LEARNING_CHECK_INTERVAL_MINUTES,
            id="learning_inactivity_nudges",
            replace_existing=True,
        )
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
