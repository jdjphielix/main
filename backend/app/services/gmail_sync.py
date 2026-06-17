"""
Gmail Sync Service — shared logic used by both the API endpoint and the background scheduler.
"""

import base64
import logging
from datetime import datetime, timezone
from email.header import decode_header as mime_decode_header
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.communication import ContactMethod, EmailSync
from app.models.lead import Lead, PipelineStage, ComplianceCase
from app.models.user import User

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"


async def refresh_google_token(refresh_token: str) -> Optional[str]:
    """Exchange a refresh token for a fresh access token. Returns None on failure."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        })
    if resp.status_code != 200:
        logger.warning("Gmail token refresh failed: %s", resp.text)
        return None
    return resp.json().get("access_token")


def decode_header_value(value: str) -> str:
    """Decode MIME-encoded email header value."""
    if not value:
        return ""
    parts = mime_decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return " ".join(decoded)


def extract_body(payload: dict) -> str:
    """Recursively extract the best available body (HTML preferred, then plain text)."""
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == "text/html" and body_data:
        return base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="replace")
    if mime_type == "text/plain" and body_data:
        text = base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="replace")
        # Wrap plain text in <pre> so it renders reasonably in the HTML viewer
        return f"<pre style='white-space:pre-wrap;font-family:inherit'>{text}</pre>"

    # Multipart: prefer HTML part
    html_part = None
    plain_part = None
    for part in payload.get("parts", []):
        part_mime = part.get("mimeType", "")
        if part_mime == "text/html":
            html_part = extract_body(part)
        elif part_mime == "text/plain":
            plain_part = extract_body(part)
        elif part_mime.startswith("multipart/"):
            result = extract_body(part)
            if result:
                return result

    return html_part or plain_part or ""


async def sync_emails_for_lead(
    lead_id: int,
    user: User,
    db: Session,
    max_results: int = 50,
) -> dict:
    """
    Core sync logic: fetch Gmail messages for a lead and persist new ones.

    Returns:
        {"synced": int, "skipped": int, "errors": list[str], "email_addresses": list[str]}
    """
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        return {"synced": 0, "skipped": 0, "errors": ["Lead not found"], "email_addresses": []}

    if not user.google_refresh_token:
        return {"synced": 0, "skipped": 0, "errors": ["No Google refresh token"], "email_addresses": []}

    # ── Collect email addresses for this lead ──────────────────────────────
    email_addresses = set()
    if lead.contact_email:
        email_addresses.add(lead.contact_email.lower().strip())

    contact_methods = db.query(ContactMethod).filter(
        ContactMethod.lead_id == lead_id,
        ContactMethod.type == "email",
    ).all()
    for cm in contact_methods:
        email_addresses.add(cm.value.lower().strip())

    if not email_addresses:
        return {"synced": 0, "skipped": 0, "errors": [], "email_addresses": []}

    # ── Refresh access token ───────────────────────────────────────────────
    access_token = await refresh_google_token(user.google_refresh_token)
    if not access_token:
        return {"synced": 0, "skipped": 0, "errors": ["Token refresh failed"], "email_addresses": list(email_addresses)}

    # Persist refreshed token
    user.google_access_token = access_token
    db.commit()

    headers = {"Authorization": f"Bearer {access_token}"}
    new_count = 0
    skip_count = 0
    errors = []

    # Pre-load all known gmail_message_ids for this lead to avoid N+1 queries
    existing_ids: set[str] = {
        row[0] for row in db.query(EmailSync.gmail_message_id)
        .filter(EmailSync.lead_id == lead_id)
        .all()
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for email_addr in email_addresses:
            query = f"from:{email_addr} OR to:{email_addr}"

            list_resp = await client.get(
                f"{GMAIL_API_BASE}/users/me/messages",
                headers=headers,
                params={"q": query, "maxResults": max_results},
            )

            if list_resp.status_code == 401:
                errors.append(f"Gmail auth expired for {email_addr}")
                continue
            if list_resp.status_code != 200:
                errors.append(f"List failed for {email_addr}: {list_resp.status_code}")
                continue

            messages = list_resp.json().get("messages", [])

            for msg_ref in messages:
                gmail_id = msg_ref["id"]

                # Skip already-synced messages
                if gmail_id in existing_ids:
                    skip_count += 1
                    continue
                existing_ids.add(gmail_id)  # prevent duplicates within same sync run

                # Fetch full message
                msg_resp = await client.get(
                    f"{GMAIL_API_BASE}/users/me/messages/{gmail_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if msg_resp.status_code != 200:
                    continue

                msg_data = msg_resp.json()
                payload = msg_data.get("payload", {})
                headers_list = payload.get("headers", [])
                header_map = {h["name"].lower(): h["value"] for h in headers_list}

                subject = decode_header_value(header_map.get("subject", "(geen onderwerp)"))
                from_email = header_map.get("from", "")
                to_email = header_map.get("to", "")
                date_str = header_map.get("date", "")
                snippet = msg_data.get("snippet", "")
                thread_id = msg_data.get("threadId", "")

                # Parse date
                received_at = None
                if date_str:
                    try:
                        received_at = parsedate_to_datetime(date_str)
                    except Exception:
                        received_at = datetime.now(timezone.utc)

                # Determine direction
                user_email = user.email.lower()
                direction = "outbound" if user_email in from_email.lower() else "inbound"

                body_html = extract_body(payload)

                # Check if a ComplianceCase exists for this thread
                compliance_case_id = None
                if thread_id:
                    existing_case = db.query(ComplianceCase).filter(
                        ComplianceCase.gmail_thread_id == thread_id
                    ).first()
                    if existing_case:
                        compliance_case_id = existing_case.id

                email_sync = EmailSync(
                    lead_id=lead_id,
                    user_id=user.id,
                    gmail_message_id=gmail_id,
                    gmail_thread_id=thread_id,
                    subject=subject,
                    from_email=from_email,
                    to_email=to_email,
                    snippet=snippet,
                    body_html=body_html,
                    direction=direction,
                    received_at=received_at,
                    compliance_case_id=compliance_case_id,
                )
                db.add(email_sync)
                new_count += 1

    if new_count > 0:
        db.commit()

    return {
        "synced": new_count,
        "skipped": skip_count,
        "errors": errors,
        "email_addresses": list(email_addresses),
    }


async def sync_all_active_leads(db: Session) -> dict:
    """
    Background scheduler job: sync Gmail for ALL active leads using ALL users' tokens.

    Strategy: build a pool of every active user who has a Google refresh token, then
    run sync_emails_for_lead for each (lead, user) combination.  This ensures that
    correspondence sent or received by *any* team member is captured for every lead,
    so the full email history is visible to the whole team regardless of who owns the lead.

    Deduplication is handled inside sync_emails_for_lead via the gmail_message_id index.
    """
    active_stages = [
        PipelineStage.LEAD.value,
        PipelineStage.PROSPECT.value,
        PipelineStage.ONBOARDING_SALES.value,
        PipelineStage.ONBOARDING_BACKOFFICE.value,
        PipelineStage.CLIENT.value,
    ]

    # ── Build token pool: all active users with a Google refresh token ─────────
    token_pool: list[User] = (
        db.query(User)
        .filter(
            User.status == "active",
            User.google_refresh_token.isnot(None),
            User.google_refresh_token != "",
        )
        .all()
    )

    if not token_pool:
        logger.info("Auto-sync skipped: no users have a Google refresh token")
        return {"leads_processed": 0, "total_synced": 0, "errors": []}

    leads = (
        db.query(Lead)
        .filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage.in_(active_stages),
        )
        .all()
    )

    # Pre-filter: skip leads with no email address at all
    lead_ids_with_email: list[Lead] = []
    for lead in leads:
        if lead.contact_email:
            lead_ids_with_email.append(lead)
            continue
        cm_count = db.query(ContactMethod).filter(
            ContactMethod.lead_id == lead.id,
            ContactMethod.type == "email",
        ).count()
        if cm_count > 0:
            lead_ids_with_email.append(lead)

    total_synced = 0
    leads_touched: set[int] = set()
    errors = []

    for lead in lead_ids_with_email:
        for user in token_pool:
            try:
                result = await sync_emails_for_lead(lead.id, user, db)
                if result["synced"] > 0:
                    total_synced += result["synced"]
                    leads_touched.add(lead.id)
                # Log per-user errors at debug level to avoid noise
                for err in result.get("errors", []):
                    logger.debug("Sync lead=%s user=%s: %s", lead.id, user.id, err)
            except Exception as exc:
                errors.append(f"Lead {lead.id} / User {user.id}: {exc}")
                logger.error("Sync error for lead %s user %s: %s", lead.id, user.id, exc)

    logger.info(
        "Auto-sync complete: %d users × %d leads → %d leads touched, %d new emails",
        len(token_pool),
        len(lead_ids_with_email),
        len(leads_touched),
        total_synced,
    )
    return {
        "leads_processed": len(leads_touched),
        "total_synced": total_synced,
        "errors": errors,
    }


async def sync_compliance_inbox(db: Session) -> dict:
    """
    Sync emails for the compliance-sync@taperpay.com account.
    All incoming emails are scanned and matched against company names in the leads database.
    iBanFirst is a partner/sender — we match on email CONTENT, not sender.
    """
    from app.models.user import User
    from app.models.lead import Lead, ComplianceCase

    # Find compliance-sync user
    sync_user = db.query(User).filter(
        User.email == 'compliance-sync@taperpay.com',
        User.status == 'active',
    ).first()

    if not sync_user or not sync_user.google_refresh_token:
        logger.info("compliance-sync@taperpay.com user not found or no token — skipping")
        return {"synced": 0, "matched": 0}

    access_token = await refresh_google_token(sync_user.google_refresh_token)
    if not access_token:
        logger.warning("Could not refresh token for compliance-sync user")
        return {"synced": 0, "matched": 0}

    # Update access token
    sync_user.google_access_token = access_token
    db.commit()

    headers = {"Authorization": f"Bearer {access_token}"}

    # Fetch all recent emails (no address filter — we want everything in the inbox)
    async with httpx.AsyncClient(timeout=30.0) as client:
        list_resp = await client.get(
            f"{GMAIL_API_BASE}/users/me/messages",
            headers=headers,
            params={"maxResults": 100, "q": "in:inbox"},
        )

    if list_resp.status_code != 200:
        logger.warning("Compliance inbox fetch failed: %s", list_resp.status_code)
        return {"synced": 0, "matched": 0}

    messages = list_resp.json().get("messages", [])

    # Load all active leads for matching (company_name)
    leads = db.query(Lead).filter(Lead.is_deleted == False).all()

    new_count = 0
    matched_count = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for msg_ref in messages:
            gmail_id = msg_ref["id"]

            # Skip already synced
            if db.query(EmailSync).filter(EmailSync.gmail_message_id == gmail_id).first():
                continue

            # Fetch full message
            msg_resp = await client.get(
                f"{GMAIL_API_BASE}/users/me/messages/{gmail_id}",
                headers=headers,
                params={"format": "full"},
            )
            if msg_resp.status_code != 200:
                continue

            msg_data = msg_resp.json()
            payload = msg_data.get("payload", {})
            headers_list = payload.get("headers", [])
            header_map = {h["name"].lower(): h["value"] for h in headers_list}

            subject = decode_header_value(header_map.get("subject", "(geen onderwerp)"))
            from_email = header_map.get("from", "")
            to_email = header_map.get("to", "")
            date_str = header_map.get("date", "")
            snippet = msg_data.get("snippet", "")
            thread_id = msg_data.get("threadId", "")

            received_at = None
            if date_str:
                try:
                    received_at = parsedate_to_datetime(date_str)
                except Exception:
                    received_at = datetime.now(timezone.utc)

            body_html = extract_body(payload)

            # Match against company names — search in subject + snippet + body
            search_text = f"{subject} {snippet} {body_html}".lower()
            matched_lead = None
            for lead in leads:
                if lead.company_name and len(lead.company_name) > 3:
                    if lead.company_name.lower() in search_text:
                        matched_lead = lead
                        break

            lead_id = matched_lead.id if matched_lead else None

            # Check for existing compliance case via thread_id
            compliance_case_id = None
            if thread_id:
                existing_case = db.query(ComplianceCase).filter(
                    ComplianceCase.gmail_thread_id == thread_id
                ).first()
                if existing_case:
                    compliance_case_id = existing_case.id

            direction = "inbound"  # Compliance inbox receives inbound

            # Save as EmailSync (only if we matched a lead)
            if lead_id:
                email_sync = EmailSync(
                    lead_id=lead_id,
                    user_id=sync_user.id,
                    gmail_message_id=gmail_id,
                    gmail_thread_id=thread_id,
                    subject=subject,
                    from_email=from_email,
                    to_email=to_email,
                    snippet=snippet,
                    body_html=body_html,
                    direction=direction,
                    received_at=received_at,
                    compliance_case_id=compliance_case_id,
                )
                db.add(email_sync)
                new_count += 1
                matched_count += 1

    if new_count > 0:
        db.commit()

    logger.info("Compliance inbox sync: %d new emails, %d matched to leads", new_count, matched_count)
    return {"synced": new_count, "matched": matched_count}
