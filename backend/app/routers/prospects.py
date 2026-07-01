"""Prospects router: pipeline_stage="prospect" management, currencies, activation."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import Optional, List
from datetime import datetime, timezone

from app.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.models.lead import Lead, PipelineStage, ProspectData, ProspectCurrency, ProductLine
from app.models.notification import ActivityLog
from app.routers.leads import product_lines_revenue, product_lines_revenue_bulk

router = APIRouter()


# ── Serialization helpers ──────────────────────────────────────────

def _serialize_obj(obj):
    """Convert a SQLAlchemy model instance to a plain dict with JSON-safe values."""
    data = {}
    for c in obj.__table__.columns:
        val = getattr(obj, c.name)
        if hasattr(val, 'isoformat'):
            val = val.isoformat()
        data[c.name] = val
    return data


def _serialize_prospect_data(pd, pl_revenue=None):
    if not pd:
        # Even without a ProspectData row we may still have product lines
        # (activation can happen in the lead phase). Surface the revenue so the
        # prospects list rollup does not fall to 0.
        if pl_revenue is not None:
            return {"product_lines_revenue": pl_revenue}
        return None
    return {
        "id": pd.id,
        "lead_id": pd.lead_id,
        "taperpay_active": pd.taperpay_active,
        "tapertrade_active": pd.tapertrade_active,
        # Revenue from the "+" product lines (volume * margin% / 100).
        # This is the single source of truth for prospect forecasting.
        "product_lines_revenue": pl_revenue,
        "fx_estimated_volume": pd.fx_estimated_volume,
        "fx_estimated_margin_pct": pd.fx_estimated_margin_pct,
        "fx_estimated_revenue": pd.fx_estimated_revenue,
        "tf_estimated_volume": pd.tf_estimated_volume,
        "tf_estimated_margin_pct": pd.tf_estimated_margin_pct,
        "tf_estimated_revenue": pd.tf_estimated_revenue,
        "strategy_notes": pd.strategy_notes,
        "tf_debtor_finance": pd.tf_debtor_finance,
        "tf_portfolio_finance": pd.tf_portfolio_finance,
        "tf_voorraad_finance": getattr(pd, 'tf_voorraad_finance', None),
        "tf_total_financing_need": pd.tf_total_financing_need,
        "tf_additional_info": getattr(pd, 'tf_additional_info', None),
        "selected_broker": pd.selected_broker,
        "broker_feedback": getattr(pd, 'broker_feedback', None),
        "kyc_status": pd.kyc_status,
        "risk_profile": pd.risk_profile,
        "ubo_name": pd.ubo_name,
        "ubo_nationality": pd.ubo_nationality,
        "legal_entity_type": pd.legal_entity_type,
        "kyc_notes": pd.kyc_notes,
        "aml_cleared": pd.aml_cleared,
        "fx_spot_spread_pct": pd.fx_spot_spread_pct,
        "fx_forward_margin_pct": pd.fx_forward_margin_pct,
        "credit_limit_eur": pd.credit_limit_eur,
        "min_deal_size_eur": pd.min_deal_size_eur,
        "pricing_notes": pd.pricing_notes,
        "account_plan": pd.account_plan,
        "tf_interest_rate_pct": pd.tf_interest_rate_pct,
        "tf_fee_pct": pd.tf_fee_pct,
        "tf_closing_fee_pct": getattr(pd, 'tf_closing_fee_pct', None),
        "payment_terms_days": pd.payment_terms_days,
        # Compliance velden (nieuw)
        "contract_signed_date": pd.contract_signed_date.isoformat() if pd.contract_signed_date else None,
        "cdd_next_review_date": pd.cdd_next_review_date.isoformat() if pd.cdd_next_review_date else None,
        "pep_cleared": getattr(pd, 'pep_cleared', False),
        "sanctions_cleared": getattr(pd, 'sanctions_cleared', False),
        "compliance_officer_id": getattr(pd, 'compliance_officer_id', None),
        # Broker integratie (nieuw)
        "broker_account_id": getattr(pd, 'broker_account_id', None),
        "broker_onboarded_at": pd.broker_onboarded_at.isoformat() if getattr(pd, 'broker_onboarded_at', None) else None,
        "iban_issued_at": pd.iban_issued_at.isoformat() if getattr(pd, 'iban_issued_at', None) else None,
        # Nested currencies
        "currencies": [_serialize_obj(cur) for cur in (pd.currencies or [])],
    }


def _serialize_prospect(p, owner_name=None, pl_revenue=None):
    """Serialize a Lead in prospect stage with prospect_data and contact_methods."""
    data = _serialize_obj(p)
    data["sales_owner_name"] = owner_name
    data["prospect_data"] = _serialize_prospect_data(p.prospect_data, pl_revenue)
    # Include contact_methods so the prospect view can show extra contacts
    data["contact_methods"] = [
        {
            "id": cm.id,
            "type": cm.type,
            "value": cm.value,
            "label": cm.label,
            "is_primary": cm.is_primary,
        }
        for cm in (p.contact_methods or [])
    ]
    return data


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/", response_model=dict)
async def list_prospects(
    search: Optional[str] = None,
    taperpay: Optional[bool] = None,
    tapertrade: Optional[bool] = None,
    mine: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all prospects (pipeline_stage="prospect") with filters.
    Filter by company/contact name, TaperPay/TaperTrade activation status.
    """
    query = db.query(Lead).options(
        joinedload(Lead.prospect_data).joinedload(ProspectData.currencies)
    ).filter(
        Lead.is_deleted == False,
        Lead.pipeline_stage == PipelineStage.PROSPECT.value,
    )

    # Search
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            Lead.company_name.ilike(search_term),
            Lead.contact_name.ilike(search_term),
            Lead.contact_email.ilike(search_term),
        ))

    # Filter by TaperPay/TaperTrade activation
    if taperpay is not None:
        query = query.join(ProspectData).filter(
            ProspectData.taperpay_active == taperpay
        )
    if tapertrade is not None:
        if taperpay is not None:
            query = query.filter(ProspectData.tapertrade_active == tapertrade)
        else:
            query = query.join(ProspectData).filter(
                ProspectData.tapertrade_active == tapertrade
            )

    # Visibility rules:
    # - Admin/teamleader: see everything (no filter), but can use mine param to filter
    # - Sales/extern: see unowned (sales_owner_id=null) OR their own (sales_owner_id=self)
    #                 They can NEVER see another user's private prospects
    is_admin = current_user.role in ("admin_pay", "admin_trade") or current_user.is_teamleader
    is_extern = current_user.role == "extern" and not current_user.is_teamleader

    # Extern users ALWAYS see only their own prospects (backend security enforcement)
    if is_extern:
        query = query.filter(Lead.sales_owner_id == current_user.id)
    elif mine is True:
        # "Mijn lijst": only my own assigned prospects (all roles)
        query = query.filter(Lead.sales_owner_id == current_user.id)
    elif mine is False:
        # "Algemeen" = alleen de niet-toegewezen pool (net als bij leads: algemeen = ongelockt).
        # Zo verschijnt een prospect die iemand bezit ALLEEN in diens "Mijn Prospects",
        # en niet dubbel in Algemeen — geldt voor alle rollen, ook admin/teamleider.
        query = query.filter(Lead.sales_owner_id == None)
    else:
        # No tab filter: admins see all; sales users see own + unowned
        if not is_admin:
            query = query.filter(or_(
                Lead.sales_owner_id == None,
                Lead.sales_owner_id == current_user.id,
            ))

    total = query.count()

    # Sorting
    _ALLOWED_SORT_FIELDS = {"created_at", "company_name", "pipeline_stage", "updated_at", "client_since_date", "priority"}
    if sort_by not in _ALLOWED_SORT_FIELDS:
        sort_by = "created_at"
    sort_column = getattr(Lead, sort_by, Lead.created_at)
    if sort_dir == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    prospects = query.offset((page - 1) * page_size).limit(page_size).all()

    # Build owner name map
    owner_ids = {p.sales_owner_id for p in prospects if p.sales_owner_id}
    owner_map = {}
    if owner_ids:
        owners = db.query(User).filter(User.id.in_(owner_ids)).all()
        owner_map = {u.id: u.full_name for u in owners}

    # Bulk product-line revenue for all prospects on this page (no N+1)
    pl_rev_map = product_lines_revenue_bulk(db, [p.id for p in prospects])

    return {
        "prospects": [
            _serialize_prospect(p, owner_map.get(p.sales_owner_id), pl_rev_map.get(p.id, 0))
            for p in prospects
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{lead_id}")
async def get_prospect(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get prospect detail with prospect_data and currencies."""
    prospect = db.query(Lead).options(
        joinedload(Lead.prospect_data).joinedload(ProspectData.currencies)
    ).filter(
        Lead.id == lead_id,
        Lead.is_deleted == False,
    ).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    pl_rev = product_lines_revenue(db, prospect.id)
    return _serialize_prospect(prospect, pl_revenue=pl_rev)


@router.put("/{lead_id}/prospect-data")
async def update_prospect_data(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update FX/TF info: estimated volumes, margins, strategy notes, financing needs.
    """
    prospect = db.query(Lead).filter(Lead.id == lead_id).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Lead not found")

    prospect_data = prospect.prospect_data
    if not prospect_data:
        prospect_data = ProspectData(lead_id=lead_id)
        db.add(prospect_data)

    # Update fields
    for key, value in data.items():
        if hasattr(prospect_data, key):
            setattr(prospect_data, key, value)

    # Recalculate revenues
    if prospect_data.fx_estimated_volume and prospect_data.fx_estimated_margin_pct:
        prospect_data.fx_estimated_revenue = (
            prospect_data.fx_estimated_volume * prospect_data.fx_estimated_margin_pct / 100
        )
    if prospect_data.tf_estimated_volume and prospect_data.tf_estimated_margin_pct:
        prospect_data.tf_estimated_revenue = (
            prospect_data.tf_estimated_volume * prospect_data.tf_estimated_margin_pct / 100
        )

    db.commit()

    # Log activity
    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=lead_id,
        action="updated",
        entity_type="prospect",
        entity_id=lead_id,
        details={"fields": list(data.keys())},
    )
    db.add(activity)
    db.commit()

    return _serialize_prospect_data(prospect_data, product_lines_revenue(db, lead_id))


@router.post("/{lead_id}/currencies")
async def add_currency(
    lead_id: int,
    currency: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add currency pair to prospect.
    """
    prospect = db.query(Lead).filter(Lead.id == lead_id).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Lead not found")

    prospect_data = prospect.prospect_data
    if not prospect_data:
        prospect_data = ProspectData(lead_id=lead_id)
        db.add(prospect_data)
        db.flush()

    new_currency = ProspectCurrency(
        prospect_data_id=prospect_data.id,
        currency_type=currency["currency_type"],
        value=currency["value"],
        volume=currency.get("volume"),
        notes=currency.get("notes"),
    )
    db.add(new_currency)
    db.commit()

    return _serialize_obj(new_currency)


@router.delete("/{lead_id}/currencies/{currency_id}")
async def delete_currency(
    lead_id: int,
    currency_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a currency pair."""
    prospect = db.query(Lead).filter(Lead.id == lead_id).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Lead not found")

    currency = db.query(ProspectCurrency).filter(
        ProspectCurrency.id == currency_id,
        ProspectCurrency.prospect_data_id == prospect.prospect_data.id,
    ).first()

    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")

    db.delete(currency)
    db.commit()

    return {"status": "deleted"}


@router.put("/{lead_id}/activate-taperpay")
async def activate_taperpay(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activate TaperPay for this prospect."""
    prospect = db.query(Lead).filter(Lead.id == lead_id).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Lead not found")

    prospect_data = prospect.prospect_data
    if not prospect_data:
        prospect_data = ProspectData(lead_id=lead_id)
        db.add(prospect_data)

    prospect_data.taperpay_active = True
    db.commit()

    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=lead_id,
        action="activated_taperpay",
        entity_type="prospect",
        entity_id=lead_id,
    )
    db.add(activity)
    db.commit()

    return {"status": "activated", "product": "taperpay"}


@router.put("/{lead_id}/activate-tapertrade")
async def activate_tapertrade(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activate TaperTrade for this prospect."""
    prospect = db.query(Lead).filter(Lead.id == lead_id).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Lead not found")

    prospect_data = prospect.prospect_data
    if not prospect_data:
        prospect_data = ProspectData(lead_id=lead_id)
        db.add(prospect_data)

    prospect_data.tapertrade_active = True
    db.commit()

    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=lead_id,
        action="activated_tapertrade",
        entity_type="prospect",
        entity_id=lead_id,
    )
    db.add(activity)
    db.commit()

    return {"status": "activated", "product": "tapertrade"}


@router.post("/{lead_id}/to-onboarding")
async def move_to_onboarding(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move prospect to onboarding_sales stage."""
    prospect = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.pipeline_stage == PipelineStage.PROSPECT.value,
    ).first()

    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect.pipeline_stage = PipelineStage.ONBOARDING_SALES.value
    prospect.updated_at = datetime.now(timezone.utc)
    prospect.onboarding_started_at = datetime.now(timezone.utc)
    db.commit()

    activity = ActivityLog(
        user_id=current_user.id,
        lead_id=lead_id,
        action="moved_to_onboarding",
        entity_type="prospect",
        entity_id=lead_id,
        details={"from_stage": "prospect", "to_stage": "onboarding_sales"},
    )
    db.add(activity)
    db.commit()

    return {
        "status": "moved",
        "pipeline_stage": prospect.pipeline_stage,
        "prospect_id": lead_id,
    }


@router.post("/{lead_id}/assign-prospect")
async def assign_prospect(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign (lock) prospect to current user as sales owner."""
    prospect = db.query(Lead).filter(Lead.id == lead_id, Lead.pipeline_stage == PipelineStage.PROSPECT.value).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    prospect.sales_owner_id = current_user.id
    db.add(ActivityLog(user_id=current_user.id, lead_id=lead_id,
        action="prospect_assigned", entity_type="prospect", entity_id=lead_id,
        details={"assigned_to": current_user.id, "assigned_to_name": current_user.full_name}))
    db.commit()
    owner_name = current_user.full_name
    return {**_serialize_prospect(prospect, owner_name), "sales_owner_name": owner_name}


@router.post("/{lead_id}/release-prospect")
async def release_prospect(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Release prospect from personal list back to general pool."""
    prospect = db.query(Lead).filter(Lead.id == lead_id, Lead.pipeline_stage == PipelineStage.PROSPECT.value).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    is_admin = current_user.role in ("admin_pay", "admin_trade") or current_user.is_teamleader
    is_owner = prospect.sales_owner_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Geen toegang")
    prospect.sales_owner_id = None
    db.add(ActivityLog(user_id=current_user.id, lead_id=lead_id,
        action="prospect_released", entity_type="prospect", entity_id=lead_id))
    db.commit()
    return _serialize_prospect(prospect, None)


# â”€â”€â”€ Hot Prospect Toggle â”€â”€â”€

@router.put("/{lead_id}/hot")
async def toggle_hot_prospect(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle hot prospect flag. Only if ProspectData has revenue > 0."""
    from datetime import datetime, timezone
    prospect = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.pipeline_stage == PipelineStage.PROSPECT.value,
        Lead.is_deleted == False,
    ).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect niet gevonden")

    # Check revenue > 0 to enable hot
    pd = prospect.prospect_data
    has_revenue = pd and ((pd.fx_estimated_revenue or 0) + (pd.tf_estimated_revenue or 0)) > 0

    if not prospect.is_hot_prospect and not has_revenue:
        raise HTTPException(
            status_code=400,
            detail="Vul eerst een revenue schatting in (FX of TF) voordat je dit als hot markeert"
        )

    prospect.is_hot_prospect = not prospect.is_hot_prospect
    if prospect.is_hot_prospect:
        prospect.hot_prospect_set_at = datetime.now(timezone.utc)
        prospect.hot_prospect_set_by = current_user.id
    else:
        prospect.hot_prospect_set_at = None
        prospect.hot_prospect_set_by = None

    db.commit()
    db.refresh(prospect)
    return {
        "id": prospect.id,
        "is_hot_prospect": prospect.is_hot_prospect,
        "hot_prospect_set_at": prospect.hot_prospect_set_at,
    }
