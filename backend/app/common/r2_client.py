import boto3
from botocore.config import Config

from app.core.config import get_settings

_client = None


def ensure_r2_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.r2_account_id
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
        and settings.r2_bucket_name
        and settings.r2_public_url_base
    )


def _get_client():
    global _client
    if _client is None:
        settings = get_settings()
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


def delete_from_r2(key: str) -> None:
    settings = get_settings()
    client = _get_client()
    client.delete_object(Bucket=settings.r2_bucket_name, Key=key)


def upload_to_r2(contents: bytes, key: str, content_type: str) -> str:
    """Upload bytes to the configured R2 bucket and return its public URL.

    Deliberately sets no Content-Disposition — browsers preview supported
    types (e.g. PDF) inline by default rather than forcing a download.
    """
    settings = get_settings()
    client = _get_client()
    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=contents,
        ContentType=content_type,
    )
    return f"{settings.r2_public_url_base}/{key}"
