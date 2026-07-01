"""Ticket model for internal support tickets."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Ticket(Base):
    """Internal support/task ticket."""
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="open")  # open, in_progress, pending, resolved, closed
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    category = Column(String(100))  # onboarding, client, fx, trade, compliance, other
    follow_up_date = Column(DateTime(timezone=True))  # opvolgdatum voor pending tickets

    # Relations
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"))
    related_lead_id = Column(Integer, ForeignKey("leads.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))
