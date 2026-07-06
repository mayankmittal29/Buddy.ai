from app.common.habits import get_habit_streaks, set_habit_today
from app.common.scheduler import check_habit_milestone
from app.core.db import AsyncSessionLocal
from app.core.models import Habit
from sqlalchemy import select


def _habit_to_dict(habit: Habit) -> dict:
    return {
        "id": habit.id,
        "title": habit.title,
        "description": habit.description,
        "last_done": habit.last_done.isoformat() if habit.last_done else None,
        "times_done": habit.times_done,
    }


async def add_habit(title: str, description: str | None = None) -> dict:
    """Add a new habit to track.

    Args:
      title: Name of the habit (e.g. "Daily painting practice").
      description: Optional extra detail about the habit, or null.

    Returns:
      The created habit.
    """
    async with AsyncSessionLocal() as db:
        habit = Habit(title=title, description=description)
        db.add(habit)
        await db.commit()
        await db.refresh(habit)
        return _habit_to_dict(habit)


async def list_habits() -> list[dict]:
    """List all tracked habits, to look up an id by title.

    Returns:
      A list of habits with id, title, description, last_done, times_done.
    """
    async with AsyncSessionLocal() as db:
        stmt = select(Habit).order_by(Habit.created_at.asc())
        result = await db.execute(stmt)
        return [_habit_to_dict(h) for h in result.scalars().all()]


async def log_habit_done(habit_id: int, done: bool = True) -> dict:
    """Set today's log for a habit to a done/not-done state.

    Args:
      habit_id: id of the habit to log.
      done: True if completed today, False if explicitly not done today.

    Returns:
      {"habit", "log_date", "done", "current_streak", "longest_streak"}, or
      an {"error": ...} dict if the habit doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        habit = await db.get(Habit, habit_id)
        if habit is None:
            return {"error": f"habit {habit_id} not found"}

        log = await set_habit_today(db, habit, done)
        current_streak, longest_streak = await get_habit_streaks(db, habit_id)
        await check_habit_milestone(db, habit, current_streak)

        await db.commit()
        return {
            "habit": habit.title,
            "log_date": log.log_date.isoformat(),
            "done": log.done,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
        }


async def get_habit_streak(habit_id: int) -> dict:
    """Get a habit's current and longest streak.

    Args:
      habit_id: id of the habit.

    Returns:
      {"habit", "current_streak", "longest_streak"}, or an {"error": ...}
      dict if the habit doesn't exist.
    """
    async with AsyncSessionLocal() as db:
        habit = await db.get(Habit, habit_id)
        if habit is None:
            return {"error": f"habit {habit_id} not found"}
        current_streak, longest_streak = await get_habit_streaks(db, habit_id)
        return {
            "habit": habit.title,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
        }


TOOLS = [add_habit, list_habits, log_habit_done, get_habit_streak]
