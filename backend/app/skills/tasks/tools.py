from datetime import datetime

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.models import Task, TaskPriority, TaskStatus


def _parse_due_at(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


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
    title: str, priority: str, due_at: str | None, recurrence_rule: str | None = None
) -> dict:
    """Create a new task for the user.

    Args:
      title: Short, clear description of the task.
      priority: One of "urgent", "normal", "light".
      due_at: ISO 8601 datetime the task is due, or null if there's no due date.
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

    async with AsyncSessionLocal() as db:
        task = Task(
            title=title,
            priority=priority_enum,
            due_at=_parse_due_at(due_at),
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


TOOLS = [create_task, list_tasks, complete_task, delete_task]
SUB_AGENTS = []
