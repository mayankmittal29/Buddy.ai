import cloudinary

from app.core.config import get_settings

_configured = False


def ensure_cloudinary_configured() -> bool:
    """Configure the Cloudinary SDK once, lazily.

    Returns whether it's actually usable (i.e. credentials are present) —
    callers should respond 503 if this is False rather than attempting an
    upload that's guaranteed to fail.
    """
    global _configured
    settings = get_settings()
    if not settings.cloudinary_cloud_name:
        return False
    if not _configured:
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )
        _configured = True
    return True
