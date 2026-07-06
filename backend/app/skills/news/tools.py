from app.common.news import generate_daily_digest as _generate_daily_digest
from app.common.news import search_news_items as _search_news_items
from app.core.db import AsyncSessionLocal


async def generate_daily_digest() -> dict:
    """Fetch fresh news from arXiv, GitHub Trending, and Hacker News, and
    store any new items (deduplicated against what's already stored). Only
    call this if the user explicitly asks to refresh/fetch new news right
    now — the digest already runs automatically once a day.

    Returns:
      {"added": total new items stored, "by_category": {category: count}}.
    """
    async with AsyncSessionLocal() as db:
        result = await _generate_daily_digest(db)
        await db.commit()
        return result


async def search_news_items(
    category: str | None = None, query: str | None = None
) -> list[dict]:
    """Search the already-stored news digest — use this to answer questions
    about news instead of fetching live, so answers are grounded in what's
    actually in the digest.

    Args:
      category: Filter to one of ai/tech/github/research/startup/jobs, or
        null for all categories.
      query: Free-text to match against title/summary (substring, case-
        insensitive), or null to not filter by text.

    Returns:
      A list of {id, category, title, url, source, summary, published_at},
      most recently published first.
    """
    async with AsyncSessionLocal() as db:
        items = await _search_news_items(db, category=category, query=query)
        return [
            {
                "id": item.id,
                "category": item.category.value,
                "title": item.title,
                "url": item.url,
                "source": item.source,
                "summary": item.summary,
                "published_at": item.published_at.isoformat(),
            }
            for item in items
        ]


TOOLS = [generate_daily_digest, search_news_items]
