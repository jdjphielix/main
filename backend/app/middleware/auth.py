"""Authentication middleware and utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, BackgroundTasks, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db, SessionLocal
from app.models.user import User, UserRole

security = HTTPBearer()

# In-memory last_active dedup: only write to DB at most once per 60s per user
_last_active_cache: dict = {}
_LAST_ACTIVE_INTERVAL = 60  # seconds


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def _update_last_active_bg(user_id: int):
    """Background: update last_active at most once per 60s per user."""
    now = datetime.now(timezone.utc)
    last = _last_active_cache.get(user_id)
    if last and (now - last).total_seconds() < _LAST_ACTIVE_INTERVAL:
        return
    _last_active_cache[user_id] = now
    try:
        db = SessionLocal()
        db.query(User).filter(User.id == user_id).update({"last_active": now})
        db.commit()
    except Exception:
        pass
    finally:
        try:
            db.close()
        except Exception:
            pass


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is inactive")

    # Schedule last_active update without blocking the request
    import asyncio
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _update_last_active_bg, user.id)

    return user


def require_role(*roles: str):
    """Dependency factory: restrict access to specific roles."""
    async def role_checker(current_user: User = Depends(get_current_user)):
        is_admin = current_user.role in [UserRole.ADMIN_PAY.value, UserRole.ADMIN_TRADE.value]
        if is_admin:
            return current_user
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Direct dependency (not factory) — only admin_pay and admin_trade allowed.
    Usage: _: None = Depends(require_admin)   ← correct
    Previous pattern require_admin() was a factory that was NEVER called by FastAPI.
    """
    if current_user.role not in [UserRole.ADMIN_PAY.value, UserRole.ADMIN_TRADE.value]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
