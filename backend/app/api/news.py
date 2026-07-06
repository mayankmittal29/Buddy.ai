from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.common.news import generate_daily_digest, set_news_starred
from app.core.db import AsyncSessionLocal
from app.core.models import NewsCategory, NewsItem

router = APIRouter(prefix="/api/news")


class NewsItemOut(BaseModel):
    id: int
    category: NewsCategory
    title: str
    url: str
    source: str
    summary: str
    published_at: datetime
    fetched_at: datetime
    read: bool
    starred: bool

    model_config = {"from_attributes": True}


class NewsItemUpdate(BaseModel):
    read: bool | None = None
    starred: bool | None = None


@router.get("", response_model=list[NewsItemOut])
async def list_news(
    category: str | None = None,
    starred: bool | None = None,
    days: int | None = None,
    limit: int = 200,
) -> list[NewsItemOut]:
    async with AsyncSessionLocal() as db:
        stmt = select(NewsItem).order_by(NewsItem.published_at.desc()).limit(limit)
        if category:
            try:
                stmt = stmt.where(NewsItem.category == NewsCategory(category))
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"unknown category '{category}'"
                )
        if starred is not None:
            stmt = stmt.where(NewsItem.starred.is_(starred))
        if days is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            stmt = stmt.where(NewsItem.published_at >= cutoff)
        result = await db.execute(stmt)
        return list(result.scalars().all())


@router.patch("/{item_id}", response_model=NewsItemOut | None)
async def update_news_item(item_id: int, data: NewsItemUpdate) -> NewsItemOut | None:
    async with AsyncSessionLocal() as db:
        item = await db.get(NewsItem, item_id)
        if item is None:
            raise HTTPException(
                status_code=404, detail=f"news item {item_id} not found"
            )

        if data.read is not None:
            item.read = data.read
        if data.starred is not None:
            deleted = await set_news_starred(db, item, data.starred)
            if deleted:
                await db.commit()
                return None

        await db.commit()
        await db.refresh(item)
        return item


@router.post("/generate-digest")
async def trigger_digest() -> dict:
    """Manually trigger a digest generation run (the scheduler also runs
    this once daily — see app/common/scheduler.py)."""
    async with AsyncSessionLocal() as db:
        result = await generate_daily_digest(db)
        await db.commit()
        return result
