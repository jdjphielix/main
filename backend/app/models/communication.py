"""Communication models: calls, notes, emails, callbacks, documents."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, JSON, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    phone_number = Column(String(50))
    duration_seconds = Column(Integer)
    outcome = Column(String(50))  # answered, no_answer, voicemail, busy
    notes = Column(Text)
    recording_url = Column(String(500))  # Future: Twilio recording

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="call_logs")
    user = relationship("User", back_populates="call_logs")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)

    deleted_by_id = Column(Integer, ForeignKey("users.id"))
    deleted_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    lead = relationship("Lead", back_populates="notes")
    user = relationship("User", foreign_keys=[user_id])


class Communication(Base):
    """Internal communication thread on a lead/prospect with @mention support."""
    __tablename__ = "communications"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    mentioned_user_ids = Column(JSON)  # List of user IDs that were @mentioned

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="communications")
    user = relationship("User")


class Callback(Base):
    __tablename__ = "callbacks"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    callback_type = Column(String(20), default="call")  # call, meeting

    # Internal attendees
    internal_attendees = Column(JSON)  # List of user IDs
    internal_note = Column(Text)  # Note sent to internal attendees

    # External attendees
    external_attendees = Column(JSON)  # List of email addresses
    external_note = Column(Text)  # Note sent to external attendees

    # Invited colleagues (user IDs, stored as JSON array)
    invited_user_ids = Column(JSON)  # List of user IDs invited to this callback

    # Google Calendar
    add_to_calendar = Column(Boolean, default=False)
    google_event_id = Column(String(255))

    # Status
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="callbacks")
    created_by = relationship("User")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer)  # bytes
    file_type = Column(String(100))  # mime type
    category = Column(String(100))  # general, onboarding, compliance, trade_finance

    # Versioning
    version = Column(Integer, default=1)
    parent_document_id = Column(Integer, ForeignKey("documents.id"))
    is_latest = Column(Boolean, default=True)

    # AI scan results (onboarding)
    ai_scan_result = Column(Text)
    ai_scan_status = Column(String(50))  # pending, scanned, warning, error

    # Onboarding requirement link
    requirement_id = Column(Integer, ForeignKey("onboarding_requirements.id"))
    approval_status = Column(String(50))  # pending, approved, rejected
    rejection_reason = Column(Text)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"))

    # Soft delete
    is_deleted = Column(Boolean, default=False)
    valid_until = Column(Date)               # KYC document vervaldatum
    deleted_by_id = Column(Integer, ForeignKey("users.id"))
    deleted_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="documents")
    user = relationship("User", foreign_keys=[user_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    parent_document = relationship("Document", remote_side=[id])


class EmailSync(Base):
    """Synced email messages from Gmail for a lead."""
    __tablename__ = "email_syncs"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    gmail_message_id = Column(String(255), unique=True)
    gmail_thread_id = Column(String(255))
    subject = Column(String(500))
    from_email = Column(String(255))
    to_email = Column(String(255))
    snippet = Column(Text)
    body_html = Column(Text)
    direction = Column(String(10))  # inbound, outbound
    received_at = Column(DateTime(timezone=True))

    # Compliance linking
    compliance_case_id = Column(Integer, ForeignKey("compliance_cases.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead")
    user = relationship("User")


class ContactMethod(Base):
    """Multiple emails/phones/whatsapp numbers per lead."""
    __tablename__ = "contact_methods"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)   # email, phone, whatsapp
    value = Column(String(255), nullable=False)  # the actual email/number
    label = Column(String(50))                   # Work, Mobile, Personal, etc.
    is_primary = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    lead = relationship("Lead", back_populates="contact_methods")


class ConversationLog(Base):
    """Unified log for phone calls, emails, WhatsApp per lead."""
    __tablename__ = "conversation_logs"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    type = Column(String(20), nullable=False)    # phone, email, whatsapp
    direction = Column(String(10), default="outbound")  # inbound, outbound
    contact_value = Column(String(255))          # number/email used
    duration_seconds = Column(Integer)
    outcome = Column(String(50))                 # answered, no_answer, voicemail, busy (phone only)

    summary = Column(Text)                       # Manual summary by user
    ai_summary = Column(Text)                    # Auto-generated by Claude
    transcript_text = Column(Text)               # Full transcript text
    transcript_filename = Column(String(500))    # Uploaded transcript filename
    whatsapp_raw = Column(Text)                  # Raw WhatsApp export text

    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="conversation_logs")
    user = relationship("User")


class ContactFamilyMember(Base):
    """Family member linked to a contact/lead — for birthday tracking."""
    __tablename__ = "contact_family_members"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    contact_name = Column(String(255))   # Which contact this belongs to (optional)
    name = Column(String(255), nullable=False)
    relation = Column(String(100))       # kind, partner, etc.
    birth_date = Column(Date)            # birthday

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    lead = relationship("Lead")
