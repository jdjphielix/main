"""
Google Calendar Sync Service — push callbacks as Calendar events.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx

from app.config import settings
from app.services.gmail_sync import refresh_google_token

logger = logging.getLogger(__name__)

CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"


async def create_calendar_event(
    user,
    callback,
    invited_users: Optional[List] = None,
    lead=None,
) -> Optional[str]:
    """
    Push a callback as a Google Calendar event for the owning user.

    Returns the Google Calendar event ID on success, or None if the user
    has no Google refresh token or the API call fails.
    """
    if not user.google_refresh_token:
        logger.info("User %s has no Google refresh token — skipping calendar sync", user.email)
        return None

    # Refresh access token
    access_token = await refresh_google_token(user.google_refresh_token)
    if not access_token:
        logger.warning("Could not refresh Google token for user %s", user.email)
        return None

    # Build event times (30 minute window)
    scheduled_at: datetime = callback.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    end_at = scheduled_at + timedelta(minutes=30)

    # Build title
    company_name = (lead.company_name if lead else None) or f"Lead #{callback.lead_id}"
    title = f"Callback: {company_name}"

    # Build attendees list
    attendees = [{"email": user.email}]
    if invited_users:
        for inv_user in invited_users:
            if inv_user.email and inv_user.email != user.email:
                attendees.append({"email": inv_user.email})

    # Build description
    description_parts = []
    if callback.internal_note:
        description_parts.append(f"Notitie: {callback.internal_note}")
    if callback.callback_type:
        cb_type_label = "Telefonisch gesprek" if callback.callback_type == "call" else "Meeting"
        description_parts.append(f"Type: {cb_type_label}")
    description = "\n".join(description_parts) if description_parts else ""

    event_body = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": scheduled_at.isoformat(),
            "timeZone": "Europe/Amsterdam",
        },
        "end": {
            "dateTime": end_at.isoformat(),
            "timeZone": "Europe/Amsterdam",
        },
        "attendees": attendees,
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 10},
            ],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{CALENDAR_API_BASE}/calendars/primary/events",
                json=event_body,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                params={"sendUpdates": "all"},  # send email invites to attendees
            )

        if resp.status_code in (200, 201):
            event_id = resp.json().get("id")
            logger.info("Created Google Calendar event %s for user %s", event_id, user.email)
            return event_id
        else:
            logger.warning(
                "Google Calendar API error %s for user %s: %s",
                resp.status_code, user.email, resp.text,
            )
            return None

    except Exception as exc:
        logger.error("Exception creating Google Calendar event for user %s: %s", user.email, exc)
        return None


async def delete_calendar_event(user, google_event_id: str) -> bool:
    """
    Delete a Google Calendar event by event ID.
    Returns True on success, False otherwise.
    """
    if not user.google_refresh_token or not google_event_id:
        return False

    access_token = await refresh_google_token(user.google_refresh_token)
    if not access_token:
        return False

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(
                f"{CALENDAR_API_BASE}/calendars/primary/events/{google_event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        return resp.status_code in (200, 204)
    except Exception as exc:
        logger.error("Exception deleting Google Calendar event %s: %s", google_event_id, exc)
        return False
