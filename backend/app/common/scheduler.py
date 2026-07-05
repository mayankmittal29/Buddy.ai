import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.common.notifications import send_email
from app.common.recurrence import compute_next_due_at
from app.core.db import AsyncSessionLocal
from app.core.models import NotificationPreferences, Task, TaskStatus

logger = logging.getLogger(__name__)

REMINDER_WINDOW_MINUTES = 10
CHECK_INTERVAL_MINUTES = 1
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


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(
            check_due_tasks,
            "interval",
            minutes=CHECK_INTERVAL_MINUTES,
            id="task_due_reminders",
            replace_existing=True,
        )
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
