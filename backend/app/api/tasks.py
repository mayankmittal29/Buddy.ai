from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.models import Task, TaskPriority, TaskStatus

router = APIRouter()


class TaskCreate(BaseModel):
    title: str
    notes: str | None = None
    priority: TaskPriority = TaskPriority.normal
    due_at: datetime | None = None
    recurrence_rule: str | None = None
    status: TaskStatus = TaskStatus.pending
    reminder_sent: bool = False


class TaskUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    priority: TaskPriority | None = None
    due_at: datetime | None = None
    recurrence_rule: str | None = None
    status: TaskStatus | None = None
    reminder_sent: bool | None = None


class TaskOut(BaseModel):
    id: int
    title: str
    notes: str | None
    priority: TaskPriority
    due_at: datetime | None
    recurrence_rule: str | None
    status: TaskStatus
    reminder_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/tasks", response_model=list[TaskOut])
async def list_tasks(
    status: TaskStatus | None = None, priority: TaskPriority | None = None
) -> list[Task]:
    async with AsyncSessionLocal() as db:
        stmt = select(Task).order_by(Task.created_at.desc())
        if status is not None:
            stmt = stmt.where(Task.status == status)
        if priority is not None:
            stmt = stmt.where(Task.priority == priority)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.post("/api/tasks", response_model=TaskOut, status_code=201)
async def create_task(data: TaskCreate) -> Task:
    async with AsyncSessionLocal() as db:
        task = Task(**data.model_dump())
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task


@router.patch("/api/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, data: TaskUpdate) -> Task:
    async with AsyncSessionLocal() as db:
        task = await db.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail=f"task {task_id} not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        await db.commit()
        await db.refresh(task)
        return task


@router.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int) -> None:
    async with AsyncSessionLocal() as db:
        task = await db.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail=f"task {task_id} not found")
        await db.delete(task)
        await db.commit()
