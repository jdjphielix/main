"""Limit Orders router — price level alerts per client."""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.lead import Lead, LimitOrder, PipelineStage
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


def _limit_dict(lo: LimitOrder) -> dict:
    return {
        "id": lo.id,
        "lead_id": lo.lead_id,
        "company_name": lo.lead.company_name if lo.lead else None,
        "currency_pair": lo.currency_pair,
        "rate": lo.rate,
        "volume": lo.volume,
        "direction": lo.direction,
        "status": lo.status,
        "notes": lo.notes,
        "created_by_id": lo.created_by_id,
        "created_by_name": lo.created_by.full_name if lo.created_by else None,
        "created_at": lo.created_at.isoformat() if lo.created_at else None,
        "triggered_at": lo.triggered_at.isoformat() if lo.triggered_at else None,
    }


@router.get("/")
async def list_limit_orders(
    status: Optional[str] = "active",
    lead_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all limit orders, sorted by rate ascending."""
    query = db.query(LimitOrder)
    if status:
        query = query.filter(LimitOrder.status == status)
    if lead_id:
        query = query.filter(LimitOrder.lead_id == lead_id)
    orders = query.order_by(LimitOrder.currency_pair, LimitOrder.rate.asc()).all()
    return {"limit_orders": [_limit_dict(lo) for lo in orders], "total": len(orders)}


@router.post("/")
async def create_limit_order(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new limit order for a client."""
    lead_id = data.get("lead_id")
    if not lead_id:
        raise HTTPException(status_code=400, detail="lead_id is required")

    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    currency_pair = (data.get("currency_pair") or "").upper().replace("/", "").replace("-", "")
    rate = data.get("rate")
    if not currency_pair or rate is None:
        raise HTTPException(status_code=400, detail="currency_pair and rate are required")

    lo = LimitOrder(
        lead_id=lead_id,
        currency_pair=currency_pair,
        rate=float(rate),
        volume=data.get("volume"),
        direction=data.get("direction"),
        notes=data.get("notes"),
        status="active",
        created_by_id=current_user.id,
    )
    db.add(lo)
    db.commit()
    db.refresh(lo)
    return _limit_dict(lo)


@router.put("/{order_id}")
async def update_limit_order(
    order_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update status, notes, or trigger a limit order."""
    lo = db.query(LimitOrder).filter(LimitOrder.id == order_id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Not found")

    for field in ["status", "notes", "rate", "volume", "direction"]:
        if field in data:
            setattr(lo, field, data[field])

    if data.get("status") == "triggered" and not lo.triggered_at:
        lo.triggered_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(lo)
    return _limit_dict(lo)


@router.delete("/{order_id}")
async def delete_limit_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete / cancel a limit order."""
    lo = db.query(LimitOrder).filter(LimitOrder.id == order_id).first()
    if not lo:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(lo)
    db.commit()
    return {"status": "deleted"}


@router.post("/parse-command")
async def parse_limit_command(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Parse a text command like '@limit eurusd 1.17' or '@limit @volume 500K 1.17 eurusd'
    and create a limit order for the given lead_id.
    """
    command = (data.get("command") or "").strip()
    lead_id = data.get("lead_id")

    if not command or not lead_id:
        raise HTTPException(status_code=400, detail="command and lead_id are required")

    # Parse volume if @volume present
    volume = None
    volume_match = re.search(r'@volume\s+([\d.]+)\s*([KkMm]?)', command, re.IGNORECASE)
    if volume_match:
        vol_num = float(volume_match.group(1))
        vol_suffix = volume_match.group(2).upper()
        if vol_suffix == 'K':
            vol_num *= 1_000
        elif vol_suffix == 'M':
            vol_num *= 1_000_000
        volume = vol_num

    # Extract rate (decimal number like 1.17)
    rate_match = re.search(r'\b(\d+\.\d+)\b', command)
    if not rate_match:
        raise HTTPException(status_code=400, detail="No rate found in command")
    rate = float(rate_match.group(1))

    # Extract currency pair (6-char like EURUSD or EUR/USD)
    pair_match = re.search(r'\b([A-Z]{3}[/\-]?[A-Z]{3})\b', command.upper())
    if not pair_match:
        raise HTTPException(status_code=400, detail="No currency pair found in command")
    currency_pair = pair_match.group(1).replace("/", "").replace("-", "")

    lo = LimitOrder(
        lead_id=lead_id,
        currency_pair=currency_pair,
        rate=rate,
        volume=volume,
        status="active",
        created_by_id=current_user.id,
    )
    db.add(lo)
    db.commit()
    db.refresh(lo)
    return _limit_dict(lo)
