from datetime import date as date_cls
from datetime import time as time_cls

from app.core.db import AsyncSessionLocal
from app.core.models import PlannerItem, PlannerMode, PlannerStatus, UserProfile
from sqlalchemy import select

MEAL_DURATION_MINUTES = 30
DEFAULT_TASK_HOURS = 1.0
MIN_TASK_MINUTES = 15


def _parse_hhmm(value: str) -> time_cls:
    hour, minute = value.split(":")
    return time_cls(int(hour), int(minute))


def _to_minutes(t: time_cls) -> int:
    return t.hour * 60 + t.minute


def _to_hhmm(minutes: int) -> str:
    minutes = minutes % (24 * 60)
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_deadline(value: str | None) -> date_cls | None:
    if not value:
        return None
    return date_cls.fromisoformat(value[:10])


def _item_to_dict(item: PlannerItem) -> dict:
    return {
        "id": item.id,
        "mode": item.mode.value,
        "title": item.title,
        "details": item.details,
        "hours_needed": item.hours_needed,
        "deadline": item.deadline.isoformat() if item.deadline else None,
        "status": item.status.value,
        "created_at": item.created_at.isoformat(),
    }


async def add_planner_item(
    mode: str,
    title: str,
    hours_needed: float | None = None,
    deadline: str | None = None,
) -> dict:
    """Add a plan item (a task/goal to schedule) in a given planning mode.

    Args:
      mode: One of "daily", "weekly", "monthly" — which plan this belongs to.
      title: Short, clear description of the task/goal.
      hours_needed: Estimated hours this will take, or null if unknown.
      deadline: ISO date (YYYY-MM-DD) this needs to be done by, or null.

    Returns:
      The created item, or an {"error": ...} dict if mode is invalid.

    When building a weekly/monthly plan: after the user has described what
    they need to do and their available hours/day, work out a day-by-day (or
    week-by-week) breakdown that fits their deadline and hours/day
    constraint, and call this tool once per row of that plan so it's saved
    and shows up in the plan table.
    """
    try:
        mode_enum = PlannerMode(mode)
    except ValueError:
        return {
            "error": f"invalid mode '{mode}'. Must be one of: daily, weekly, monthly."
        }

    async with AsyncSessionLocal() as db:
        item = PlannerItem(
            mode=mode_enum,
            title=title,
            hours_needed=hours_needed,
            deadline=_parse_deadline(deadline),
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return _item_to_dict(item)


async def list_planner_items(mode: str, status: str | None = None) -> list[dict] | dict:
    """List plan items for a given mode, optionally filtered by status.

    Args:
      mode: One of "daily", "weekly", "monthly".
      status: Filter to "pending" or "done", or null for both.

    Returns:
      A list of items (oldest first), or an {"error": ...} dict.
    """
    try:
        mode_enum = PlannerMode(mode)
    except ValueError:
        return {
            "error": f"invalid mode '{mode}'. Must be one of: daily, weekly, monthly."
        }

    status_enum = None
    if status is not None:
        try:
            status_enum = PlannerStatus(status)
        except ValueError:
            return {
                "error": f"invalid status '{status}'. Must be one of: pending, done."
            }

    async with AsyncSessionLocal() as db:
        stmt = (
            select(PlannerItem)
            .where(PlannerItem.mode == mode_enum)
            .order_by(PlannerItem.created_at.asc())
        )
        if status_enum is not None:
            stmt = stmt.where(PlannerItem.status == status_enum)
        result = await db.execute(stmt)
        return [_item_to_dict(i) for i in result.scalars().all()]


async def mark_planner_item_done(item_id: int) -> dict:
    """Mark a plan item as done.

    Args:
      item_id: id of the item to mark done.

    Returns:
      The updated item, or an {"error": ...} dict if it doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        item = await db.get(PlannerItem, item_id)
        if item is None:
            return {"error": f"planner item {item_id} not found"}
        item.status = PlannerStatus.done
        await db.commit()
        await db.refresh(item)
        return _item_to_dict(item)


async def compute_daily_schedule() -> dict:
    """Compute today's free time blocks and a suggested time-blocked schedule.

    Reads the user's fixed daily commitments (wake time, sleep time, meal
    times) from their profile, and today's pending daily-mode plan items,
    then slots those tasks into the gaps between commitments — earliest
    free time first, in the order the tasks were added.

    Present the returned schedule to the user as a simple time-blocked list
    (e.g. "07:00-08:00 Free time", "08:00-08:30 Breakfast", ...).

    Returns:
      {"free_blocks": [{"start","end"}...],
       "schedule": [{"start","end","activity"}...],
       "unscheduled": [task titles that didn't fit today]}
    """
    async with AsyncSessionLocal() as db:
        profile = await db.get(UserProfile, 1)
        stmt = (
            select(PlannerItem)
            .where(PlannerItem.mode == PlannerMode.daily)
            .where(PlannerItem.status == PlannerStatus.pending)
            .order_by(PlannerItem.created_at.asc())
        )
        result = await db.execute(stmt)
        task_queue = list(result.scalars().all())

    wake = (
        _to_minutes(_parse_hhmm(profile.wake_time))
        if profile
        else _to_minutes(time_cls(7, 0))
    )
    sleep = (
        _to_minutes(_parse_hhmm(profile.sleep_time))
        if profile
        else _to_minutes(time_cls(23, 0))
    )
    meal_times = profile.meal_times if profile and profile.meal_times else {}

    busy_blocks: list[tuple[int, int, str]] = []
    for label, hhmm in meal_times.items():
        try:
            start = _to_minutes(_parse_hhmm(hhmm))
        except (ValueError, AttributeError):
            continue
        busy_blocks.append(
            (start, start + MEAL_DURATION_MINUTES, label.replace("_", " ").capitalize())
        )

    # Clip fixed commitments to the wake/sleep window and sort chronologically.
    busy_blocks = sorted(
        (max(s, wake), min(e, sleep), label)
        for s, e, label in busy_blocks
        if e > wake and s < sleep
    )

    free_blocks: list[list[int]] = []
    cursor = wake
    for start, end, _label in busy_blocks:
        if start > cursor:
            free_blocks.append([cursor, start])
        cursor = max(cursor, end)
    if cursor < sleep:
        free_blocks.append([cursor, sleep])

    schedule_entries: list[tuple[int, int, str]] = list(busy_blocks)
    for block_start, block_end in free_blocks:
        cursor = block_start
        while task_queue:
            task = task_queue[0]
            hours = task.hours_needed if task.hours_needed else DEFAULT_TASK_HOURS
            duration = max(MIN_TASK_MINUTES, round(hours * 60))
            if cursor + duration > block_end:
                break
            schedule_entries.append((cursor, cursor + duration, task.title))
            cursor += duration
            task_queue.pop(0)
        if cursor < block_end:
            schedule_entries.append((cursor, block_end, "Free time"))

    schedule_entries.sort(key=lambda e: e[0])

    return {
        "free_blocks": [
            {"start": _to_hhmm(s), "end": _to_hhmm(e)} for s, e in free_blocks
        ],
        "schedule": [
            {"start": _to_hhmm(s), "end": _to_hhmm(e), "activity": a}
            for s, e, a in schedule_entries
        ],
        "unscheduled": [t.title for t in task_queue],
    }


TOOLS = [
    add_planner_item,
    list_planner_items,
    mark_planner_item_done,
    compute_daily_schedule,
]
SUB_AGENTS = []
