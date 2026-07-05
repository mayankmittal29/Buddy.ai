import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.genai import types
from langsmith import trace
from pydantic import BaseModel
from sqlalchemy import select

from app.common.summarize import summarize_title
from app.core import tracing  # noqa: F401  (propagates LangSmith env vars on import)
from app.core.db import AsyncSessionLocal
from app.core.models import Conversation, Message
from app.core.session import (
    APP_NAME,
    DEFAULT_USER_ID,
    get_runner_for_skill,
    session_service,
)
from app.skills.loader import discover_skills, get_skill_instructions

router = APIRouter()

# Once a conversation has grown past this many exchanges (user+assistant
# pairs), its title is frozen — no point re-summarizing a long conversation
# on every turn.
MAX_TITLE_EXCHANGES = 10

# asyncio only holds a weak reference to a fire-and-forget task — with no
# other reference kept, it can be garbage-collected mid-execution. Keeping
# them here until they finish avoids that.
_background_tasks: set[asyncio.Task] = set()


def _fire_and_forget(coro) -> None:
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def _maybe_refresh_title(conversation_id: int) -> None:
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        result = await db.execute(stmt)
        messages = list(result.scalars().all())
        if len(messages) > MAX_TITLE_EXCHANGES * 2:
            return
        title = await summarize_title([(m.role, m.content) for m in messages])
        if not title:
            return
        conversation = await db.get(Conversation, conversation_id)
        if conversation is not None:
            conversation.title = title
            await db.commit()


class ChatRequest(BaseModel):
    conversation_id: int | None = None
    message: str
    # Only meaningful for skills with sub-modes (e.g. planner's
    # daily/weekly/monthly) — tags a newly created conversation with it, and
    # is surfaced to the model so it adapts behavior to the active mode.
    mode: str | None = None


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def _get_or_create_conversation(
    skill_id: str, conversation_id: int | None, message: str, mode: str | None
) -> Conversation:
    async with AsyncSessionLocal() as db:
        if conversation_id is not None:
            conversation = await db.get(Conversation, conversation_id)
            if conversation is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"conversation {conversation_id} not found",
                )
            if conversation.skill_id != skill_id:
                raise HTTPException(
                    status_code=400,
                    detail="conversation belongs to a different skill",
                )
            return conversation

        title = message if len(message) <= 60 else message[:57] + "..."
        conversation = Conversation(skill_id=skill_id, mode=mode, title=title)
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        return conversation


async def _persist_message(conversation_id: int, role: str, content: str) -> None:
    async with AsyncSessionLocal() as db:
        db.add(Message(conversation_id=conversation_id, role=role, content=content))
        await db.commit()


async def _stream_chat(
    skill_id: str, conversation_id: int, message: str, mode: str | None
) -> AsyncGenerator[str, None]:
    yield _sse({"type": "conversation", "conversation_id": conversation_id})

    # Namespaced by skill_id too (not just conversation_id) — conversation_id
    # is already globally unique, but this keeps ADK's short-term session
    # store explicitly scoped per skill as more skills grow their own chat
    # UIs, rather than relying on that global uniqueness implicitly.
    session_id = f"{skill_id}:{conversation_id}"
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=DEFAULT_USER_ID, session_id=session_id
    )
    if session is None:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=DEFAULT_USER_ID, session_id=session_id
        )

    # Scope this turn to skill_id: give the model that skill's on-demand
    # instructions directly, rather than relying on it to call
    # get_skill_instructions itself — the route already pins the skill.
    skill_instructions = get_skill_instructions(skill_id)
    mode_note = f" (mode: {mode})" if mode else ""
    new_message = types.Content(
        role="user",
        parts=[
            types.Part(text=f"Active skill: {skill_id}{mode_note}\n\n{skill_instructions}"),
            types.Part(text=message),
        ],
    )

    final_chunks: list[str] = []
    runner = get_runner_for_skill(skill_id)
    error_detail: str | None = None
    async with trace(
        "buddy_chat",
        run_type="chain",
        inputs={"message": message},
        metadata={"skill_id": skill_id, "conversation_id": conversation_id},
    ) as run:
        try:
            async for event in runner.run_async(
                user_id=DEFAULT_USER_ID,
                session_id=session_id,
                new_message=new_message,
                state_delta={"active_skill": skill_id},
                run_config=RunConfig(streaming_mode=StreamingMode.SSE),
            ):
                if not event.content or not event.content.parts:
                    continue
                text = "".join(part.text for part in event.content.parts if part.text)
                if not text:
                    continue
                if event.partial:
                    yield _sse({"type": "delta", "text": text})
                else:
                    final_chunks.append(text)
        except Exception as exc:
            error_detail = str(exc)

        final_text = "".join(final_chunks)
        run.end(outputs={"response": final_text, "error": error_detail})

    if error_detail is not None:
        yield _sse({"type": "error", "detail": error_detail})
        yield _sse({"type": "done"})
        return

    await _persist_message(conversation_id, "assistant", final_text)
    _fire_and_forget(_maybe_refresh_title(conversation_id))

    yield _sse({"type": "final", "text": final_text})
    yield _sse({"type": "done"})


@router.post("/api/skills/{skill_id}/chat")
async def chat(skill_id: str, body: ChatRequest) -> StreamingResponse:
    if skill_id not in discover_skills():
        raise HTTPException(status_code=404, detail=f"unknown skill_id '{skill_id}'")

    conversation = await _get_or_create_conversation(
        skill_id, body.conversation_id, body.message, body.mode
    )
    await _persist_message(conversation.id, "user", body.message)

    return StreamingResponse(
        _stream_chat(skill_id, conversation.id, body.message, body.mode),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
