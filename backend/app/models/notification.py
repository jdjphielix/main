"""Notification and activity logging models."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String(255), nullable=False)
    message = Column(Text)
    notification_type = Column(String(50))  # callback, mention, status_change, document, chat, alert

    # Link to relevant entity
    entity_type = Column(String(50))  # lead, prospect, document, chat
    entity_id = Column(Integer)

    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


class ActivityLog(Base):
    """Audit trail: who did what, when, on which entity."""
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"))

    action = Column(String(100), nullable=False)  # created, updated, called, moved, assigned, etc.
    entity_type = Column(String(50))  # lead, prospect, document, callback
    entity_id = Column(Integer)
    details = Column(JSON)  # Additional context

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="activity_logs")
    lead = relationship("Lead", back_populates="activity_logs")


class AdminSetting(Base):
    """Admin-configurable settings (inactivity alerts, requirements, etc.)."""
    __tablename__ = "admin_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False)
    value = Column(JSON, nullable=False)
    category = Column(String(50))  # general, alerts, targets
    description = Column(Text)
    updated_by_id = Column(Integer, ForeignKey("users.id"))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TeamTarget(Base):
    """Team/user targets set by admin."""
    __tablename__ = "team_targets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))  # None = team-wide

    target_type = Column(String(50), nullable=False)  # calls_per_week, pipeline_value, conversions
    target_value = Column(Integer, nullable=False)
    period = Column(String(20), default="weekly")  # daily, weekly, monthly

    created_by_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])


class OnboardingRequirement(Base):
    """Requirements defined by admin for onboarding (TaperPay and TaperTrade separate)."""
    __tablename__ = "onboarding_requirements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    product_type = Column(String(20), nullable=False)  # taperpay, tapertrade
    broker = Column(String(50))  # None = general, corpay, ebury, alt21
    is_required = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ManualAchievement(Base):
    __tablename__ = "manual_achievements"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("team_targets.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    registered_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, default=1)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    target_type = Column(String(50), nullable=True)
    period_date = Column(Date, nullable=True)
