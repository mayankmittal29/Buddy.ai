from pathlib import Path

from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.genai import types

from app.core.agent import get_agent_for_skill, root_agent

APP_NAME = "buddy"
DEFAULT_USER_ID = "default-user"

_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "sessions.db"
_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ADK's own session store: short-term, per-conversation scratchpad state
# (turn history, session.state). Kept separate from the app's own Postgres
# schema (conversations/messages tables), which is the durable, user-facing
# record — this SQLite db is ADK's internal working memory. Shared across
# all per-skill runners below, so conversation history stays intact
# regardless of which skill's tool-scoped agent handles a given turn.
session_service = DatabaseSessionService(db_url=f"sqlite+aiosqlite:///{_DB_PATH}")

runner = Runner(app_name=APP_NAME, agent=root_agent, session_service=session_service)

_runner_cache: dict[str, Runner] = {}


def get_runner_for_skill(skill_id: str) -> Runner:
    """Return the Runner to use for a given skill_id.

    Skills with their own tools.py get a Runner around a dedicated,
    tool-scoped agent (see get_agent_for_skill); others share the base
    runner. All runners share the same session_service.
    """
    agent = get_agent_for_skill(skill_id)
    if agent is root_agent:
        return runner

    if skill_id not in _runner_cache:
        _runner_cache[skill_id] = Runner(
            app_name=APP_NAME, agent=agent, session_service=session_service
        )
    return _runner_cache[skill_id]


async def run_turn(
    conversation_id: str, message: str, user_id: str = DEFAULT_USER_ID
) -> str:
    """Run one turn of a conversation, keyed by conversation_id.

    conversation_id maps 1:1 to an ADK session_id, so prior turns and any
    scratchpad state are visible on every call sharing the same
    conversation_id, but never leak into a different conversation_id.
    """
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=conversation_id
    )
    if session is None:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=conversation_id
        )

    reply = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=conversation_id,
        new_message=types.Content(role="user", parts=[types.Part(text=message)]),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    reply += part.text
    return reply
