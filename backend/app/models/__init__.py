"""Import all models so SQLAlchemy registers them."""

from app.models.user import User, PinnedLead, UserRole, UserStatus
from app.models.lead import Lead, ProspectData, ProspectCurrency, CustomList, CustomListLead, ProductLine
from app.models.communication import CallLog, Note, Communication, Callback, Document, EmailSync
from app.models.notification import Notification, ActivityLog, AdminSetting, TeamTarget, OnboardingRequirement
from app.models.chat import ChatChannel, ChatMember, ChatMessage

__all__ = [
    "User", "PinnedLead", "UserRole", "UserStatus",
    "Lead", "ProspectData", "ProspectCurrency", "CustomList", "CustomListLead", "ProductLine",
    "CallLog", "Note", "Communication", "Callback", "Document", "EmailSync",
    "Notification", "ActivityLog", "AdminSetting", "TeamTarget", "OnboardingRequirement",
    "ChatChannel", "ChatMember", "ChatMessage",
]

from app.models.ticket import Ticket
