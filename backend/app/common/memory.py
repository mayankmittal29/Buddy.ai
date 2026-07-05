from google import genai
from google.genai import types
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.models import MemoryFact

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    # Built lazily, with the key taken directly from settings — this module
    # must work standalone, without depending on some other module (e.g.
    # app.core.agent) having already propagated GEMINI_API_KEY into the
    # environment as a side effect of import order.
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


async def _embed(text: str, task_type: str) -> list[float]:
    response = await _get_client().aio.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=EMBEDDING_DIM, task_type=task_type
        ),
    )
    return response.embeddings[0].values


async def remember(fact: str, source_skill: str) -> str:
    """Remember an important, durable fact about the user, for any skill to recall later.

    Use this proactively whenever the user states something worth
    remembering long-term — a preference, routine, or recurring detail (e.g.
    "I go to the gym on Mondays and Thursdays", "I prefer dark mode") — not
    for one-off, transient details specific to the current turn.

    Args:
      fact: The fact to remember, written as a short, self-contained statement.
      source_skill: id of the skill active when this fact was observed.

    Returns:
      A short confirmation string.
    """
    embedding = await _embed(fact, task_type="RETRIEVAL_DOCUMENT")
    async with AsyncSessionLocal() as session:
        session.add(
            MemoryFact(content=fact, embedding=embedding, source_skill=source_skill)
        )
        await session.commit()
    return f"Remembered: {fact}"


async def recall(query: str, top_k: int = 5) -> list[dict]:
    """Recall previously remembered facts about the user relevant to a query.

    Use this whenever knowing something about the user's preferences,
    routines, or history — from any skill, past or present — would help
    answer the current request.

    Args:
      query: What you want to recall, e.g. "user's UI preferences".
      top_k: Maximum number of facts to return, ranked by relevance.

    Returns:
      A list of {content, source_skill, created_at} dicts, most relevant first.
    """
    embedding = await _embed(query, task_type="RETRIEVAL_QUERY")
    async with AsyncSessionLocal() as session:
        stmt = (
            select(MemoryFact)
            .order_by(MemoryFact.embedding.cosine_distance(embedding))
            .limit(top_k)
        )
        result = await session.execute(stmt)
        facts = result.scalars().all()
    return [
        {
            "content": f.content,
            "source_skill": f.source_skill,
            "created_at": f.created_at.isoformat(),
        }
        for f in facts
    ]
