"""Password hashing (Argon2) and token issuance (JWT access tokens,
opaque refresh/password-reset tokens) for the auth system (app/api/auth.py).

Access tokens are short-lived, stateless JWTs — cheap to verify on every
request, nothing to look up. Refresh and password-reset tokens are opaque
random strings instead: only their SHA-256 hash is ever stored, so a
database leak doesn't hand out usable tokens, and — unlike a JWT — they can
be individually revoked (logout, password reset) since their validity is
checked against a live DB row rather than just a signature + expiry.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=30)
PASSWORD_RESET_TOKEN_TTL = timedelta(hours=1)

JWT_ALGORITHM = "HS256"

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + ACCESS_TOKEN_TTL,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    """Returns the user id encoded in a valid access token.

    Raises jwt.PyJWTError (or a subclass) on anything invalid/expired —
    callers should catch that broadly rather than each exception type.
    """
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return int(payload["sub"])


def generate_opaque_token() -> str:
    """A cryptographically random string for refresh/password-reset tokens
    — the raw value goes to the client (cookie or email link); only its
    hash (below) is ever persisted."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
