from io import BytesIO

from google.genai import types

from app.common.gemini_client import get_gemini_client


def extract_pdf_text(contents: bytes) -> str:
    import pdfplumber

    with pdfplumber.open(BytesIO(contents)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def extract_docx_text(contents: bytes) -> str:
    from docx import Document

    doc = Document(BytesIO(contents))
    return "\n".join(p.text for p in doc.paragraphs)


async def extract_image_text(contents: bytes, mime_type: str) -> str:
    """Transcribe text from an image via Gemini's vision input — avoids
    needing a local OCR engine (e.g. tesseract) as a system dependency."""
    response = await get_gemini_client().aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=contents, mime_type=mime_type),
            "Transcribe all text from this image exactly as written, no commentary.",
        ],
    )
    return (response.text or "").strip()
