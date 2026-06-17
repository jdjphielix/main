"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://taper_user:taper_secure_2024@db:5432/taperpay_db"
    DATABASE_URL_LOCAL: str = "postgresql://taper_user:taper_secure_2024@localhost:5433/taperpay_db"

    # Security
    SECRET_KEY: str = "taper-backoffice-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"
    ALLOWED_DOMAIN: str = "taperpay.com"

    # Anthropic AI
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # Google Places API (for company lookup / scraping)
    GOOGLE_PLACES_API_KEY: str = ""

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 50
    UPLOAD_DIR: str = "./app/static/uploads"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Session
    SESSION_TIMEOUT_MINUTES: int = 30

    # Environment — set to "production" on live server, "development" locally
    ENV: str = "production"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
