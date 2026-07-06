"""Shared Knowledge Base RAG logic — used by both the REST API
(app/api/knowledge.py) and the ADK chat tools (app/skills/knowledge_base/
tools.py), so ingestion/search/answering behave identically from either
surface.
"""

from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.gemini_client import get_gemini_client
from app.common.injection_guard import (
    UNTRUSTED_CONTENT_RULE,
    neutralize_injection_attempts,
    sanitize_external_content,
)
from app.core.model_router import complete_with_fallback
from app.core.models import Document, DocumentChunk

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
CHUNK_SIZE_WORDS = 500  # "~500-token chunks" approximated by word count


async def _embed(text: str, task_type: str) -> list[float]:
    response = await get_gemini_client().aio.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=EMBEDDING_DIM, task_type=task_type
        ),
    )
    return response.embeddings[0].values


def _split_into_chunks(text: str, chunk_size: int = CHUNK_SIZE_WORDS) -> list[str]:
    words = text.split()
    if not words:
        return []
    return [
        " ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)
    ]


async def ingest_document(
    db: AsyncSession,
    title: str,
    text: str,
    source_url: str | None = None,
    file_path: str | None = None,
    storage_provider: str | None = None,
    storage_key: str | None = None,
    storage_resource_type: str | None = None,
) -> Document:
    """Create a Document row and chunk+embed `text` into document_chunks.
    Does not commit — caller's responsibility."""
    document = Document(
        title=title,
        file_path=file_path,
        source_url=source_url,
        storage_provider=storage_provider,
        storage_key=storage_key,
        storage_resource_type=storage_resource_type,
    )
    db.add(document)
    await db.flush()  # assigns document.id for the FK below

    # `text` is arbitrary third-party content (extracted PDF text, or
    # pasted notes about an external paper/link) that will be re-surfaced
    # verbatim as LLM context every time it's retrieved later — neutralize
    # injection phrasing once here, before chunking/embedding/storing,
    # rather than trusting every future retrieval call site to re-check it.
    # See docs/guardrails/knowledge-base.SKILL.md's risk notes and
    # Prompt 11.5.3.
    text = neutralize_injection_attempts(text)

    for index, chunk_text in enumerate(_split_into_chunks(text)):
        embedding = await _embed(chunk_text, task_type="RETRIEVAL_DOCUMENT")
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_text=chunk_text,
                embedding=embedding,
                chunk_index=index,
            )
        )
    return document


async def semantic_search(
    db: AsyncSession, query: str, top_k: int = 6, document_id: int | None = None
) -> list[dict]:
    """The top_k document_chunks most similar to `query` by pgvector cosine
    distance, optionally restricted to one document."""
    query_embedding = await _embed(query, task_type="RETRIEVAL_QUERY")
    stmt = (
        select(DocumentChunk, Document.title)
        .join(Document, DocumentChunk.document_id == Document.id)
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )
    if document_id is not None:
        stmt = stmt.where(DocumentChunk.document_id == document_id)
    result = await db.execute(stmt)
    return [
        {
            "document_id": chunk.document_id,
            "document_title": doc_title,
            "chunk_text": chunk.chunk_text,
            "chunk_index": chunk.chunk_index,
        }
        for chunk, doc_title in result.all()
    ]


async def answer_from_documents(
    db: AsyncSession, question: str, top_k: int = 6
) -> dict:
    """Retrieve relevant chunks and have a model answer using ONLY that
    context, citing which document each part came from. Returns
    {"answer": str, "sources": [{"document_id", "title"}, ...]} — sources
    are the distinct documents whose chunks were actually retrieved, in
    retrieval order (not necessarily all cited, but all were available to
    the model)."""
    chunks = await semantic_search(db, question, top_k=top_k)
    if not chunks:
        return {
            "answer": "I don't have any documents to answer from yet — upload or add one first.",
            "sources": [],
        }

    context = "\n\n".join(
        f'[{c["document_title"]}] (chunk {c["chunk_index"]}): {c["chunk_text"]}'
        for c in chunks
    )
    # Retrieved chunk text is already neutralized at ingestion time
    # (ingest_document), but wrap it again here, immediately before it
    # enters a live prompt — the explicit delimiter is what makes "this is
    # data, not instructions" unambiguous to the model at the point of use.
    prompt = (
        "Answer the question using ONLY the context below — do not use outside knowledge, and "
        "do not invent facts not present here. If the context doesn't contain the answer, say so "
        "plainly instead of guessing. Cite which document each part of your answer comes from "
        'using the exact bracketed titles shown (e.g. "...as shown in [Document Title]"). '
        f"{UNTRUSTED_CONTENT_RULE}\n\n"
        f"Context:\n{sanitize_external_content(context)}\n\nQuestion: {question}"
    )
    answer = await complete_with_fallback(
        "knowledge_base", [{"role": "user", "content": prompt}]
    )
    if not answer:
        answer = "I couldn't generate an answer right now — please try again shortly."

    seen: set[int] = set()
    sources = []
    for c in chunks:
        if c["document_id"] in seen:
            continue
        seen.add(c["document_id"])
        sources.append({"document_id": c["document_id"], "title": c["document_title"]})

    return {"answer": answer, "sources": sources}
