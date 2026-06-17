"""User model with roles and permissions."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN_PAY = "admin_pay"
    ADMIN_TRADE = "admin_trade"
    TEAMLEADER = "teamleader"
    SALES = "sales"
    BACKOFFICE = "backoffice"
    FINANCE = "finance"
    EXTERN = "extern"
    ACCOUNTMANAGER = "accountmanager"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500))
    role = Column(String(50), default=UserRole.SALES.value)
    status = Column(String(50), default=UserStatus.ACTIVE.value)
    is_teamleader = Column(Boolean, default=False)
    google_id = Column(String(255), unique=True)
    google_access_token = Column(String(2000))
    google_refresh_token = Column(String(2000))

    # Contact
    phone = Column(String(50))
    show_on_sales_dashboard = Column(Boolean, default=False)

    # Team assignment
    team_leader_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Preferences
    language = Column(String(5), default="nl")
    dark_mode = Column(Boolean, default=False)
    notification_sound = Column(Boolean, default=True)

    # Dashboard preferences
    dashboard_period_pref = Column(String(20), default='month')
    is_superuser = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    last_active = Column(DateTime(timezone=True))

    # Relationships
    leads = relationship("Lead", back_populates="assigned_user", foreign_keys="Lead.assigned_user_id")
    call_logs = relationship("CallLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    pinned_leads = relationship("PinnedLead", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")


class ScoringConfig(Base):
    """Configurable point weights for the sales dashboard scoring system."""
    __tablename__ = "scoring_config"

    id = Column(Integer, primary_key=True, default=1)
    # server_default sets a real PostgreSQL DEFAULT so raw SQL INSERTs also get safe values
    call_points = Column(Integer, default=2, server_default="2")
    lead_points = Column(Integer, default=1, server_default="1")
    prospect_points = Column(Integer, default=10, server_default="10")
    onboarding_points = Column(Integer, default=50, server_default="50")
    client_points = Column(Integer, default=100, server_default="100")


class PinnedLead(Base):
    __tablename__ = "pinned_leads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    position = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="pinned_leads")
    lead = relationship("Lead")
