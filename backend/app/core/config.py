from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""

    # Which LLM backs the chat agent. "gemini" (default) or "groq" (or any
    # other litellm-supported provider — see app/core/agent.py). Embeddings
    # (app/common/memory.py) always use Gemini regardless of this setting,
    # since Groq doesn't offer an embeddings API.
    llm_provider: str = "gemini"
    llm_model: str = ""  # blank = provider's default (see agent.py)
    groq_api_key: str = ""

    database_url: str = "postgresql+asyncpg://buddy:buddy@localhost:5432/buddy"

    langsmith_api_key: str = ""
    langsmith_project: str = "buddy"

    postgres_user: str = "buddy"
    postgres_password: str = "buddy"
    postgres_db: str = "buddy"

    # Gmail account used to SEND reminder emails (SMTP auth + "From"
    # address) — not the recipient. The recipient address is configured
    # per-user in the notification_preferences table via the Profile page.
    email_address: str = ""
    email_app_password: str = ""

    # Cloudinary — used to store uploaded images (profile pictures for now);
    # only the resulting secure_url is persisted in Postgres.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
