"""Compliance email system router.

Endpoints:
  GET  /proposed               — email threads that look compliance-related, not yet linked
  POST /cases/from-email       — create a ComplianceCase from an email thread
  GET  /cases/{case_id}/thread — full email thread for a case
  POST /cases/{case_id}/reply  — send a Gmail reply and save it as EmailSync
"""

import base64
import logging
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.communication import EmailSync
from app.models.lead import Lead, ComplianceCase
from app.models.user import User
from app.services.gmail_sync import refresh_google_token

router = APIRouter()
logger = logging.getLogger(__name__)

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

COMPLIANCE_KEYWORDS = [
    "additional information",
    "documentation",
    "transaction",
    "compliance",
    "aml",
    "kyc",
    "invoice",
    "bill of lading",
    "supporting",
    "verify",
]


def _email_dict(e: EmailSync) -> dict:
    lead_name = None
    if hasattr(e, "lead") and e.lead:
        lead_name = e.lead.company_name
    return {
        "id": e.id,
        "lead_id": e.lead_id,
        "lead_name": lead_name,
        "gmail_message_id": e.gmail_message_id,
        "gmail_thread_id": e.gmail_thread_id,
        "subject": e.subject,
        "from_email": e.from_email,
        "to_email": e.to_email,
        "snippet": e.snippet,
        "body_html": e.body_html,
        "direction": e.direction,
        "received_at": e.received_at.isoformat() if e.received_at else None,
        "compliance_case_id": e.compliance_case_id,
    }


def _has_compliance_keyword(email: EmailSync) -> bool:
    """Return True if subject, snippet, or body_html contains a compliance keyword."""
    text = " ".join(filter(None, [
        (email.subject or "").lower(),
        (email.snippet or "").lower(),
        (email.body_html or "").lower(),
    ]))
    return any(kw in text for kw in COMPLIANCE_KEYWORDS)


# ── GET /proposed ─────────────────────────────────────────────────────────────

@router.get("/proposed")
async def get_proposed_emails(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Return EmailSync records that:
    - Have no compliance_case_id yet
    - Were received in the last 30 days
    - Contain compliance-related keywords
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    COMPLIANCE_KEYWORDS_DB = [
        "%additional information%", "%documentation%", "%transaction%",
        "%compliance%", "%aml%", "%kyc%", "%invoice%",
        "%bill of lading%", "%supporting%", "%verify%",
    ]

    keyword_filter = or_(
        *[
            or_(
                EmailSync.subject.ilike(kw),
                EmailSync.snippet.ilike(kw),
            )
            for kw in COMPLIANCE_KEYWORDS_DB
        ]
    )

    emails = (
        db.query(EmailSync)
        .filter(
            EmailSync.compliance_case_id.is_(None),
            EmailSync.received_at >= cutoff,
            keyword_filter,
        )
        .order_by(EmailSync.received_at.desc())
        .limit(200)
        .all()
    )

    # Second-pass filter: also check body_html which is not in the DB pre-filter
    matching = [e for e in emails if _has_compliance_keyword(e)]

    # Enrich with lead name
    lead_ids = {e.lead_id for e in matching}
    leads_by_id = {}
    if lead_ids:
        leads = db.query(Lead).filter(Lead.id.in_(lead_ids)).all()
        leads_by_id = {l.id: l for l in leads}

    result = []
    for e in matching:
        lead = leads_by_id.get(e.lead_id)
        result.append({
            "id": e.id,
            "lead_id": e.lead_id,
            "lead_name": lead.company_name if lead else None,
            "gmail_thread_id": e.gmail_thread_id,
            "subject": e.subject,
            "from_email": e.from_email,
            "to_email": e.to_email,
            "snippet": e.snippet,
            "received_at": e.received_at.isoformat() if e.received_at else None,
        })

    return {"emails": result, "total": len(result)}


# ── POST /scan-inbox ──────────────────────────────────────────────────────────

@router.post("/scan-inbox")
async def scan_compliance_inbox(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Manually trigger a compliance inbox scan."""
    from app.services.gmail_sync import sync_compliance_inbox
    result = await sync_compliance_inbox(db)
    return {"status": "ok", **result}


# ── POST /cases/from-email ─────────────────────────────────────────────────────

@router.post("/cases/from-email")
async def create_case_from_email(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a ComplianceCase from an email.
    Body: { email_id, title, description, priority, broker, lead_id }
    Also links the gmail_thread_id and back-fills compliance_case_id on all
    EmailSync records sharing the same thread.
    """
    email_id = data.get("email_id")
    if not email_id:
        raise HTTPException(status_code=400, detail="email_id is required")

    email = db.query(EmailSync).filter(EmailSync.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    lead_id = data.get("lead_id") or email.lead_id
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    case = ComplianceCase(
        lead_id=lead_id,
        created_by_id=current_user.id,
        title=data.get("title", email.subject or "Compliance Request"),
        description=data.get("description", ""),
        status="open",
        priority=data.get("priority", "normal"),
        broker=data.get("broker"),
        gmail_thread_id=email.gmail_thread_id,
    )
    db.add(case)
    db.flush()  # get case.id before commit

    # Back-fill all EmailSync records in the same thread
    if email.gmail_thread_id:
        db.query(EmailSync).filter(
            EmailSync.gmail_thread_id == email.gmail_thread_id,
            EmailSync.compliance_case_id.is_(None),
        ).update({"compliance_case_id": case.id}, synchronize_session=False)

    db.commit()
    db.refresh(case)

    return {
        "id": case.id,
        "lead_id": case.lead_id,
        "title": case.title,
        "status": case.status,
        "priority": case.priority,
        "broker": case.broker,
        "gmail_thread_id": case.gmail_thread_id,
        "created_at": case.created_at.isoformat() if case.created_at else None,
    }


# ── GET /cases/{case_id}/thread ───────────────────────────────────────────────

@router.get("/cases/{case_id}/thread")
async def get_case_thread(
    case_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return all EmailSync records belonging to the case's gmail_thread_id."""
    case = db.query(ComplianceCase).filter(ComplianceCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    if not case.gmail_thread_id:
        return {"emails": [], "case_id": case_id}

    emails = (
        db.query(EmailSync)
        .filter(EmailSync.gmail_thread_id == case.gmail_thread_id)
        .order_by(EmailSync.received_at.asc())
        .all()
    )

    # Enrich with lead names
    lead_ids = {e.lead_id for e in emails}
    leads_by_id = {}
    if lead_ids:
        leads = db.query(Lead).filter(Lead.id.in_(lead_ids)).all()
        leads_by_id = {l.id: l for l in leads}

    result = []
    for e in emails:
        lead = leads_by_id.get(e.lead_id)
        result.append({
            "id": e.id,
            "lead_id": e.lead_id,
            "lead_name": lead.company_name if lead else None,
            "gmail_message_id": e.gmail_message_id,
            "gmail_thread_id": e.gmail_thread_id,
            "subject": e.subject,
            "from_email": e.from_email,
            "to_email": e.to_email,
            "snippet": e.snippet,
            "body_html": e.body_html,
            "direction": e.direction,
            "received_at": e.received_at.isoformat() if e.received_at else None,
            "compliance_case_id": e.compliance_case_id,
        })

    return {"emails": result, "total": len(result), "case_id": case_id}


# ── POST /cases/{case_id}/reply ───────────────────────────────────────────────

@router.post("/cases/{case_id}/reply")
async def reply_to_case(
    case_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Send a Gmail reply on behalf of the current user and save it as EmailSync.
    Body: { message: str, to_email: str }
    """
    case = db.query(ComplianceCase).filter(ComplianceCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    message_text = data.get("message", "").strip()
    to_email = data.get("to_email", "").strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="message is required")
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email is required")

    if not current_user.google_refresh_token:
        raise HTTPException(status_code=400, detail="No Google account connected for current user")

    access_token = await refresh_google_token(current_user.google_refresh_token)
    if not access_token:
        raise HTTPException(status_code=502, detail="Gmail token refresh failed")

    # Persist refreshed token
    current_user.google_access_token = access_token
    db.commit()

    # Build MIME message
    mime_msg = MIMEMultipart("alternative")
    mime_msg["Subject"] = f"Re: {case.title}"
    mime_msg["From"] = current_user.email
    mime_msg["To"] = to_email

    # Threading headers
    if case.gmail_thread_id:
        mime_msg["In-Reply-To"] = case.gmail_thread_id
        mime_msg["References"] = case.gmail_thread_id

    html_part = MIMEText(f"<div style='font-family:sans-serif'>{message_text}</div>", "html")
    plain_part = MIMEText(message_text, "plain")
    mime_msg.attach(plain_part)
    mime_msg.attach(html_part)

    raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")

    payload = {"raw": raw}
    if case.gmail_thread_id:
        payload["threadId"] = case.gmail_thread_id

    async with httpx.AsyncClient(timeout=30.0) as client:
        send_resp = await client.post(
            f"{GMAIL_API_BASE}/users/me/messages/send",
            headers={"Authorization": f"Bearer {access_token}"},
            json=payload,
        )

    if send_resp.status_code not in (200, 201):
        logger.error("Gmail send failed: %s %s", send_resp.status_code, send_resp.text)
        raise HTTPException(status_code=502, detail=f"Gmail send failed: {send_resp.status_code}")

    sent_data = send_resp.json()
    gmail_msg_id = sent_data.get("id")
    thread_id = sent_data.get("threadId") or case.gmail_thread_id

    # Save sent email as EmailSync
    email_sync = EmailSync(
        lead_id=case.lead_id,
        user_id=current_user.id,
        gmail_message_id=gmail_msg_id,
        gmail_thread_id=thread_id,
        subject=f"Re: {case.title}",
        from_email=current_user.email,
        to_email=to_email,
        snippet=message_text[:200],
        body_html=f"<div style='font-family:sans-serif'>{message_text}</div>",
        direction="outbound",
        received_at=datetime.now(timezone.utc),
        compliance_case_id=case_id,
    )
    db.add(email_sync)
    db.commit()
    db.refresh(email_sync)

    return {
        "status": "sent",
        "email_sync_id": email_sync.id,
        "gmail_message_id": gmail_msg_id,
        "thread_id": thread_id,
    }
