import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.habits import MILESTONES
from app.common.news import cleanup_old_news, generate_daily_digest
from app.common.notifications import send_email_guarded
from app.common.recurrence import compute_next_due_at
from app.core.db import AsyncSessionLocal
from app.core.models import (
    Certification,
    CertificationStatus,
    Course,
    CourseStatus,
    Habit,
    Notification,
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
NEWS_DIGEST_HOUR = 7  # "every morning"

scheduler = AsyncIOScheduler()


async def check_due_tasks() -> None:
    """Find tasks due within the next 10 minutes, create an in-app
    Notification for each, and additionally email a reminder if the user
    has opted into email (human-in-the-loop opt-in — never sends anything
    on a channel the user hasn't confirmed). The in-app notification is
    created either way, so it doesn't depend on email being configured.

    One-off tasks get reminder_sent=True once notified. Recurring tasks
    (recurrence_rule set) instead roll due_at forward to the next
    occurrence and reset reminder_sent=False, so they keep firing on
    schedule rather than being reminded once and left pending forever.
    """
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        email_enabled = bool(
            prefs and prefs.channels.get("email") and prefs.email_address
        )

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
            title = f'"{task.title}" is due soon'
            body = f'"{task.title}" is due at {task.due_at.isoformat()}.' + (
                f"\n\n{task.notes}" if task.notes else ""
            )
            db.add(
                Notification(
                    type="task_due",
                    title=title,
                    body=body,
                    source_skill="tasks",
                    source_id=task.id,
                )
            )

            if email_enabled:
                try:
                    await asyncio.to_thread(
                        send_email_guarded,
                        prefs.email_address,
                        f"Reminder: {title}",
                        body,
                        source_skill="tasks",
                    )
                except Exception:
                    logger.exception(
                        "Failed to send reminder email for task %s", task.id
                    )

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
    """Create an in-app Notification (and, if opted in, email) a reminder
    for courses with a deadline within 1 day.

    Same human-in-the-loop opt-in gating as check_due_tasks for the email
    side; the in-app notification is created regardless. Each course gets
    notified once per deadline (deadline_reminder_sent) — resets if the
    deadline is later changed (see app/api/learning.py).
    """
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        email_enabled = bool(
            prefs and prefs.channels.get("email") and prefs.email_address
        )

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
            title = f'"{course.title}" is due soon'
            body = f'"{course.title}" has a deadline of {course.deadline.isoformat()}.'
            db.add(
                Notification(
                    type="course_deadline",
                    title=title,
                    body=body,
                    source_skill="learning",
                    source_id=course.id,
                )
            )

            if email_enabled:
                try:
                    await asyncio.to_thread(
                        send_email_guarded,
                        prefs.email_address,
                        f"Reminder: {title}",
                        body,
                        source_skill="learning",
                    )
                except Exception:
                    logger.exception(
                        "Failed to send deadline reminder for course %s", course.id
                    )

            course.deadline_reminder_sent = True

        await db.commit()


async def check_inactive_learning_items() -> None:
    """Create an in-app Notification for each course/certification untouched
    for 10+ days and not yet done, and — if opted in — additionally email a
    single combined nudge digest for all of them (kept as one email so it
    doesn't spam an inbox, unlike the in-app feed where each item gets its
    own entry so it's individually clickable).

    Each item is nudged once per inactivity period (inactivity_nudge_sent) —
    resets whenever the row is next meaningfully edited (see
    app/api/learning.py), so a new nudge can fire after another 10 quiet days.
    """
    async with AsyncSessionLocal() as db:
        prefs = await db.get(NotificationPreferences, PREFS_ID)
        email_enabled = bool(
            prefs and prefs.channels.get("email") and prefs.email_address
        )

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

        for course in inactive_courses:
            db.add(
                Notification(
                    type="learning_inactivity",
                    title=f'"{course.title}" has stalled',
                    body=f"No updates in over {INACTIVITY_DAYS} days.",
                    source_skill="learning",
                    source_id=course.id,
                )
            )
        for cert in inactive_certs:
            db.add(
                Notification(
                    type="learning_inactivity",
                    title=f'"{cert.title}" has stalled',
                    body=f"No updates in over {INACTIVITY_DAYS} days.",
                    source_skill="learning",
                    source_id=cert.id,
                )
            )

        if email_enabled:
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
                await asyncio.to_thread(
                    send_email_guarded,
                    prefs.email_address,
                    subject,
                    body,
                    source_skill="learning",
                )
            except Exception:
                logger.exception("Failed to send inactivity nudge email")

        for course in inactive_courses:
            course.inactivity_nudge_sent = True
        for cert in inactive_certs:
            cert.inactivity_nudge_sent = True
        await db.commit()


async def check_habit_milestone(
    db: AsyncSession, habit: Habit, current_streak: int
) -> None:
    """Call right after a habit's log is toggled (see app/api/habits.py and
    app/skills/habits/tools.py) — if current_streak just reached a new
    milestone (10/30/50/100) not yet notified for, create an in-app
    Notification celebrating it, and email it too if opted in.

    Resets last_milestone_notified back down whenever the streak has
    dropped below it (a broken streak), so reaching the same milestone
    again later notifies again rather than staying silent forever. Does
    not commit — caller's responsibility, so it lands in the same
    transaction as the toggle itself.
    """
    if current_streak < habit.last_milestone_notified:
        habit.last_milestone_notified = 0

    reached = [
        m for m in MILESTONES if current_streak >= m > habit.last_milestone_notified
    ]
    if not reached:
        return
    milestone = max(reached)

    title = f'"{habit.title}" hit a {milestone}-day streak!'
    body = (
        f'You\'ve kept up "{habit.title}" for {milestone} days in a row. Keep it going!'
    )
    db.add(
        Notification(
            type="habit_milestone",
            title=title,
            body=body,
            source_skill="habits",
            source_id=habit.id,
        )
    )
    habit.last_milestone_notified = milestone

    prefs = await db.get(NotificationPreferences, PREFS_ID)
    if prefs and prefs.channels.get("email") and prefs.email_address:
        try:
            await asyncio.to_thread(
                send_email_guarded,
                prefs.email_address,
                f"\U0001f389 {title}",
                body,
                source_skill="habits",
            )
        except Exception:
            logger.exception(
                "Failed to send habit milestone email for habit %s", habit.id
            )


async def run_daily_news_job() -> None:
    """Generate the daily news digest, notify the user it's ready (in-app,
    plus email if opted in), then purge news_items past the 3-day
    retention window (starred items are exempt — see cleanup_old_news).
    Runs once a morning via APScheduler; failures are logged, not raised,
    so one bad run doesn't crash the scheduler's event loop.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await generate_daily_digest(db)
            if result["added"] > 0:
                categories = ", ".join(
                    f"{count} {category}"
                    for category, count in result["by_category"].items()
                )
                db.add(
                    Notification(
                        type="news_digest",
                        title="Today's news digest is ready",
                        body=f"{result['added']} new items ({categories}).",
                        source_skill="news",
                    )
                )

                prefs = await db.get(NotificationPreferences, PREFS_ID)
                if prefs and prefs.channels.get("email") and prefs.email_address:
                    try:
                        await asyncio.to_thread(
                            send_email_guarded,
                            prefs.email_address,
                            "Today's news digest is ready",
                            f"{result['added']} new items ({categories}).",
                            source_skill="news",
                        )
                    except Exception:
                        logger.exception("Failed to send news digest email")

            deleted = await cleanup_old_news(db)
            if deleted:
                logger.info("news retention cleanup: deleted %d item(s)", deleted)

            await db.commit()
    except Exception:
        logger.exception("run_daily_news_job failed")


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
        scheduler.add_job(
            run_daily_news_job,
            "cron",
            hour=NEWS_DIGEST_HOUR,
            minute=0,
            id="daily_news_digest",
            replace_existing=True,
        )
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
