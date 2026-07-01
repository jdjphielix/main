"""Tickets router — internal support/task tickets."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models.ticket import Ticket
from app.models.user import User
from app.routers.auth import get_current_user
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1/tickets", tags=["tickets"])

# Roles that may NOT access tickets at all (module is internal/backoffice only)
_TICKET_BLOCKED_ROLES = ("sales", "extern")


def _block_sales_extern(current_user: User):
    """Raise 403 for sales/extern users. Teamleaders are always allowed."""
    if current_user.role in _TICKET_BLOCKED_ROLES and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Geen toegang tot tickets")


def _serialize_ticket(t: Ticket, created_by_name=None, assigned_to_name=None):
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "category": t.category,
        "broker": t.broker,
        "created_by_id": t.created_by_id,
        "created_by_name": created_by_name,
        "assigned_to_id": t.assigned_to_id,
        "assigned_to_name": assigned_to_name,
        "related_lead_id": t.related_lead_id,
        "follow_up_date": t.follow_up_date.isoformat() if t.follow_up_date else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
    }


def _parse_iso_dt(raw):
    """Safely parse an ISO date/datetime string into a datetime; returns None on failure."""
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    try:
        s = str(raw).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


@router.get("/")
async def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    my_tickets: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List tickets — admins see all, others see own + assigned. Blocked for sales/extern."""
    _block_sales_extern(current_user)
    query = db.query(Ticket)
    is_admin = current_user.role in ("admin_pay", "admin_trade") or current_user.is_teamleader
    if not is_admin:
        from sqlalchemy import or_
        query = query.filter(
            or_(Ticket.created_by_id == current_user.id, Ticket.assigned_to_id == current_user.id)
        )
    if my_tickets:
        query = query.filter(Ticket.created_by_id == current_user.id)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    tickets = query.order_by(desc(Ticket.created_at)).limit(200).all()

    # Resolve names
    user_ids = set()
    for t in tickets:
        if t.created_by_id: user_ids.add(t.created_by_id)
        if t.assigned_to_id: user_ids.add(t.assigned_to_id)
    user_map = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    return [_serialize_ticket(t, user_map.get(t.created_by_id), user_map.get(t.assigned_to_id)) for t in tickets]


@router.post("/")
async def create_ticket(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new ticket."""
    _block_sales_extern(current_user)
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Title is required")
    ticket = Ticket(
        title=data["title"],
        description=data.get("description"),
        priority=data.get("priority", "normal"),
        category=data.get("category", "other"),
        related_lead_id=data.get("related_lead_id"),
        created_by_id=current_user.id,
        assigned_to_id=data.get("assigned_to_id"),
        status=data.get("status", "open"),
        broker=data.get("broker"),
        follow_up_date=_parse_iso_dt(data.get("follow_up_date")),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket, current_user.full_name)


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update ticket status, priority, assignment."""
    _block_sales_extern(current_user)
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    is_admin = current_user.role in ("admin_pay", "admin_trade") or current_user.is_teamleader
    if not is_admin and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    for key in ["title", "description", "status", "priority", "category", "assigned_to_id", "related_lead_id", "broker"]:
        if key in data:
            setattr(ticket, key, data[key])
    if "follow_up_date" in data:
        ticket.follow_up_date = _parse_iso_dt(data.get("follow_up_date"))
    if data.get("status") in ("resolved", "closed"):
        ticket.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    return _serialize_ticket(ticket)


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _block_sales_extern(current_user)
    is_admin = current_user.role in ("admin_pay", "admin_trade") or current_user.is_teamleader
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not is_admin and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(ticket)
    db.commit()
    return {"status": "deleted"}
