import asyncio
import uuid
from datetime import datetime

import cloudinary.uploader
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, func, select

from app.common.cloudinary_client import ensure_cloudinary_configured
from app.common.knowledge import ingest_document
from app.common.r2_client import delete_from_r2, ensure_r2_configured, upload_to_r2
from app.common.text_extraction import extract_pdf_text
from app.core.db import AsyncSessionLocal
from app.core.models import Bookmark, Document, DocumentChunk, Note

router = APIRouter(prefix="/api/knowledge")


# ---- Notes -----------------------------------------------------------------


class NoteCreate(BaseModel):
    title: str
    content: str


class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/notes", response_model=list[NoteOut])
async def list_notes() -> list[NoteOut]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Note).order_by(Note.created_at.desc()))
        return list(result.scalars().all())


@router.post("/notes", response_model=NoteOut, status_code=201)
async def create_note(data: NoteCreate) -> NoteOut:
    async with AsyncSessionLocal() as db:
        note = Note(title=data.title, content=data.content)
        db.add(note)
        await db.commit()
        await db.refresh(note)
        return note


@router.put("/notes/{note_id}", response_model=NoteOut)
async def update_note(note_id: int, data: NoteCreate) -> NoteOut:
    async with AsyncSessionLocal() as db:
        note = await db.get(Note, note_id)
        if note is None:
            raise HTTPException(status_code=404, detail=f"note {note_id} not found")
        note.title = data.title
        note.content = data.content
        await db.commit()
        await db.refresh(note)
        return note


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(note_id: int) -> None:
    async with AsyncSessionLocal() as db:
        note = await db.get(Note, note_id)
        if note is None:
            raise HTTPException(status_code=404, detail=f"note {note_id} not found")
        await db.delete(note)
        await db.commit()


# ---- Bookmarks --------------------------------------------------------------


class BookmarkCreate(BaseModel):
    url: str
    title: str
    note: str | None = None


class BookmarkOut(BaseModel):
    id: int
    url: str
    title: str
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/bookmarks", response_model=list[BookmarkOut])
async def list_bookmarks() -> list[BookmarkOut]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Bookmark).order_by(Bookmark.created_at.desc()))
        return list(result.scalars().all())


@router.post("/bookmarks", response_model=BookmarkOut, status_code=201)
async def create_bookmark(data: BookmarkCreate) -> BookmarkOut:
    async with AsyncSessionLocal() as db:
        bookmark = Bookmark(url=data.url, title=data.title, note=data.note)
        db.add(bookmark)
        await db.commit()
        await db.refresh(bookmark)
        return bookmark


@router.put("/bookmarks/{bookmark_id}", response_model=BookmarkOut)
async def update_bookmark(bookmark_id: int, data: BookmarkCreate) -> BookmarkOut:
    async with AsyncSessionLocal() as db:
        bookmark = await db.get(Bookmark, bookmark_id)
        if bookmark is None:
            raise HTTPException(
                status_code=404, detail=f"bookmark {bookmark_id} not found"
            )
        bookmark.url = data.url
        bookmark.title = data.title
        bookmark.note = data.note
        await db.commit()
        await db.refresh(bookmark)
        return bookmark


@router.delete("/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(bookmark_id: int) -> None:
    async with AsyncSessionLocal() as db:
        bookmark = await db.get(Bookmark, bookmark_id)
        if bookmark is None:
            raise HTTPException(
                status_code=404, detail=f"bookmark {bookmark_id} not found"
            )
        await db.delete(bookmark)
        await db.commit()


# ---- Documents (RAG ingestion) ----------------------------------------------


class DocumentOut(BaseModel):
    id: int
    title: str
    file_path: str | None
    source_url: str | None
    uploaded_at: datetime
    chunk_count: int

    model_config = {"from_attributes": True}


async def _document_to_out(db, document: Document) -> DocumentOut:
    count_stmt = (
        select(func.count())
        .select_from(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
    )
    chunk_count = (await db.execute(count_stmt)).scalar_one()
    return DocumentOut(
        id=document.id,
        title=document.title,
        file_path=document.file_path,
        source_url=document.source_url,
        uploaded_at=document.uploaded_at,
        chunk_count=chunk_count,
    )


class DocumentRename(BaseModel):
    title: str


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents() -> list[DocumentOut]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Document).order_by(Document.uploaded_at.desc())
        )
        return [await _document_to_out(db, doc) for doc in result.scalars().all()]


@router.patch("/documents/{document_id}", response_model=DocumentOut)
async def rename_document(document_id: int, data: DocumentRename) -> DocumentOut:
    """Rename a document's title only — does NOT re-extract/re-chunk/
    re-embed its content, since the underlying text hasn't changed."""
    async with AsyncSessionLocal() as db:
        document = await db.get(Document, document_id)
        if document is None:
            raise HTTPException(
                status_code=404, detail=f"document {document_id} not found"
            )
        document.title = data.title
        await db.commit()
        await db.refresh(document)
        return await _document_to_out(db, document)


@router.post("/documents/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    title: str = Form(...),
    source_url: str | None = Form(None),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
) -> DocumentOut:
    """Ingest a document either from an uploaded PDF (text extracted via
    pdfplumber) or from a link + pasted text (source_url stored, `text` is
    what actually gets chunked/embedded) — see app/common/knowledge.py.
    """
    file_path: str | None = None
    storage_provider: str | None = None
    storage_key: str | None = None
    storage_resource_type: str | None = None
    extracted_text = ""

    if file is not None:
        filename = file.filename or "document"
        ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        if ext != "pdf":
            raise HTTPException(
                status_code=400, detail="Only PDF uploads are supported."
            )

        contents = await file.read()
        extracted_text = await asyncio.to_thread(extract_pdf_text, contents)

        if ensure_r2_configured():
            key = f"knowledge/{uuid.uuid4().hex}.pdf"
            try:
                file_path = await asyncio.to_thread(
                    upload_to_r2, contents, key, "application/pdf"
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502, detail=f"Upload failed: {exc}"
                ) from exc
            storage_provider = "r2"
            storage_key = key
        else:
            if not ensure_cloudinary_configured():
                raise HTTPException(
                    status_code=503,
                    detail="File storage isn't configured (missing Cloudinary credentials).",
                )
            try:
                result = await asyncio.to_thread(
                    cloudinary.uploader.upload,
                    contents,
                    folder="buddy/knowledge",
                    resource_type="image",  # serves PDFs inline, see app/api/career.py
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502, detail=f"Upload failed: {exc}"
                ) from exc
            file_path = result["secure_url"]
            storage_provider = "cloudinary"
            storage_key = result["public_id"]
            storage_resource_type = "image"

    combined_text = "\n\n".join(
        part for part in (extracted_text, text) if part and part.strip()
    )
    if not combined_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Provide a PDF file or pasted text to build the knowledge base from.",
        )

    async with AsyncSessionLocal() as db:
        document = await ingest_document(
            db,
            title=title,
            text=combined_text,
            source_url=source_url,
            file_path=file_path,
            storage_provider=storage_provider,
            storage_key=storage_key,
            storage_resource_type=storage_resource_type,
        )
        await db.commit()
        await db.refresh(document)
        return await _document_to_out(db, document)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: int) -> None:
    async with AsyncSessionLocal() as db:
        document = await db.get(Document, document_id)
        if document is None:
            raise HTTPException(
                status_code=404, detail=f"document {document_id} not found"
            )

        if document.storage_key:
            try:
                if document.storage_provider == "r2":
                    await asyncio.to_thread(delete_from_r2, document.storage_key)
                elif document.storage_provider == "cloudinary":
                    await asyncio.to_thread(
                        cloudinary.uploader.destroy,
                        document.storage_key,
                        resource_type=document.storage_resource_type or "raw",
                    )
            except Exception as exc:
                raise HTTPException(
                    status_code=502, detail=f"Couldn't delete the stored file: {exc}"
                ) from exc

        await db.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )
        await db.delete(document)
        await db.commit()
