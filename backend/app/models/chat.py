"""Internal chat system: DMs, group chats, channels."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ChatChannel(Base):
    """Chat channels (DM, group, or public channel)."""
    __tablename__ = "chat_channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))  # None for DM
    description = Column(Text)
    channel_type = Column(String(20), nullable=False)  # dm, group, channel

    created_by_id = Column(Integer, ForeignKey("users.id"))
    is_archived = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)  # Role-based system channels

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_by = relationship("User")
    members = relationship("ChatMember", back_populates="channel")
    messages = relationship("ChatMessage", back_populates="channel", order_by="ChatMessage.created_at")


class ChatMember(Base):
    """Channel membership."""
    __tablename__ = "chat_members"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("chat_channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_read_at = Column(DateTime(timezone=True))
    is_muted = Column(Boolean, default=False)

    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    channel = relationship("ChatChannel", back_populates="members")
    user = relationship("User")


class ChatMessage(Base):
    """Individual chat message."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("chat_channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text")  # text, file, image, case_ref

    # File attachment
    file_url = Column(String(1000))
    file_name = Column(String(500))
    file_size = Column(Integer)

    # Case reference
    case_ref_type = Column(String(20))  # lead, prospect, client
    case_ref_id = Column(Integer)

    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    channel = relationship("ChatChannel", back_populates="messages")
    user = relationship("User")
