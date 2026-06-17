"""Admin router: onboarding requirements CRUD, admin settings, P&L, compliance overview."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sqlfunc
from typing import Optional
from datetime import datetime, timezone

from app.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.models.lead import Lead, ClientForecasting, ComplianceCase, ComplianceCaseDocument
from app.models.notification import OnboardingRequirement, AdminSetting
from app.models.communication import Document

router = APIRouter()


# ── Onboarding Requirements ───────────────────────────────────────

@router.get("/onboarding-requirements")
async def list_requirements(
    product_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all onboarding requirements, optionally filtered by product_type."""
    _allowed = ("admin_pay", "admin_trade", "backoffice", "teamleader")
    if current_user.role not in _allowed and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Geen toegang tot onboarding vereisten")
    query = db.query(OnboardingRequirement)
    if product_type:
        query = query.filter(OnboardingRequirement.product_type == product_type)
    reqs = query.order_by(OnboardingRequirement.product_type, OnboardingRequirement.sort_order).all()

    return {
        "requirements": [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "product_type": r.product_type,
                "broker": r.broker,
                "is_required": r.is_required,
                "sort_order": r.sort_order,
                "is_active": r.is_active,
                "created_by_id": r.created_by_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in reqs
        ],
        "total": len(reqs),
    }


@router.post("/onboarding-requirements")
async def create_requirement(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new onboarding requirement. Admin or teamleader only."""
    if current_user.role not in ("admin_pay", "admin_trade") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Admin of teamleader rechten vereist")
    req = OnboardingRequirement(
        name=data["name"],
        description=data.get("description", ""),
        product_type=data.get("product_type", "taperpay"),
        broker=data.get("broker"),
        is_required=data.get("is_required", True),
        sort_order=data.get("sort_order", 99),
        is_active=data.get("is_active", True),
        created_by_id=current_user.id,
    )
    db.add(req)
    db.commit()

    return {
        "id": req.id,
        "name": req.name,
        "description": req.description,
        "product_type": req.product_type,
        "broker": req.broker,
        "is_required": req.is_required,
        "sort_order": req.sort_order,
        "is_active": req.is_active,
    }


@router.put("/onboarding-requirements/{req_id}")
async def update_requirement(
    req_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an onboarding requirement. Admin or teamleader only."""
    if current_user.role not in ("admin_pay", "admin_trade") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Admin of teamleader rechten vereist")
    req = db.query(OnboardingRequirement).filter(OnboardingRequirement.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    updateable = ["name", "description", "product_type", "broker", "is_required", "sort_order", "is_active"]
    for field in updateable:
        if field in data:
            setattr(req, field, data[field])

    req.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "id": req.id,
        "name": req.name,
        "description": req.description,
        "product_type": req.product_type,
        "broker": req.broker,
        "is_required": req.is_required,
        "sort_order": req.sort_order,
        "is_active": req.is_active,
    }


@router.delete("/onboarding-requirements/{req_id}")
async def delete_requirement(
    req_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deactivate (soft-delete) an onboarding requirement. Admin only."""
    req = db.query(OnboardingRequirement).filter(OnboardingRequirement.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    req.is_active = False
    req.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "deactivated", "id": req_id}


# ── P&L Management ───────────────────────────────────────────────

@router.get("/pnl")
async def get_pnl_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    P&L Management: aggregate all client forecasting data.
    Revenue = sum(volume_per_year * margin_per_year) for each currency pair across all clients.
    """
    # Role check: admin or finance
    if current_user.role not in ("admin_pay", "admin_trade", "finance") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Geen toegang tot P&L module")

    # Get all forecasting items with their lead info
    items = (
        db.query(ClientForecasting, Lead.company_name, Lead.id)
        .join(Lead, ClientForecasting.lead_id == Lead.id)
        .filter(Lead.pipeline_stage == "client", Lead.is_deleted == False)
        .all()
    )

    # Per-client aggregation
    clients_data = {}
    total_volume = 0
    total_revenue = 0

    for forecast, company_name, lead_id in items:
        revenue = (forecast.volume_per_year or 0) * (forecast.margin_per_year or 0)
        volume = forecast.volume_per_year or 0

        if lead_id not in clients_data:
            clients_data[lead_id] = {
                "lead_id": lead_id,
                "company_name": company_name,
                "total_volume": 0,
                "total_revenue": 0,
                "currency_pairs": [],
            }

        clients_data[lead_id]["total_volume"] += volume
        clients_data[lead_id]["total_revenue"] += revenue
        clients_data[lead_id]["currency_pairs"].append({
            "id": forecast.id,
            "buy_currency": forecast.buy_currency,
            "sell_currency": forecast.sell_currency,
            "volume_per_year": forecast.volume_per_year,
            "margin_per_year": forecast.margin_per_year,
            "revenue": revenue,
        })

        total_volume += volume
        total_revenue += revenue

    # Per-currency-pair aggregation
    pair_aggregation = {}
    for forecast, _, _ in items:
        pair_key = f"{forecast.buy_currency}/{forecast.sell_currency}"
        if pair_key not in pair_aggregation:
            pair_aggregation[pair_key] = {"pair": pair_key, "total_volume": 0, "total_revenue": 0, "client_count": 0}
        pair_aggregation[pair_key]["total_volume"] += (forecast.volume_per_year or 0)
        pair_aggregation[pair_key]["total_revenue"] += (forecast.volume_per_year or 0) * (forecast.margin_per_year or 0)
        pair_aggregation[pair_key]["client_count"] += 1

    return {
        "total_volume": total_volume,
        "total_revenue": total_revenue,
        "client_count": len(clients_data),
        "clients": sorted(clients_data.values(), key=lambda c: c["total_revenue"], reverse=True),
        "currency_pairs": sorted(pair_aggregation.values(), key=lambda p: p["total_revenue"], reverse=True),
    }


# ── Compliance Overview (all clients) ────────────────────────────

@router.get("/compliance")
async def list_all_compliance_cases(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all compliance cases across all clients as a ticket system."""
    query = (
        db.query(ComplianceCase)
        .join(Lead, ComplianceCase.lead_id == Lead.id)
        .filter(Lead.is_deleted == False)
        .options(joinedload(ComplianceCase.lead), joinedload(ComplianceCase.created_by), joinedload(ComplianceCase.assigned_to))
    )

    if status:
        query = query.filter(ComplianceCase.status == status)

    cases = query.order_by(ComplianceCase.created_at.desc()).all()

    def _case_dict(c):
        return {
            "id": c.id,
            "lead_id": c.lead_id,
            "company_name": c.lead.company_name if c.lead else None,
            "title": c.title,
            "description": c.description,
            "status": c.status,
            "priority": c.priority,
            "broker": c.broker,
            "resolution_notes": c.resolution_notes,
            "created_by_name": c.created_by.full_name if c.created_by else None,
            "assigned_to_name": c.assigned_to.full_name if c.assigned_to else None,
            "assigned_to_id": c.assigned_to_id,
            "document_count": len(c.documents) if c.documents else 0,
            "documents": [
                {
                    "id": d.document.id,
                    "original_filename": d.document.original_filename,
                    "file_size": d.document.file_size,
                    "created_at": d.document.created_at.isoformat() if d.document.created_at else None,
                }
                for d in (c.documents or [])
                if d.document
            ],
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        }

    return {
        "cases": [_case_dict(c) for c in cases],
        "total": len(cases),
        "counts": {
            "open": sum(1 for c in cases if c.status == "open"),
            "in_progress": sum(1 for c in cases if c.status == "in_progress"),
            "resolved": sum(1 for c in cases if c.status == "resolved"),
            "closed": sum(1 for c in cases if c.status == "closed"),
        },
    }


@router.get("/compliance/{case_id}")
async def get_compliance_case_admin(
    case_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a single compliance case with full document details."""
    case = (
        db.query(ComplianceCase)
        .filter(ComplianceCase.id == case_id)
        .options(
            joinedload(ComplianceCase.lead),
            joinedload(ComplianceCase.created_by),
            joinedload(ComplianceCase.assigned_to),
            joinedload(ComplianceCase.documents),
        )
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    return {
        "id": case.id,
        "lead_id": case.lead_id,
        "company_name": case.lead.company_name if case.lead else None,
        "title": case.title,
        "description": case.description,
        "status": case.status,
        "priority": case.priority,
        "broker": case.broker,
        "resolution_notes": case.resolution_notes,
        "created_by_name": case.created_by.full_name if case.created_by else None,
        "assigned_to_name": case.assigned_to.full_name if case.assigned_to else None,
        "assigned_to_id": case.assigned_to_id,
        "documents": [
            {
                "id": d.document.id,
                "original_filename": d.document.original_filename,
                "file_size": d.document.file_size,
                "created_at": d.document.created_at.isoformat() if d.document.created_at else None,
            }
            for d in (case.documents or [])
            if d.document
        ],
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


@router.post("/compliance")
async def create_compliance_case_admin(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new compliance case from the admin panel (with client selector)."""
    lead_id = data.get("lead_id")
    if not lead_id:
        raise HTTPException(status_code=400, detail="lead_id is required")
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Client not found")

    case = ComplianceCase(
        lead_id=lead_id,
        created_by_id=current_user.id,
        title=data.get("title", ""),
        description=data.get("description", ""),
        status="open",
        priority=data.get("priority", "normal"),
        broker=data.get("broker"),
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return {"id": case.id, "status": "created"}


@router.put("/compliance/{case_id}")
async def update_compliance_case_admin(
    case_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a compliance case from the admin panel."""
    case = db.query(ComplianceCase).filter(ComplianceCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    updateable = ["status", "priority", "assigned_to_id", "resolution_notes", "title", "description", "broker"]
    for field in updateable:
        if field in data:
            setattr(case, field, data[field])

    if data.get("status") == "resolved" and not case.resolved_at:
        case.resolved_at = datetime.now(timezone.utc)

    case.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"id": case.id, "status": case.status, "priority": case.priority, "broker": case.broker}
