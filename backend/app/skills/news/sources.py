"""Fetchers for the News skill's daily digest — each hits a real, free
public source and returns a normalized list of
{title, url, source, published_at, raw_summary}. No API keys required for
any of these three.
"""

import asyncio
from datetime import datetime, timezone

# defusedxml, not stdlib xml.etree — arXiv's response is external content
# (see docs/guardrails/news.SKILL.md's risk notes); stdlib XML parsing is
# vulnerable to XXE/billion-laughs attacks if a response is ever malicious
# (a compromised/MITM'd arxiv.org, however unlikely). defusedxml.ElementTree
# is a drop-in-compatible replacement with those features disabled.
import defusedxml.ElementTree as ET
import httpx
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (compatible; BuddyNewsBot/1.0; +https://github.com)"
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


async def fetch_arxiv(query: str = "cat:cs.AI", max_results: int = 3) -> list[dict]:
    """Recent arXiv papers matching `query` (arXiv search syntax, e.g.
    "cat:cs.AI" or "cat:cs.LG"), newest first, via arXiv's public Atom API
    (https://export.arxiv.org/api_help) — no API key needed."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.get(
            "http://export.arxiv.org/api/query",
            params={
                "search_query": query,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
                "max_results": max_results,
            },
        )
        response.raise_for_status()

    root = ET.fromstring(response.text)
    items = []
    for entry in root.findall("atom:entry", ATOM_NS):
        title_el = entry.find("atom:title", ATOM_NS)
        summary_el = entry.find("atom:summary", ATOM_NS)
        published_el = entry.find("atom:published", ATOM_NS)
        link = next(
            (
                l.get("href")
                for l in entry.findall("atom:link", ATOM_NS)
                if l.get("rel") == "alternate"
            ),
            None,
        )
        if title_el is None or title_el.text is None or link is None:
            continue
        items.append(
            {
                "title": " ".join(title_el.text.split()),
                "url": link,
                "source": "arxiv",
                "published_at": (
                    datetime.fromisoformat(published_el.text.replace("Z", "+00:00"))
                    if published_el is not None and published_el.text
                    else datetime.now(timezone.utc)
                ),
                "raw_summary": (
                    " ".join(summary_el.text.split())
                    if summary_el is not None and summary_el.text
                    else ""
                ),
            }
        )
    return items


async def fetch_github_trending(language: str | None = None) -> list[dict]:
    """Today's trending GitHub repositories (optionally filtered by
    language), scraped from github.com/trending — GitHub has no official
    trending API. published_at is "now" for all rows since the trending
    page itself carries no per-repo timestamp."""
    url = (
        f"https://github.com/trending/{language}"
        if language
        else "https://github.com/trending"
    )
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        response = await client.get(url, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    now = datetime.now(timezone.utc)
    items = []
    for article in soup.select("article.Box-row"):
        heading = article.select_one("h2 a")
        href = heading.get("href") if heading else None
        if not href:
            continue
        repo_path = href.strip("/")
        desc_el = article.select_one("p")
        items.append(
            {
                "title": repo_path,
                "url": f"https://github.com/{repo_path}",
                "source": "github",
                "published_at": now,
                "raw_summary": desc_el.get_text(strip=True) if desc_el else "",
            }
        )
    return items


async def fetch_hackernews_top(max_results: int = 30) -> list[dict]:
    """Top Hacker News stories via the official public Firebase API
    (https://github.com/HackerNews/API) — no API key needed."""
    async with httpx.AsyncClient(timeout=10) as client:
        top_ids_response = await client.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json"
        )
        top_ids_response.raise_for_status()
        story_ids = top_ids_response.json()[:max_results]

        raw_items = await asyncio.gather(
            *(
                client.get(
                    f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
                )
                for story_id in story_ids
            )
        )

    items = []
    for story_id, item_response in zip(story_ids, raw_items):
        item_response.raise_for_status()
        item = item_response.json()
        if not item or item.get("type") != "story" or not item.get("title"):
            continue
        items.append(
            {
                "title": item["title"],
                "url": item.get("url")
                or f"https://news.ycombinator.com/item?id={story_id}",
                "source": "hackernews",
                "published_at": (
                    datetime.fromtimestamp(item["time"], tz=timezone.utc)
                    if item.get("time")
                    else datetime.now(timezone.utc)
                ),
                "raw_summary": item.get("text")
                or f"{item.get('score', 0)} points on Hacker News",
            }
        )
    return items
