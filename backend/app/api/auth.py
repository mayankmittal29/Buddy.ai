"""Custom auth: signup/login/logout/refresh/me/forgot-password/reset-password.

Access tokens (short-lived JWT) and refresh tokens (opaque, DB-backed,
rotated on every use) both live in HttpOnly cookies — never touched by
frontend JS, so there's nothing for an XSS payload to steal via
document.cookie. See app/core/security.py for the hashing/token primitives.

Scope note: this backs real accounts (signup/login) but the rest of the
app's data (tasks, habits, finance, etc.) is still the single-user schema
it always was — see docs/guardrails/ROOT_AGENT.md-adjacent reasoning in
app/core/models.py's User docstring. This layer gates the frontend
experience and provides real auth mechanics; it does not scope every
existing endpoint's data per-account.
"""

from datetime import date, datetime, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.common.notifications import send_email
from app.common.pii import _EMAIL_RE  # reuse the same email-shape check
from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.models import Gender, PasswordResetToken, RefreshToken, User, UserProfile
from app.core.security import (
    ACCESS_TOKEN_TTL,
    PASSWORD_RESET_TOKEN_TTL,
    REFRESH_TOKEN_TTL,
    create_access_token,
    decode_access_token,
    generate_opaque_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    occupation: str = ""
    current_ctc: float | None = None
    gender: Gender
    dob: date


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    username: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    name: str
    occupation: str
    current_ctc: float | None
    gender: Gender
    dob: date

    class Config:
        from_attributes = True


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    # secure=False because local dev runs over plain HTTP — flip to True
    # (and the frontend/backend both onto HTTPS) before any real deployment.
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=int(ACCESS_TOKEN_TTL.total_seconds()),
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=int(REFRESH_TOKEN_TTL.total_seconds()),
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(
    access_token: str | None = Cookie(default=None),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = decode_access_token(access_token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401, detail="Invalid or expired session"
        ) from exc

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/signup", response_model=UserOut, status_code=201)
async def signup(data: SignupRequest) -> User:
    """Creates the account only — does NOT log the user in. The frontend
    sends them to /login afterward rather than straight into the app, so
    signup and login stay two distinct, explicit steps."""
    async with AsyncSessionLocal() as db:
        user = User(
            username=data.username.strip(),
            password_hash=hash_password(data.password),
            name=data.name.strip(),
            occupation=data.occupation.strip(),
            current_ctc=data.current_ctc,
            gender=data.gender,
            dob=data.dob,
        )
        db.add(user)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(
                status_code=409, detail="An account with that username already exists."
            ) from exc
        await db.refresh(user)

        # Pre-fill the (separate, single-row) daily-rhythm UserProfile's
        # name with the account name, purely so Profile/Navbar aren't blank
        # on first login — it stays independently editable afterward.
        profile = await db.get(UserProfile, 1)
        if profile is None:
            db.add(UserProfile(id=1, name=user.name))
        elif not profile.name:
            profile.name = user.name

        await db.commit()

    return user


@router.post("/login", response_model=UserOut)
async def login(data: LoginRequest, response: Response) -> User:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.username == data.username.strip())
        )
        user = result.scalar_one_or_none()
        if user is None or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=401, detail="Incorrect username or password."
            )

        refresh_token = generate_opaque_token()
        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_token),
                expires_at=datetime.now(timezone.utc) + REFRESH_TOKEN_TTL,
            )
        )
        await db.commit()

    _set_auth_cookies(response, create_access_token(user.id), refresh_token)
    return user


@router.post("/refresh", response_model=UserOut)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
) -> User:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token_hash = hash_token(refresh_token)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if (
            stored is None
            or stored.revoked
            or stored.expires_at.replace(tzinfo=timezone.utc) < now
        ):
            raise HTTPException(
                status_code=401, detail="Session expired — please log in again."
            )

        # Rotate: the old refresh token is single-use.
        stored.revoked = True
        user = await db.get(User, stored.user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")

        new_refresh_token = generate_opaque_token()
        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(new_refresh_token),
                expires_at=now + REFRESH_TOKEN_TTL,
            )
        )
        await db.commit()

    _set_auth_cookies(response, create_access_token(user.id), new_refresh_token)
    return user


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
) -> dict:
    if refresh_token:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(RefreshToken).where(
                    RefreshToken.token_hash == hash_token(refresh_token)
                )
            )
            stored = result.scalar_one_or_none()
            if stored is not None:
                stored.revoked = True
                await db.commit()

    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest) -> dict:
    """Always returns the same generic message regardless of whether the
    username exists, to avoid leaking which accounts are registered — the
    actual email only goes out if there's a real, email-shaped account."""
    generic_message = {
        "message": "If an account with that email exists, we've sent a password reset link."
    }

    username = data.username.strip()
    if not _EMAIL_RE.fullmatch(username):
        # Phone-number usernames have no channel to deliver a reset link
        # to today (no WhatsApp/SMS integration) — same generic response,
        # nothing sent.
        return generic_message

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            return generic_message

        raw_token = generate_opaque_token()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(raw_token),
                expires_at=datetime.now(timezone.utc) + PASSWORD_RESET_TOKEN_TTL,
            )
        )
        await db.commit()

    settings = get_settings()
    reset_link = f"{settings.frontend_url}/reset-password?token={raw_token}"
    try:
        send_email(
            username,
            "Reset your Buddy password",
            f"Someone asked to reset the password on this account.\n\n"
            f"Reset it here (valid for 1 hour): {reset_link}\n\n"
            "If this wasn't you, you can safely ignore this email.",
        )
    except Exception:
        pass  # still return the generic message either way

    return generic_message


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest) -> dict:
    token_hash = hash_token(data.token)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash
            )
        )
        stored = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if (
            stored is None
            or stored.used
            or stored.expires_at.replace(tzinfo=timezone.utc) < now
        ):
            raise HTTPException(
                status_code=400, detail="That reset link is invalid or has expired."
            )

        user = await db.get(User, stored.user_id)
        if user is None:
            raise HTTPException(status_code=400, detail="That reset link is invalid.")

        user.password_hash = hash_password(data.new_password)
        stored.used = True

        # Force re-login everywhere — a password reset should invalidate
        # every existing session, not just issue a new password.
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False)
            )
        )
        for token_row in result.scalars().all():
            token_row.revoked = True

        await db.commit()

    return {"message": "Password reset — you can now log in with your new password."}
