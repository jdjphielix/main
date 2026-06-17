"""Authentication router: Google OAuth login for @taperpay.com users."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import httpx

from app.database import get_db
from app.config import settings
from app.models.user import User, UserStatus
from app.middleware.auth import create_access_token, get_current_user

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google/login")
async def google_login():
    """Redirect user to Google OAuth consent screen."""
    import urllib.parse
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar",
        "access_type": "offline",
        "prompt": "consent",
        **({"hd": settings.ALLOWED_DOMAIN} if settings.ALLOWED_DOMAIN else {}),
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """Handle Google OAuth callback, create/update user, return JWT."""

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        })

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get Google tokens")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")

    # Get user info
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get user info")

    userinfo = userinfo_resp.json()
    email = userinfo.get("email", "").lower()
    domain = email.split("@")[-1] if "@" in email else ""

    # Verify domain (skip check if ALLOWED_DOMAIN is not set)
    if settings.ALLOWED_DOMAIN and domain != settings.ALLOWED_DOMAIN:
        raise HTTPException(status_code=403, detail=f"Only @{settings.ALLOWED_DOMAIN} accounts are allowed")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Check if user is pre-authorized (must be added by admin first)
        # For initial setup, auto-create admin accounts
        is_admin = email in ["jp@taperpay.com", "jvl@taperpay.com"]
        user = User(
            email=email,
            full_name=userinfo.get("name", ""),
            avatar_url=userinfo.get("picture"),
            google_id=userinfo.get("id"),
            google_access_token=access_token,
            google_refresh_token=refresh_token,
            role="admin_pay" if is_admin else "sales",
            status=UserStatus.ACTIVE.value,
        )
        db.add(user)
    else:
        # Update tokens
        user.google_access_token = access_token
        if refresh_token:
            user.google_refresh_token = refresh_token
        user.avatar_url = userinfo.get("picture")
        user.last_login = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    # Create JWT
    jwt_token = create_access_token(data={
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })

    # Redirect to frontend with token
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}&user_id={user.id}"
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "role": current_user.role,
        "is_teamleader": current_user.is_teamleader,
        "language": current_user.language,
        "dark_mode": current_user.dark_mode,
        "last_login": current_user.last_login,
    }


@router.put("/me/preferences")
async def update_preferences(
    language: str = None,
    dark_mode: bool = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user preferences (language, dark mode)."""
    if language is not None:
        current_user.language = language
    if dark_mode is not None:
        current_user.dark_mode = dark_mode
    db.commit()
    return {"status": "updated"}


# --- DEV ONLY: bypass Google OAuth for testing ---
@router.post("/dev/login")
async def dev_login(email: str, db: Session = Depends(get_db)):
    """DEV ONLY: Login without Google OAuth. Disabled in production."""
    if settings.ENV.lower() not in ("development", "dev", "local"):
        raise HTTPException(status_code=404, detail="Not found")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(data={
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    }
