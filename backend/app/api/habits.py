from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select

from app.common.habits import compute_streaks, get_habit_streaks, toggle_habit_today
from app.common.scheduler import check_habit_milestone
from app.core.db import AsyncSessionLocal
from app.core.models import Habit, HabitLog

router = APIRouter()

DEFAULT_HEATMAP_DAYS = 90


class HabitCreate(BaseModel):
    title: str
    description: str | None = None


class HabitLogOut(BaseModel):
    log_date: date
    done: bool

    model_config = {"from_attributes": True}


class HabitOut(BaseModel):
    id: int
    title: str
    description: str | None
    created_at: datetime
    last_done: date | None
    times_done: int
    current_streak: int
    longest_streak: int
    logs: list[HabitLogOut]

    model_config = {"from_attributes": True}


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int


async def _habit_to_out(db, habit: Habit, days: int = DEFAULT_HEATMAP_DAYS) -> HabitOut:
    stmt = (
        select(HabitLog)
        .where(
            HabitLog.habit_id == habit.id,
            HabitLog.log_date >= date.today() - timedelta(days=days),
        )
        .order_by(HabitLog.log_date.asc())
    )
    result = await db.execute(stmt)
    logs = list(result.scalars().all())

    all_done_stmt = select(HabitLog.log_date).where(
        HabitLog.habit_id == habit.id, HabitLog.done.is_(True)
    )
    all_done_result = await db.execute(all_done_stmt)
    current_streak, longest_streak = compute_streaks(
        [row[0] for row in all_done_result.all()]
    )

    return HabitOut(
        id=habit.id,
        title=habit.title,
        description=habit.description,
        created_at=habit.created_at,
        last_done=habit.last_done,
        times_done=habit.times_done,
        current_streak=current_streak,
        longest_streak=longest_streak,
        logs=[HabitLogOut.model_validate(log) for log in logs],
    )


@router.get("/api/habits", response_model=list[HabitOut])
async def list_habits(days: int = DEFAULT_HEATMAP_DAYS) -> list[HabitOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(Habit).order_by(Habit.created_at.asc())
        result = await db.execute(stmt)
        habits = result.scalars().all()
        return [await _habit_to_out(db, habit, days) for habit in habits]


@router.post("/api/habits", response_model=HabitOut, status_code=201)
async def create_habit(data: HabitCreate) -> HabitOut:
    async with AsyncSessionLocal() as db:
        habit = Habit(title=data.title, description=data.description)
        db.add(habit)
        await db.commit()
        await db.refresh(habit)
        return await _habit_to_out(db, habit)


@router.post("/api/habits/{habit_id}/toggle", response_model=HabitOut)
async def toggle_habit(habit_id: int) -> HabitOut:
    async with AsyncSessionLocal() as db:
        habit = await db.get(Habit, habit_id)
        if habit is None:
            raise HTTPException(status_code=404, detail=f"habit {habit_id} not found")

        await toggle_habit_today(db, habit)
        current_streak, _ = await get_habit_streaks(db, habit_id)
        await check_habit_milestone(db, habit, current_streak)

        await db.commit()
        await db.refresh(habit)
        return await _habit_to_out(db, habit)


@router.get("/api/habits/{habit_id}/streak", response_model=StreakOut)
async def get_streak(habit_id: int) -> StreakOut:
    async with AsyncSessionLocal() as db:
        habit = await db.get(Habit, habit_id)
        if habit is None:
            raise HTTPException(status_code=404, detail=f"habit {habit_id} not found")
        current_streak, longest_streak = await get_habit_streaks(db, habit_id)
        return StreakOut(current_streak=current_streak, longest_streak=longest_streak)


@router.delete("/api/habits/{habit_id}", status_code=204)
async def delete_habit(habit_id: int) -> None:
    async with AsyncSessionLocal() as db:
        habit = await db.get(Habit, habit_id)
        if habit is None:
            raise HTTPException(status_code=404, detail=f"habit {habit_id} not found")
        await db.execute(delete(HabitLog).where(HabitLog.habit_id == habit_id))
        await db.delete(habit)
        await db.commit()
