"""Conversations router: contact methods + unified conversation logging (phone, email, WhatsApp)."""

import os
import re
import shutil
import logging
from datetime import datetime, timezone
from typing import Optional, List

import anthropic
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.communication import ContactMethod, ConversationLog
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _get_lead_or_404(lead_id: int, db: Session) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


def _contact_method_dict(cm: ContactMethod) -> dict:
    return {
        "id": cm.id,
        "lead_id": cm.lead_id,
        "type": cm.type,
        "value": cm.value,
        "label": cm.label,
        "is_primary": cm.is_primary,
        "created_at": cm.created_at.isoformat() if cm.created_at else None,
    }


def _conversation_dict(log: ConversationLog) -> dict:
    return {
        "id": log.id,
        "lead_id": log.lead_id,
        "user_id": log.user_id,
        "user_name": log.user.full_name if log.user else None,
        "type": log.type,
        "direction": log.direction,
        "contact_value": log.contact_value,
        "duration_seconds": log.duration_seconds,
        "outcome": log.outcome,
        "summary": log.summary,
        "ai_summary": log.ai_summary,
        "transcript_text": log.transcript_text,
        "transcript_filename": log.transcript_filename,
        "whatsapp_raw": log.whatsapp_raw,
        "occurred_at": log.occurred_at.isoformat() if log.occurred_at else None,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


async def _ai_summarize(text: str, conv_type: str) -> str:
    """Call Claude to summarize a transcript or WhatsApp export."""
    if not settings.ANTHROPIC_API_KEY:
        return ""
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        type_label = {
            "phone": "phone call transcript",
            "email": "email conversation",
            "whatsapp": "WhatsApp conversation",
        }.get(conv_type, "conversation")

        message = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Summarize this {type_label} in 3-5 bullet points. "
                        f"Focus on: key topics discussed, decisions made, follow-up actions needed, "
                        f"and the overall tone/outcome. Be concise and business-focused.\n\n"
                        f"---\n{text[:8000]}\n---"
                    ),
                }
            ],
        )
        return message.content[0].text if message.content else ""
    except Exception as e:
        logger.warning(f"AI summarization failed: {e}")
        return ""


def _parse_whatsapp_export(raw_text: str) -> str:
    """
    Parse a WhatsApp .txt export into a clean readable transcript.
    Format per line: DD/MM/YYYY, HH:MM - Name: Message
    Returns cleaned multiline text.
    """
    lines = raw_text.splitlines()
    parsed = []
    # Pattern: date, time - sender: message
    pattern = re.compile(r"^\[?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]?\s*[-–]\s*(.+?):\s*(.*)")
    for line in lines:
        m = pattern.match(line.strip())
        if m:
            date_str, time_str, sender, msg = m.groups()
            parsed.append(f"[{date_str} {time_str}] {sender}: {msg}")
        elif parsed and line.strip():
            # Continuation of previous message
            parsed.append(f"  {line.strip()}")
    return "\n".join(parsed) if parsed else raw_text


# ─────────────────────────────────────────────────────────────
# Birthdays — static route MUST come before /{lead_id}/... routes
# ─────────────────────────────────────────────────────────────

@router.get("/birthdays/today")
async def get_todays_birthdays(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return contacts and family members with a birthday today."""
    from app.models.communication import ContactFamilyMember
    from app.models.lead import Lead
    from datetime import date
    today = date.today()

    # Family members with birthday today
    family = db.query(ContactFamilyMember).filter(
        ContactFamilyMember.birth_date != None,
        func.extract('month', ContactFamilyMember.birth_date) == today.month,
        func.extract('day', ContactFamilyMember.birth_date) == today.day,
    ).all()

    result = []
    for m in family:
        lead = db.query(Lead).filter(Lead.id == m.lead_id).first()
        result.append({
            "type": "family_member",
            "name": m.name,
            "relation": m.relation,
            "contact_name": m.contact_name,
            "lead_id": m.lead_id,
            "lead_name": lead.company_name if lead else None,
        })

    return {"birthdays": result, "total": len(result)}


# ─────────────────────────────────────────────────────────────
# Family Members — GET / POST / DELETE
# ─────────────────────────────────────────────────────────────

@router.get("/{lead_id}/family-members")
async def get_family_members(lead_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.communication import ContactFamilyMember
    members = db.query(ContactFamilyMember).filter(ContactFamilyMember.lead_id == lead_id).order_by(ContactFamilyMember.name).all()
    return [{"id": m.id, "lead_id": m.lead_id, "contact_name": m.contact_name, "name": m.name, "relation": m.relation, "birth_date": m.birth_date.isoformat() if m.birth_date else None} for m in members]


@router.post("/{lead_id}/family-members")
async def add_family_member(lead_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.communication import ContactFamilyMember
    from datetime import date as date_type
    birth_date = None
    if data.get("birth_date"):
        try:
            birth_date = date_type.fromisoformat(data["birth_date"])
        except (ValueError, TypeError):
            pass
    member = ContactFamilyMember(lead_id=lead_id, contact_name=data.get("contact_name"), name=data["name"], relation=data.get("relation"), birth_date=birth_date)
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"id": member.id, "name": member.name, "relation": member.relation, "birth_date": member.birth_date.isoformat() if member.birth_date else None}


@router.delete("/{lead_id}/family-members/{member_id}")
async def delete_family_member(lead_id: int, member_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.communication import ContactFamilyMember
    member = db.query(ContactFamilyMember).filter(ContactFamilyMember.id == member_id, ContactFamilyMember.lead_id == lead_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(member)
    db.commit()
    return {"status": "deleted"}


# ─────────────────────────────────────────────────────────────
# Contact Methods — GET / POST / DELETE
# ─────────────────────────────────────────────────────────────

@router.get("/{lead_id}/contact-methods")
async def get_contact_methods(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all contact methods (emails, phones, WhatsApp) for a lead."""
    _get_lead_or_404(lead_id, db)
    methods = (
        db.query(ContactMethod)
        .filter(ContactMethod.lead_id == lead_id)
        .order_by(ContactMethod.is_primary.desc(), ContactMethod.created_at.asc())
        .all()
    )
    return [_contact_method_dict(m) for m in methods]


@router.post("/{lead_id}/contact-methods")
async def add_contact_method(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a contact method to a lead.
    Payload: {type: email|phone|whatsapp, value: str, label?: str, is_primary?: bool}
    """
    _get_lead_or_404(lead_id, db)

    cm_type = data.get("type")
    if cm_type not in ("email", "phone", "whatsapp"):
        raise HTTPException(status_code=400, detail="type must be email, phone, or whatsapp")

    value = (data.get("value") or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="value is required")

    is_primary = data.get("is_primary", False)

    # If setting as primary, unset all others of same type
    if is_primary:
        db.query(ContactMethod).filter(
            ContactMethod.lead_id == lead_id,
            ContactMethod.type == cm_type,
            ContactMethod.is_primary == True,
        ).update({"is_primary": False}, synchronize_session=False)

    cm = ContactMethod(
        lead_id=lead_id,
        type=cm_type,
        value=value,
        label=data.get("label"),
        is_primary=is_primary,
    )
    db.add(cm)
    db.commit()
    db.refresh(cm)
    return _contact_method_dict(cm)


@router.put("/{lead_id}/contact-methods/{method_id}")
async def update_contact_method(
    lead_id: int,
    method_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update label, value, or is_primary for a contact method."""
    _get_lead_or_404(lead_id, db)
    cm = db.query(ContactMethod).filter(
        ContactMethod.id == method_id, ContactMethod.lead_id == lead_id
    ).first()
    if not cm:
        raise HTTPException(status_code=404, detail="Contact method not found")

    if "value" in data:
        cm.value = (data["value"] or "").strip()
    if "label" in data:
        cm.label = data["label"]
    if "is_primary" in data and data["is_primary"]:
        db.query(ContactMethod).filter(
            ContactMethod.lead_id == lead_id,
            ContactMethod.type == cm.type,
            ContactMethod.is_primary == True,
            ContactMethod.id != method_id,
        ).update({"is_primary": False}, synchronize_session=False)
        cm.is_primary = True

    db.commit()
    db.refresh(cm)
    return _contact_method_dict(cm)


@router.delete("/{lead_id}/contact-methods/{method_id}")
async def delete_contact_method(
    lead_id: int,
    method_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a contact method."""
    _get_lead_or_404(lead_id, db)
    cm = db.query(ContactMethod).filter(
        ContactMethod.id == method_id, ContactMethod.lead_id == lead_id
    ).first()
    if not cm:
        raise HTTPException(status_code=404, detail="Contact method not found")
    db.delete(cm)
    db.commit()
    return {"status": "deleted", "id": method_id}


# ─────────────────────────────────────────────────────────────
# Conversation Logs — GET / POST / DELETE
# ─────────────────────────────────────────────────────────────

@router.get("/{lead_id}/conversations")
async def get_conversations(
    lead_id: int,
    conv_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List conversation logs for a lead, optionally filtered by type."""
    _get_lead_or_404(lead_id, db)
    query = db.query(ConversationLog).filter(ConversationLog.lead_id == lead_id)
    if conv_type:
        query = query.filter(ConversationLog.type == conv_type)
    logs = query.order_by(ConversationLog.occurred_at.desc()).all()
    return [_conversation_dict(log) for log in logs]


@router.post("/{lead_id}/conversations")
async def create_conversation(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually log a conversation (no file upload).
    Payload: {
        type: phone|email|whatsapp,
        direction?: inbound|outbound,
        contact_value?: str,
        duration_seconds?: int,
        outcome?: str,
        summary?: str,
        occurred_at?: ISO datetime string
    }
    """
    _get_lead_or_404(lead_id, db)

    conv_type = data.get("type")
    if conv_type not in ("phone", "email", "whatsapp"):
        raise HTTPException(status_code=400, detail="type must be phone, email, or whatsapp")

    occurred_at = None
    if data.get("occurred_at"):
        try:
            occurred_at = datetime.fromisoformat(data["occurred_at"])
        except ValueError:
            pass

    log = ConversationLog(
        lead_id=lead_id,
        user_id=current_user.id,
        type=conv_type,
        direction=data.get("direction", "outbound"),
        contact_value=data.get("contact_value"),
        duration_seconds=data.get("duration_seconds"),
        outcome=data.get("outcome"),
        summary=data.get("summary"),
        occurred_at=occurred_at or datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _conversation_dict(log)


@router.post("/{lead_id}/conversations/upload-transcript")
async def upload_transcript(
    lead_id: int,
    file: UploadFile = File(...),
    conv_type: str = Form("phone"),
    direction: str = Form("outbound"),
    contact_value: str = Form(""),
    duration_seconds: Optional[int] = Form(None),
    outcome: str = Form(""),
    summary: str = Form(""),
    occurred_at: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a transcript file (.txt, .pdf, .docx) for a phone/email conversation.
    Automatically generates an AI summary via Claude.
    """
    _get_lead_or_404(lead_id, db)

    # Read file content
    content_bytes = await file.read()
    transcript_text = ""

    filename_lower = (file.filename or "").lower()
    if filename_lower.endswith(".txt"):
        transcript_text = content_bytes.decode("utf-8", errors="replace")
    elif filename_lower.endswith(".pdf"):
        try:
            import fitz  # PyMuPDF
            import io
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            transcript_text = "\n".join(page.get_text() for page in doc)
        except Exception as e:
            logger.warning(f"PDF parse failed: {e}")
            transcript_text = content_bytes.decode("utf-8", errors="replace")
    elif filename_lower.endswith(".docx"):
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(content_bytes))
            transcript_text = "\n".join(para.text for para in doc.paragraphs)
        except Exception as e:
            logger.warning(f"DOCX parse failed: {e}")
            transcript_text = content_bytes.decode("utf-8", errors="replace")
    else:
        transcript_text = content_bytes.decode("utf-8", errors="replace")

    # Save the file — sanitize filename to prevent path traversal
    import re as _re
    _raw_name = os.path.basename(file.filename or "upload")
    _clean_name = _re.sub(r"[^A-Za-z0-9._\-]", "_", _raw_name)[:120]
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_name = f"transcript_{lead_id}_{int(datetime.now().timestamp())}_{_clean_name}"
    save_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    # Verify path stays within upload dir
    if not os.path.abspath(save_path).startswith(os.path.abspath(settings.UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="Invalid filename")
    with open(save_path, "wb") as f:
        f.write(content_bytes)

    # AI summarization
    ai_summary = ""
    if transcript_text.strip():
        ai_summary = await _ai_summarize(transcript_text, conv_type)

    occurred_at_dt = None
    if occurred_at:
        try:
            occurred_at_dt = datetime.fromisoformat(occurred_at)
        except ValueError:
            pass

    log = ConversationLog(
        lead_id=lead_id,
        user_id=current_user.id,
        type=conv_type,
        direction=direction,
        contact_value=contact_value or None,
        duration_seconds=duration_seconds,
        outcome=outcome or None,
        summary=summary or None,
        ai_summary=ai_summary or None,
        transcript_text=transcript_text,
        transcript_filename=safe_name,
        occurred_at=occurred_at_dt or datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _conversation_dict(log)


@router.post("/{lead_id}/conversations/whatsapp-import")
async def import_whatsapp(
    lead_id: int,
    file: UploadFile = File(...),
    contact_value: str = Form(""),
    occurred_at: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import a WhatsApp chat export (.txt) and parse it into a conversation log.
    Generates an AI summary automatically.
    """
    _get_lead_or_404(lead_id, db)

    content_bytes = await file.read()
    raw_text = content_bytes.decode("utf-8", errors="replace")

    # Parse the WhatsApp export
    parsed_text = _parse_whatsapp_export(raw_text)

    # AI summarization
    ai_summary = await _ai_summarize(parsed_text or raw_text, "whatsapp")

    occurred_at_dt = None
    if occurred_at:
        try:
            occurred_at_dt = datetime.fromisoformat(occurred_at)
        except ValueError:
            pass

    log = ConversationLog(
        lead_id=lead_id,
        user_id=current_user.id,
        type="whatsapp",
        direction="outbound",
        contact_value=contact_value or None,
        summary=None,
        ai_summary=ai_summary or None,
        transcript_text=parsed_text,
        whatsapp_raw=raw_text,
        occurred_at=occurred_at_dt or datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _conversation_dict(log)


@router.put("/{lead_id}/conversations/{conv_id}")
async def update_conversation(
    lead_id: int,
    conv_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update summary, outcome, or other fields of a conversation log."""
    _get_lead_or_404(lead_id, db)
    log = db.query(ConversationLog).filter(
        ConversationLog.id == conv_id, ConversationLog.lead_id == lead_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Conversation not found")

    for field in ("summary", "outcome", "direction", "contact_value", "duration_seconds"):
        if field in data:
            setattr(log, field, data[field])

    db.commit()
    db.refresh(log)
    return _conversation_dict(log)


@router.delete("/{lead_id}/conversations/{conv_id}")
async def delete_conversation(
    lead_id: int,
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a conversation log entry."""
    _get_lead_or_404(lead_id, db)
    log = db.query(ConversationLog).filter(
        ConversationLog.id == conv_id, ConversationLog.lead_id == lead_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(log)
    db.commit()
    return {"status": "deleted", "id": conv_id}
