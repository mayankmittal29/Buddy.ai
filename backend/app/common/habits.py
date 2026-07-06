"""Shared habit streak/logging logic — used by both the REST API
(app/api/habits.py) and the ADK chat tools (app/skills/habits/tools.py) so
the two surfaces can never disagree on how a streak or a toggle works.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Habit, HabitLog

# Streak lengths (in days) that trigger a congratulatory notification — see
# check_habit_milestone in app/common/scheduler.py.
MILESTONES = (10, 30, 50, 100)


def compute_streaks(done_dates: list[date]) -> tuple[int, int]:
    """(current_streak, longest_streak) from a habit's done log_dates.

    current_streak: consecutive done days ending today or yesterday (0 if
    neither today nor yesterday was logged done — a streak that hasn't been
    kept up "counts" through yesterday but not further back).
    longest_streak: the longest run of consecutive calendar days anywhere
    in the history.
    """
    if not done_dates:
        return 0, 0

    done_set = set(done_dates)
    today = date.today()

    if today in done_set:
        cursor: date | None = today
    elif (today - timedelta(days=1)) in done_set:
        cursor = today - timedelta(days=1)
    else:
        cursor = None

    current = 0
    while cursor is not None and cursor in done_set:
        current += 1
        cursor -= timedelta(days=1)

    longest = 0
    run = 0
    prev: date | None = None
    for d in sorted(done_set):
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        longest = max(longest, run)
        prev = d

    return current, longest


async def get_habit_streaks(db: AsyncSession, habit_id: int) -> tuple[int, int]:
    """Query a habit's done log_dates and compute (current, longest)."""
    stmt = (
        select(HabitLog.log_date)
        .where(HabitLog.habit_id == habit_id, HabitLog.done.is_(True))
        .order_by(HabitLog.log_date.asc())
    )
    result = await db.execute(stmt)
    return compute_streaks([row[0] for row in result.all()])


async def set_habit_today(db: AsyncSession, habit: Habit, done: bool) -> HabitLog:
    """Set today's log for a habit to an explicit done state — creates the
    row if missing. Recomputes last_done/times_done from the actual log
    rows afterward (rather than incrementing/decrementing) so setting it
    back to False can't leave them out of sync with an earlier done day.
    Does not commit — caller's responsibility, so it can be combined with a
    milestone check in the same transaction.
    """
    today = date.today()
    stmt = select(HabitLog).where(
        HabitLog.habit_id == habit.id, HabitLog.log_date == today
    )
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()

    if log is None:
        log = HabitLog(habit_id=habit.id, log_date=today, done=done)
        db.add(log)
    else:
        log.done = done
    await db.flush()

    count_stmt = (
        select(func.count())
        .select_from(HabitLog)
        .where(HabitLog.habit_id == habit.id, HabitLog.done.is_(True))
    )
    habit.times_done = (await db.execute(count_stmt)).scalar_one()

    last_done_stmt = select(func.max(HabitLog.log_date)).where(
        HabitLog.habit_id == habit.id, HabitLog.done.is_(True)
    )
    habit.last_done = (await db.execute(last_done_stmt)).scalar_one_or_none()

    return log


async def toggle_habit_today(db: AsyncSession, habit: Habit) -> HabitLog:
    """Flip today's log for a habit — creates it done=True if missing,
    otherwise flips the existing row's done. See set_habit_today for the
    last_done/times_done recompute behavior. Does not commit.
    """
    today = date.today()
    stmt = select(HabitLog).where(
        HabitLog.habit_id == habit.id, HabitLog.log_date == today
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    new_done = not existing.done if existing is not None else True
    return await set_habit_today(db, habit, new_done)
