from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.core.db import AsyncSessionLocal
from app.core.models import Conversation, Message

router = APIRouter()


class ConversationOut(BaseModel):
    id: int
    title: str
    mode: str | None
    created_at: datetime
    message_count: int


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post(
    "/api/skills/{skill_id}/conversations",
    response_model=ConversationOut,
    status_code=201,
)
async def create_conversation(skill_id: str, mode: str | None = None) -> ConversationOut:
    """Create an empty conversation up front (e.g. "Start new conversation" in
    the UI) so it shows up in the list immediately, before any message is
    sent. Its title is a placeholder until the opening exchange summarizes it.

    `mode` scopes it for skills with sub-modes (e.g. planner's
    daily/weekly/monthly) so each mode's conversation list stays independent.
    """
    async with AsyncSessionLocal() as db:
        conversation = Conversation(skill_id=skill_id, mode=mode, title="New chat")
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        return ConversationOut(
            id=conversation.id,
            title=conversation.title,
            mode=conversation.mode,
            created_at=conversation.created_at,
            message_count=0,
        )


@router.get(
    "/api/skills/{skill_id}/conversations", response_model=list[ConversationOut]
)
async def list_conversations(skill_id: str, mode: str | None = None) -> list[ConversationOut]:
    async with AsyncSessionLocal() as db:
        last_message_at = (
            select(func.max(Message.created_at))
            .where(Message.conversation_id == Conversation.id)
            .correlate(Conversation)
            .scalar_subquery()
        )
        message_count = (
            select(func.count(Message.id))
            .where(Message.conversation_id == Conversation.id)
            .correlate(Conversation)
            .scalar_subquery()
        )
        stmt = (
            select(Conversation, message_count)
            .where(Conversation.skill_id == skill_id)
            .order_by(func.coalesce(last_message_at, Conversation.created_at).desc())
        )
        if mode is not None:
            stmt = stmt.where(Conversation.mode == mode)
        result = await db.execute(stmt)
        return [
            ConversationOut(
                id=conv.id,
                title=conv.title,
                mode=conv.mode,
                created_at=conv.created_at,
                message_count=count,
            )
            for conv, count in result.all()
        ]


@router.get(
    "/api/skills/{skill_id}/conversations/{conversation_id}/messages",
    response_model=list[MessageOut],
)
async def get_conversation_messages(
    skill_id: str, conversation_id: int
) -> list[Message]:
    async with AsyncSessionLocal() as db:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None or conversation.skill_id != skill_id:
            raise HTTPException(status_code=404, detail="conversation not found")
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.delete(
    "/api/skills/{skill_id}/conversations/{conversation_id}", status_code=204
)
async def delete_conversation(skill_id: str, conversation_id: int) -> None:
    async with AsyncSessionLocal() as db:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None or conversation.skill_id != skill_id:
            raise HTTPException(status_code=404, detail="conversation not found")
        await db.execute(delete(Message).where(Message.conversation_id == conversation_id))
        await db.delete(conversation)
        await db.commit()
