import enum
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
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


class CourseStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    done = "done"


class CertificationStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus, name="course_status"), default=CourseStatus.planned
    )
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Position in the AI-generated roadmap ordering (1-based), and why it was
    # placed there — both set by the generate_learning_roadmap tool.
    roadmap_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roadmap_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Dedup flags so the scheduler emails each nudge once per occurrence
    # rather than every tick — reset to False whenever the row is next
    # meaningfully touched (see app/api/learning.py).
    deadline_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    inactivity_nudge_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    issuer: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_received: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[CertificationStatus] = mapped_column(
        Enum(CertificationStatus, name="certification_status"),
        default=CertificationStatus.pending,
    )
    credential_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    credential_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # Cloudinary secure_url of the uploaded certificate image/PDF, if any —
    # only the URL is persisted here, the file itself lives in Cloudinary.
    file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_type: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # "image" or "pdf"
    # Cloudinary's public_id + the resource_type it auto-detected — needed to
    # destroy() the file later (on delete, or when it's replaced by a new
    # upload). Without these, deleting/replacing a cert leaves the old file
    # orphaned in Cloudinary forever.
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_resource_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    inactivity_nudge_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class RevisionItem(Base):
    __tablename__ = "revision_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_review_at: Mapped[date] = mapped_column(Date)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class JobApplicationStatus(str, enum.Enum):
    just_found = "just_found"
    applied = "applied"
    interview = "interview"
    offer = "offer"
    rejected = "rejected"
    withdrawn = "withdrawn"


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(Text)
    version_label: Mapped[str] = mapped_column(Text)
    # Cloudinary secure_url or R2 public URL — the file itself lives in
    # object storage, only the URL is persisted here.
    file_path: Mapped[str] = mapped_column(Text)
    # Which backend actually holds the file, plus whatever identifier that
    # backend needs to delete it later (Cloudinary public_id, or R2 object
    # key) — without these, deleting a Resume row can't clean up the
    # underlying file and it becomes storage-provider clutter forever.
    storage_provider: Mapped[str] = mapped_column(Text, server_default="cloudinary")
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_resource_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class Notification(Base):
    """An in-app notification event (task due soon, course deadline,
    inactivity nudge, etc.) — created by the scheduler alongside (not
    instead of) an email, so the in-app feed still has a history even for
    users who haven't opted into email. `source_skill`/`source_id` point
    back at whatever row triggered it (e.g. the Task), for a future
    "jump to it" link — nullable since not every notification need have one."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    source_skill: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    date_applied: Mapped[date | None] = mapped_column(Date, nullable=True)
    ctc: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    referral_taken_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[JobApplicationStatus] = mapped_column(
        Enum(JobApplicationStatus, name="job_application_status"),
        default=JobApplicationStatus.applied,
    )
    # Free text (not an enum) so the fixed option list can grow later
    # without a migration — same precedent as Expense.category.
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    hr_contact: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_done: Mapped[date | None] = mapped_column(Date, nullable=True)
    times_done: Mapped[int] = mapped_column(Integer, default=0)
    # Highest streak milestone (10/30/50/100 — see app/common/scheduler.py)
    # already notified for, so a congratulatory notification fires once per
    # milestone rather than on every subsequent day. Reset to 0 whenever the
    # streak drops below it, so reaching the same milestone again after a
    # break notifies again.
    last_milestone_notified: Mapped[int] = mapped_column(Integer, default=0)


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (
        UniqueConstraint("habit_id", "log_date", name="uq_habit_logs_habit_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id"))
    log_date: Mapped[date] = mapped_column(Date)
    done: Mapped[bool] = mapped_column(Boolean, default=True)


class BillingCycle(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    spent_at: Mapped[date] = mapped_column(Date, server_default=func.current_date())


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(Text, unique=True)
    monthly_limit: Mapped[float] = mapped_column(Float)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Float)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        Enum(BillingCycle, name="billing_cycle"), default=BillingCycle.monthly
    )
    next_charge_at: Mapped[date] = mapped_column(Date)


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    target_amount: Mapped[float] = mapped_column(Float)
    current_amount: Mapped[float] = mapped_column(Float, default=0)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class SavingsEntry(Base):
    """A logged, already-completed saving — distinct from SavingsGoal (which
    tracks progress toward a target amount): this is a simple ledger of
    "I saved X on this date" entries the user records directly."""

    __tablename__ = "savings_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Float)
    saved_at: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class NewsCategory(str, enum.Enum):
    ai = "ai"
    tech = "tech"
    github = "github"
    research = "research"
    startup = "startup"
    jobs = "jobs"


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[NewsCategory] = mapped_column(
        Enum(NewsCategory, name="news_category")
    )
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text, unique=True)
    source: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Not part of the original spec's column list, but needed for the "tick
    # to mark read" / "star to keep" UI features — read has no other
    # behavioral effect, starred exempts an item from the 3-day retention
    # cleanup (see app/common/news.py:cleanup_old_news).
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    starred: Mapped[bool] = mapped_column(Boolean, default=False)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    # Nullable — a link-based document (source_url set, text pasted by the
    # user instead of an uploaded file) has no stored file of its own.
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Same Cloudinary/R2 cleanup-on-delete metadata as Resume/Certification
    # (app/api/career.py, app/api/learning.py) — without these, deleting a
    # PDF-backed document would leave the file orphaned in storage forever.
    storage_provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_resource_type: Mapped[str | None] = mapped_column(Text, nullable=True)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    chunk_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(768))
    chunk_index: Mapped[int] = mapped_column(Integer)
