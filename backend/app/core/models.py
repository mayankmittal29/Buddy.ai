import enum
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, Float, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class TaskPriority(str, enum.Enum):
    urgent = "urgent"
    normal = "normal"
    light = "light"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    done = "done"


class PlannerMode(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class PlannerStatus(str, enum.Enum):
    pending = "pending"
    done = "done"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    skill_id: Mapped[str] = mapped_column(Text)
    # Only used by skills with sub-modes (e.g. planner's daily/weekly/monthly)
    # so each mode gets its own independent conversation list. Null for
    # skills without sub-modes.
    mode: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    messages: Mapped[list["Message"]] = relationship(back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class MemoryFact(Base):
    __tablename__ = "memory_facts"

    id: Mapped[int] = mapped_column(primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(768))
    source_skill: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserProfile(Base):
    """Single-row user profile (no auth/multi-user support yet)."""

    __tablename__ = "user_profile"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, default="")
    # Cloudinary secure_url of the uploaded profile picture, if any.
    avatar_url: Mapped[str] = mapped_column(Text, default="")
    timezone: Mapped[str] = mapped_column(Text, default="UTC")
    wake_time: Mapped[str] = mapped_column(Text, default="07:00")
    sleep_time: Mapped[str] = mapped_column(Text, default="23:00")
    # e.g. {"breakfast": "08:00", "lunch": "13:00", "dinner": "19:30"}
    meal_times: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    work_start: Mapped[str] = mapped_column(Text, default="09:00")
    work_end: Mapped[str] = mapped_column(Text, default="17:00")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class NotificationPreferences(Base):
    """Single-row, global notification preferences (no auth yet).

    `channels` gates whether we're actually allowed to send anything on that
    channel — the human-in-the-loop opt-in. Defaults to all off; the
    scheduler must never send until the user explicitly enables a channel
    from the Profile page.
    """

    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    email_address: Mapped[str] = mapped_column(Text, default="")
    # e.g. {"email": False}
    channels: Mapped[dict[str, bool]] = mapped_column(
        JSON, default=lambda: {"email": False}
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority"), default=TaskPriority.normal
    )
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recurrence_rule: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status"), default=TaskStatus.pending
    )
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlannerItem(Base):
    __tablename__ = "planner_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    mode: Mapped[PlannerMode] = mapped_column(Enum(PlannerMode, name="planner_mode"))
    title: Mapped[str] = mapped_column(Text)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    hours_needed: Mapped[float | None] = mapped_column(Float, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[PlannerStatus] = mapped_column(
        Enum(PlannerStatus, name="planner_status"), default=PlannerStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
