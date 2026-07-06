from app.common.knowledge import answer_from_documents as _answer_from_documents
from app.common.knowledge import semantic_search as _semantic_search
from app.core.db import AsyncSessionLocal


async def semantic_search(
    query: str, top_k: int = 6, document_id: int | None = None
) -> list[dict]:
    """Search across all uploaded documents (or one, if document_id is
    given) for the chunks most semantically similar to `query`.

    Args:
      query: What to search for.
      top_k: Maximum number of chunks to return.
      document_id: Restrict the search to one document's chunks, or null
        to search across all documents.

    Returns:
      A list of {document_id, document_title, chunk_text, chunk_index},
      most similar first.
    """
    async with AsyncSessionLocal() as db:
        return await _semantic_search(db, query, top_k=top_k, document_id=document_id)


async def answer_from_documents(question: str) -> dict:
    """Answer a question using only the content of uploaded documents —
    retrieves relevant chunks and grounds the answer in them, never in
    outside knowledge.

    Args:
      question: The user's question.

    Returns:
      {"answer": str, "sources": [{"document_id", "title"}, ...]} — sources
      are the distinct documents whose content was actually used.
    """
    async with AsyncSessionLocal() as db:
        return await _answer_from_documents(db, question)


TOOLS = [semantic_search, answer_from_documents]
