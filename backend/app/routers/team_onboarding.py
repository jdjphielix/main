"""Team Onboarding router: teamleader read-only view of team's onboarding cases + revenue approval."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func, or_
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead, PipelineStage, ProspectData

router = APIRouter()


def _is_teamleader_or_admin(user: User) -> bool:
    return user.role in ("admin_pay", "admin_trade") or user.is_teamleader or user.is_superuser


def _get_team_sales_ids(user: User, db: Session) -> list[int]:
    """Get IDs of all sales users in this teamleader's team."""
    if user.is_superuser or user.role in ("admin_pay", "admin_trade"):
        users = db.query(User.id).filter(
            User.role.in_(["sales", "extern"]),
            User.status == "active",
        ).all()
    else:
        users = db.query(User.id).filter(
            User.team_leader_id == user.id,
            User.status == "active",
        ).all()
    return [u[0] for u in users]


@router.get("/cases")
async def get_team_onboarding_cases(
    stage: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all onboarding cases from this teamleader's team. Read-only."""
    if not _is_teamleader_or_admin(current_user) and current_user.role not in ("backoffice", "accountmanager", "finance"):
        raise HTTPException(status_code=403, detail="Alleen teamleiders, backoffice, accountmanager, finance en admins")

    team_ids = _get_team_sales_ids(current_user, db)

    stages = [PipelineStage.ONBOARDING_SALES.value, PipelineStage.ONBOARDING_BACKOFFICE.value]
    if stage in ("onboarding_sales", "onboarding_backoffice"):
        stages = [stage]

    query = db.query(Lead).options(
        joinedload(Lead.prospect_data),
        joinedload(Lead.sales_owner),
        joinedload(Lead.assigned_user),
    ).filter(
        Lead.pipeline_stage.in_(stages),
        Lead.is_deleted == False,
        or_(
            Lead.sales_owner_id.in_(team_ids),
            Lead.assigned_user_id.in_(team_ids),
        )
    ).order_by(Lead.onboarding_started_at.desc().nullslast())

    total = query.count()
    cases = query.offset((page - 1) * page_size).limit(page_size).all()

    def fmt_case(lead: Lead):
        pd = lead.prospect_data
        fx_rev = (pd.fx_estimated_revenue or 0) if pd else 0
        tf_rev = (pd.tf_estimated_revenue or 0) if pd else 0
        total_rev = fx_rev + tf_rev
        needs_approval = not lead.revenue_approved
        return {
            "id": lead.id,
            "company_name": lead.company_name,
            "pipeline_stage": lead.pipeline_stage,
            "sales_owner_name": lead.sales_owner.full_name if lead.sales_owner else None,
            "sales_owner_id": lead.sales_owner_id,
            "assigned_user_name": lead.assigned_user.full_name if lead.assigned_user else None,
            "onboarding_started_at": lead.onboarding_started_at,
            "backoffice_started_at": lead.backoffice_started_at,
            "revision_status": lead.revision_status,
            "fx_estimated_revenue": fx_rev,
            "tf_estimated_revenue": tf_rev,
            "total_revenue": total_rev,
            "revenue_approved": lead.revenue_approved,
            "revenue_approved_value": lead.revenue_approved_value,
            "revenue_approved_note": lead.revenue_approved_note,
            "revenue_approved_at": lead.revenue_approved_at,
            "needs_revenue_approval": needs_approval,
        }

    return {
        "cases": [fmt_case(c) for c in cases],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


class ApproveRevenueRequest(BaseModel):
    approved_value: Optional[float] = None
    note: Optional[str] = None


@router.post("/{lead_id}/approve-revenue")
async def approve_revenue(
    lead_id: int,
    data: ApproveRevenueRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teamleader approves/adjusts revenue for an onboarding case."""
    if not _is_teamleader_or_admin(current_user) and current_user.role != "backoffice":
        raise HTTPException(status_code=403, detail="Alleen teamleiders, backoffice en admins")

    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.pipeline_stage.in_([
            PipelineStage.ONBOARDING_SALES.value,
            PipelineStage.ONBOARDING_BACKOFFICE.value,
            PipelineStage.CLIENT.value,
        ]),
        Lead.is_deleted == False,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Case niet gevonden")

    pd = lead.prospect_data
    default_value = ((pd.fx_estimated_revenue or 0) + (pd.tf_estimated_revenue or 0)) if pd else 0

    lead.revenue_approved = True
    lead.revenue_approved_by = current_user.id
    lead.revenue_approved_at = datetime.now(timezone.utc)
    lead.revenue_approved_value = data.approved_value if data.approved_value is not None else default_value
    lead.revenue_approved_note = data.note or ""

    db.commit()
    return {
        "id": lead.id,
        "revenue_approved": True,
        "revenue_approved_value": lead.revenue_approved_value,
        "revenue_approved_note": lead.revenue_approved_note,
        "revenue_approved_at": lead.revenue_approved_at,
    }


@router.get("/summary")
async def get_team_onboarding_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Summary counts for teamleader dashboard widget."""
    if not _is_teamleader_or_admin(current_user) and current_user.role != "backoffice":
        raise HTTPException(status_code=403, detail="Alleen teamleiders, backoffice en admins")

    team_ids = _get_team_sales_ids(current_user, db)

    stages = [PipelineStage.ONBOARDING_SALES.value, PipelineStage.ONBOARDING_BACKOFFICE.value]

    cases = db.query(Lead).options(joinedload(Lead.prospect_data)).filter(
        Lead.pipeline_stage.in_(stages),
        Lead.is_deleted == False,
        or_(
            Lead.sales_owner_id.in_(team_ids),
            Lead.assigned_user_id.in_(team_ids),
        )
    ).all()

    total = len(cases)
    needs_approval = sum(1 for c in cases if not c.revenue_approved)
    total_rev = sum(
        ((c.prospect_data.fx_estimated_revenue or 0) + (c.prospect_data.tf_estimated_revenue or 0))
        if c.prospect_data else 0
        for c in cases
    )
    approved_rev = sum(
        c.revenue_approved_value or 0
        for c in cases if c.revenue_approved
    )

    return {
        "total_cases": total,
        "needs_approval": needs_approval,
        "total_pipeline_revenue": total_rev,
        "approved_revenue": approved_rev,
    }
