import os

from app.core.config import get_settings

settings = get_settings()

if settings.langsmith_api_key:
    os.environ.setdefault("LANGSMITH_API_KEY", settings.langsmith_api_key)
    os.environ.setdefault("LANGSMITH_TRACING", "true")
if settings.langsmith_project:
    os.environ.setdefault("LANGSMITH_PROJECT", settings.langsmith_project)
