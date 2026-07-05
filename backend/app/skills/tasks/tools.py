import re
from datetime import datetime
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.models import Task, TaskPriority, TaskStatus, UserProfile

# Matches just the naive "YYYY-MM-DDTHH:MM[:SS]" portion of a datetime string,
# discarding any trailing offset/"Z".
_NAIVE_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?")


async def _get_profile_timezone() -> str:
    async with AsyncSessionLocal() as db:
        profile = await db.get(UserProfile, 1)
        if profile and profile.timezone:
            return profile.timezone
    return "UTC"


def _parse_due_at(value: str | None, tz_name: str) -> datetime | None:
    if not value:
        return None
    # Smaller models are unreliable at reasoning about UTC offsets, so any
    # offset/"Z" the model attaches is ignored — the wall-clock date/time is
    # always (re-)localized against the user's actual profile timezone, the
    # same frame get_current_datetime reports in.
    match = _NAIVE_DATETIME_RE.match(value.strip())
    naive_str = match.group(0) if match else value.strip()
    naive_dt = datetime.fromisoformat(naive_str)
    try:
        local_dt = naive_dt.replace(tzinfo=ZoneInfo(tz_name))
    except ZoneInfoNotFoundError:
        local_dt = naive_dt.replace(tzinfo=dt_timezone.utc)
    return local_dt.astimezone(dt_timezone.utc)


async def get_current_datetime() -> dict:
    """Get the current real-world date and time.

    Your training data has a cutoff, so you cannot infer today's actual date
    on your own — always call this first whenever the user gives a relative
    date ("today", "tomorrow", "next Friday") or a date with no year (e.g.
    "6 July"), so you resolve it against the real current date rather than a
    guess.

    Returns:
      {"date": "YYYY-MM-DD", "time": "HH:MM" (24h), "day_of_week": "Monday",
       "timezone": IANA name (the user's profile timezone, or "UTC")}.
    """
    tz_name = await _get_profile_timezone()
    now_utc = datetime.now(dt_timezone.utc)
    try:
        local_now = now_utc.astimezone(ZoneInfo(tz_name))
    except ZoneInfoNotFoundError:
        local_now = now_utc
        tz_name = "UTC"

    return {
        "date": local_now.strftime("%Y-%m-%d"),
        "time": local_now.strftime("%H:%M"),
        "day_of_week": local_now.strftime("%A"),
        "timezone": tz_name,
    }


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "notes": task.notes,
        "priority": task.priority.value,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "recurrence_rule": task.recurrence_rule,
        "status": task.status.value,
        "reminder_sent": task.reminder_sent,
        "created_at": task.created_at.isoformat(),
    }


async def create_task(
    title: str,
    due_at: str | None,
    priority: str = "normal",
    recurrence_rule: str | None = None,
) -> dict:
    """Create a new task for the user.

    Args:
      title: Short, clear description of the task.
      due_at: The local date and time the task is due (from get_current_datetime's
        timezone), formatted "YYYY-MM-DDTHH:MM" — plain wall-clock time, with
        NO UTC offset and no "Z" suffix. Null if there's no due date. Resolve
        relative or year-less dates via get_current_datetime first — never
        guess today's date yourself.
      priority: One of "urgent", "normal", "light". Defaults to "normal" if
        the user didn't state one — don't block on asking for it.
      recurrence_rule: Simple recurrence description (e.g. "FREQ=DAILY"), or
        null for a one-off task.

    Returns:
      The created task, or an {"error": ...} dict if priority is invalid.
    """
    try:
        priority_enum = TaskPriority(priority)
    except ValueError:
        return {
            "error": f"invalid priority '{priority}'. Must be one of: urgent, normal, light."
        }

    tz_name = await _get_profile_timezone()
    async with AsyncSessionLocal() as db:
        task = Task(
            title=title,
            priority=priority_enum,
            due_at=_parse_due_at(due_at, tz_name),
            recurrence_rule=recurrence_rule,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return _task_to_dict(task)


async def list_tasks(
    status: str | None = None, priority: str | None = None
) -> list[dict] | dict:
    """List the user's tasks, optionally filtered by status and/or priority.

    Args:
      status: Filter to "pending" or "done", or null for all statuses.
      priority: Filter to "urgent", "normal", or "light", or null for all
        priorities.

    Returns:
      A list of tasks (most recently created first), or an {"error": ...} dict.
    """
    status_enum = None
    if status is not None:
        try:
            status_enum = TaskStatus(status)
        except ValueError:
            return {"error": f"invalid status '{status}'. Must be one of: pending, done."}

    priority_enum = None
    if priority is not None:
        try:
            priority_enum = TaskPriority(priority)
        except ValueError:
            return {
                "error": f"invalid priority '{priority}'. Must be one of: urgent, normal, light."
            }

    async with AsyncSessionLocal() as db:
        stmt = select(Task).order_by(Task.created_at.desc())
        if status_enum is not None:
            stmt = stmt.where(Task.status == status_enum)
        if priority_enum is not None:
            stmt = stmt.where(Task.priority == priority_enum)
        result = await db.execute(stmt)
        return [_task_to_dict(t) for t in result.scalars().all()]


async def complete_task(task_id: int) -> dict:
    """Mark a task as done.

    Args:
      task_id: id of the task to complete.

    Returns:
      The updated task, or an {"error": ...} dict if it doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        task = await db.get(Task, task_id)
        if task is None:
            return {"error": f"task {task_id} not found"}
        task.status = TaskStatus.done
        await db.commit()
        await db.refresh(task)
        return _task_to_dict(task)


async def delete_task(task_id: int) -> dict:
    """Permanently delete a task. Always confirm with the user before calling this.

    Args:
      task_id: id of the task to delete.

    Returns:
      {"deleted": task_id} on success, or an {"error": ...} dict if it doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        task = await db.get(Task, task_id)
        if task is None:
            return {"error": f"task {task_id} not found"}
        await db.delete(task)
        await db.commit()
        return {"deleted": task_id}


TOOLS = [create_task, list_tasks, complete_task, delete_task, get_current_datetime]
SUB_AGENTS = []
