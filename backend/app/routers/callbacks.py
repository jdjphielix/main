"""Callbacks router: schedule, update, complete, internal/external attendees."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime, timezone, date
import logging

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.communication import Callback
from app.models.notification import ActivityLog
from app.services.calendar_sync import create_calendar_event

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
async def list_callbacks(
    user_id: Optional[int] = None,
    today_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List callbacks for current user.
    Filter to today's callbacks if today_only=True.
    If user_id provided (admin only), list for that user.
    """
    _is_admin = current_user.role in ("admin_pay", "admin_trade")
    if user_id and not _is_admin:
        raise HTTPException(status_code=403, detail="Geen toegang tot callbacks van andere gebruikers")
    user_filter_id = user_id if (user_id and _is_admin) else current_user.id

    query = db.query(Callback).options(
        joinedload(Callback.lead),
        joinedload(Callback.created_by),
    ).filter(
        Callback.is_completed == False,
    )

    # If any internal_attendees or created_by, include
    query = query.filter(
        (Callback.created_by_id == user_filter_id) |
        (Callback.internal_attendees.isnot(None))
    )

    if today_only:
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
        today_end = datetime.combine(date.today(), datetime.max.time()).replace(tzinfo=timezone.utc)
        query = query.filter(
            Callback.scheduled_at >= today_start,
            Callback.scheduled_at <= today_end,
        )

    callbacks = query.order_by(Callback.scheduled_at.asc()).all()

    def serialize_callback(cb):
        data = {c.name: getattr(cb, c.name) for c in cb.__table__.columns}
        for key, val in data.items():
            if hasattr(val, 'isoformat'):
                data[key] = val.isoformat()
        # Include lead info for display
        if cb.lead:
            data["lead"] = {
                "id": cb.lead.id,
                "company_name": cb.lead.company_name,
                "contact_name": cb.lead.contact_name,
                "contact_phone": cb.lead.contact_phone,
                "contact_mobile": cb.lead.contact_mobile,
                "contact_email": cb.lead.contact_email,
            }
        if cb.created_by:
            data["created_by_name"] = cb.created_by.full_name
        return data

    return {"callbacks": [serialize_callback(cb) for cb in callbacks], "total": len(callbacks)}


@router.post("/")
async def create_callback(
    callback_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create callback/meeting.
    Payload: {
        "lead_id": int,
        "scheduled_at": "2024-01-15T10:00:00Z",
        "callback_type": "call|meeting",
        "internal_attendees": [user_id, ...] (optional),
        "internal_note": str (optional),
        "external_attendees": ["email@example.com", ...] (optional),
        "external_note": str (optional),
        "add_to_calendar": bool (optional, default False),
        "invited_user_ids": [user_id, ...] (optional) — colleagues to add as calendar attendees,
    }
    """
    lead_id = callback_data.get("lead_id")
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    scheduled_at = datetime.fromisoformat(callback_data["scheduled_at"])
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    # Resolve invited user IDs
    invited_user_ids = callback_data.get("invited_user_ids") or []
    invited_users = []
    if invited_user_ids:
        invited_users = db.query(User).filter(User.id.in_(invited_user_ids)).all()

    callback = Callback(
        lead_id=lead_id,
        created_by_id=current_user.id,
        scheduled_at=scheduled_at,
        callback_type=callback_data.get("callback_type", "call"),
        internal_attendees=callback_data.get("internal_attendees"),
        internal_note=callback_data.get("internal_note"),
        external_attendees=callback_data.get("external_attendees"),
        external_note=callback_data.get("external_note"),
        add_to_calendar=callback_data.get("add_to_calendar", False),
        invited_user_ids=invited_user_ids if invited_user_ids else None,
    )
    db.add(callback)
    db.commit()
    db.refresh(callback)

    # Determine company name for use in email subjects
    company_name = lead.company_name if lead else f"Lead #{callback.lead_id}"

    # Google Calendar sync
    if callback_data.get("add_to_calendar", False):
        try:
            event_id = await create_calendar_event(
                user=current_user,
                callback=callback,
                invited_users=invited_users,
                lead=lead,
            )
            if event_id:
                callback.google_event_id = event_id
                db.commit()
        except Exception:
            pass  # Calendar sync failure is non-fatal

    # Send email invites to invited users
    if invited_users:
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import base64
        from app.services.gmail_sync import refresh_google_token
        import httpx

        # Use the creator's Google account to send
        if current_user.google_refresh_token:
            access_token = await refresh_google_token(current_user.google_refresh_token)
            if access_token:
                for inv_user in invited_users:
                    if not inv_user.email:
                        continue
                    mime_msg = MIMEMultipart('alternative')
                    mime_msg['Subject'] = f"Uitnodiging: Callback {company_name} — {callback.scheduled_at.strftime('%d %b %Y %H:%M')}"
                    mime_msg['From'] = current_user.email
                    mime_msg['To'] = inv_user.email

                    html_body = f"""
                    <div style="font-family:sans-serif; max-width:500px">
                      <h2 style="color:#011745">📅 Callback uitnodiging</h2>
                      <p>Hallo {inv_user.full_name or inv_user.email},</p>
                      <p>{current_user.full_name or current_user.email} heeft je uitgenodigd voor een callback:</p>
                      <div style="background:#eef2fa;border-radius:8px;padding:16px;margin:16px 0">
                        <p style="margin:4px 0"><strong>Bedrijf:</strong> {company_name}</p>
                        <p style="margin:4px 0"><strong>Datum:</strong> {callback.scheduled_at.strftime('%A %d %B %Y')}</p>
                        <p style="margin:4px 0"><strong>Tijd:</strong> {callback.scheduled_at.strftime('%H:%M')}</p>
                        <p style="margin:4px 0"><strong>Type:</strong> {'Telefoongesprek' if callback.callback_type == 'call' else 'Meeting'}</p>
                      </div>
                      {f'<p><em>Notitie: {callback.internal_note}</em></p>' if callback.internal_note else ''}
                      <p>Deze afspraak is ook toegevoegd aan je Google Calendar.</p>
                      <hr style="border:none;border-top:1px solid #e8eaf2;margin:16px 0"/>
                      <p style="font-size:12px;color:#7b859e">TaperPay Backoffice</p>
                    </div>
                    """
                    mime_msg.attach(MIMEText(html_body, 'html'))

                    raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode()
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            await client.post(
                                'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                                headers={'Authorization': f'Bearer {access_token}'},
                                json={'raw': raw},
                            )
                    except Exception as e:
                        logger.warning("Failed to send invite email to %s: %s", inv_user.email, e)

    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=lead_id,
        action="created_callback",
        entity_type="callback",
        entity_id=callback.id,
        details={
            "scheduled_at": scheduled_at.isoformat(),
            "callback_type": callback_data.get("callback_type", "call"),
        },
    )
    db.add(activity)
    db.commit()

    result = {c.name: getattr(callback, c.name) for c in callback.__table__.columns}
    for key, val in result.items():
        if hasattr(val, 'isoformat'):
            result[key] = val.isoformat()
    return result


def _assert_callback_owner(callback: Callback, current_user: User):
    """Raise 403 if caller is not the creator and not an admin."""
    is_admin = current_user.role in ("admin_pay", "admin_trade")
    if not is_admin and callback.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Geen toegang tot deze callback")


@router.put("/{callback_id}")
async def update_callback(
    callback_id: int,
    callback_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update callback details. Only the creator or an admin may update."""
    callback = db.query(Callback).filter(Callback.id == callback_id).first()
    if not callback:
        raise HTTPException(status_code=404, detail="Callback not found")
    _assert_callback_owner(callback, current_user)

    # Update allowed fields
    updateable = [
        "scheduled_at", "callback_type", "internal_attendees", "internal_note",
        "external_attendees", "external_note", "add_to_calendar", "invited_user_ids",
    ]
    for field in updateable:
        if field in callback_data:
            if field == "scheduled_at":
                value = datetime.fromisoformat(callback_data[field])
                if value.tzinfo is None:
                    value = value.replace(tzinfo=timezone.utc)
                setattr(callback, field, value)
            else:
                setattr(callback, field, callback_data[field])

    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=callback.lead_id,
        action="updated_callback",
        entity_type="callback",
        entity_id=callback.id,
        details={"fields": list(callback_data.keys())},
    )
    db.add(activity)
    db.commit()  # single commit for both update + activity

    result = {c.name: getattr(callback, c.name) for c in callback.__table__.columns}
    for key, val in result.items():
        if hasattr(val, 'isoformat'):
            result[key] = val.isoformat()
    return result


@router.post("/{callback_id}/complete")
async def complete_callback(
    callback_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark callback as completed. Only the creator or an admin may complete."""
    callback = db.query(Callback).filter(Callback.id == callback_id).first()
    if not callback:
        raise HTTPException(status_code=404, detail="Callback not found")
    _assert_callback_owner(callback, current_user)

    callback.is_completed = True
    callback.completed_at = datetime.now(timezone.utc)

    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=callback.lead_id,
        action="completed_callback",
        entity_type="callback",
        entity_id=callback.id,
        details={"notes": notes},
    )
    db.add(activity)
    db.commit()  # single commit

    return {"status": "completed", "callback_id": callback_id}


@router.delete("/{callback_id}")
async def delete_callback(
    callback_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete callback. Only the creator or an admin may delete."""
    callback = db.query(Callback).filter(Callback.id == callback_id).first()
    if not callback:
        raise HTTPException(status_code=404, detail="Callback not found")
    _assert_callback_owner(callback, current_user)

    lead_id = callback.lead_id
    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=lead_id,
        action="deleted_callback",
        entity_type="callback",
        entity_id=callback_id,
    )
    db.add(activity)
    db.delete(callback)
    db.commit()  # single commit

    return {"status": "deleted"}
