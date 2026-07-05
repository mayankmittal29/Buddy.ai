import logging

from google import genai

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    # Same lazy, settings-sourced init pattern as app.common.memory — this
    # module must work standalone regardless of import order.
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


async def summarize_title(messages: list[tuple[str, str]]) -> str:
    """Summarize a conversation's opening exchanges into a short title.

    Args:
      messages: (role, content) pairs, oldest first.

    Returns:
      A short 3-6 word title, or "" if generation failed.
    """
    if not messages:
        return ""
    transcript = "\n".join(f"{role}: {content}" for role, content in messages)
    prompt = (
        "Summarize this conversation into a short title (3-6 words, no quotes, "
        "no trailing punctuation, plain text only, describing what the user "
        f"wants help with):\n\n{transcript}"
    )
    try:
        response = await _get_client().aio.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        return (response.text or "").strip().strip('"')
    except Exception:
        # Best-effort: the title just stays as-is and gets retried on the
        # next turn (up to MAX_TITLE_EXCHANGES), but log it so a persistent
        # failure (e.g. rate limiting) is visible instead of silent.
        logger.warning("summarize_title failed", exc_info=True)
        return ""
