from google import genai

from app.core.config import get_settings

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    """Lazily build a Gemini client, with the key taken directly from
    settings — usable standalone regardless of import order. Embeddings,
    title summarization, and roadmap generation all use Gemini specifically
    for this, regardless of whatever LLM_PROVIDER powers the main chat model.
    """
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client
