from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Chat models are resolved per-skill through a tiered, multi-provider
    # fallback router (see app/core/model_tiers.py / model_router.py) rather
    # than one hardcoded model — these three keys back that router's Groq/
    # Gemini/Hugging-Face-Inference-Providers steps. Embeddings
    # (app/common/memory.py) always use Gemini specifically, regardless of
    # which provider ends up serving a given skill's chat model.
    gemini_api_key: str = ""
    groq_api_key: str = ""
    hf_token: str = ""

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

    # Cloudinary — used to store uploaded images (profile pictures, cert
    # images, DOCX resumes); only the resulting secure_url is persisted in
    # Postgres.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Cloudflare R2 (S3-compatible) — used specifically for PDF resumes, so
    # they can be served for inline browser preview without Cloudinary's
    # raw-resource attachment behavior. Only the resulting public URL is
    # persisted in Postgres.
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    # Public base URL for the bucket (either the R2.dev dev subdomain with
    # public access enabled, or a bound custom domain) — no trailing slash.
    r2_public_url_base: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
