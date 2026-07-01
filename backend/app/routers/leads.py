"""Leads router: full CRUD, call lists, filtering, assignment, snooze."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, case
from typing import Optional, List
from datetime import datetime, date, timezone
import httpx
import base64
from email.header import decode_header
from email.utils import parsedate_to_datetime

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead, LeadStatus, PipelineStage, CustomList, CustomListLead, ProspectData, ClientForecasting, ClientDeal, ComplianceCase, ComplianceCaseDocument, ProductLine
from app.models.user import PinnedLead
from app.models.communication import Note, Communication, Document, EmailSync, ContactMethod
from app.models.communication import CallLog
from app.models.notification import ActivityLog, Notification
from app.schemas.leads import (
    LeadCreate, LeadUpdate, LeadResponse, LeadListResponse,
    DailyListUpdate, LeadScoreUpdate, SnoozeRequest, BulkActionRequest,
    CustomListCreate,
)

router = APIRouter()


@router.get("/", response_model=LeadListResponse)
async def get_leads(
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[int] = None,
    is_on_daily_list: Optional[bool] = None,
    pipeline_stage: Optional[str] = None,
    account_manager_id: Optional[int] = None,
    my_leads: Optional[bool] = None,
    my_clients: Optional[bool] = None,
    all_stages: Optional[bool] = None,
    dup_check: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get leads with filtering, sorting, and pagination."""
    query = db.query(Lead).filter(
        Lead.is_deleted == False,
    )

    # Filter by pipeline stage (default: lead; all_stages=true skips for search)
    if all_stages:
        pass  # search across all stages
    elif pipeline_stage:
        query = query.filter(Lead.pipeline_stage == pipeline_stage)
    else:
        query = query.filter(Lead.pipeline_stage == PipelineStage.LEAD.value)

    # my_leads filter: True = locked by current user, False = unlocked, None = default unlocked
    # Lock filter is only meaningful for the lead stage — prospects/onboarding/clients are
    # always visible regardless of lock status, so skip it when a further stage is requested.
    _non_lead_stage = pipeline_stage and pipeline_stage not in (PipelineStage.LEAD.value,)
    if my_leads is True:
        query = query.filter(
            Lead.is_locked == True,
            Lead.locked_by_user_id == current_user.id,
        )
    elif my_leads is False:
        query = query.filter(Lead.is_locked == False)
    elif my_leads is None and not search and not _non_lead_stage and not all_stages:
        query = query.filter(Lead.is_locked == False)

    # Search across company name, contact name, email, phone
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            Lead.company_name.ilike(search_term),
            Lead.contact_name.ilike(search_term),
            Lead.contact_email.ilike(search_term),
            Lead.contact_phone.ilike(search_term),
            Lead.contact_mobile.ilike(search_term),
            Lead.kvk_number.ilike(search_term),
            Lead.partner_name.ilike(search_term),
        ))

    if status:
        query = query.filter(Lead.status == status)
    if priority:
        query = query.filter(Lead.priority == priority)
    if assigned_to:
        query = query.filter(Lead.assigned_user_id == assigned_to)
    if is_on_daily_list:
        query = query.filter(
            Lead.on_daily_list == True,
            Lead.daily_list_date == date.today(),
            Lead.daily_list_user_id == current_user.id,
        )

    # Extern users see ONLY their own leads, always
    # Exception: dup_check=true bypasses this so extern users see duplicate warnings from all users
    if current_user.role == 'extern' and not dup_check:
        query = query.filter(Lead.assigned_user_id == current_user.id)

    # my_clients: show only leads where current user is sales_owner, assigned user, or dealer
    if my_clients is True:
        from sqlalchemy import or_ as _or_
        query = query.filter(_or_(
            Lead.sales_owner_id == current_user.id,
            Lead.assigned_user_id == current_user.id,
            Lead.dealer_id == current_user.id,
        ))

    # Sales ownership filter: sales/extern users only see their own leads in onboarding/client
    is_sales_only = current_user.role in ("sales", "extern") and not current_user.is_teamleader
    is_accountmanager = current_user.role == "accountmanager"
    if is_accountmanager and not account_manager_id:
        # Accountmanagers only see their own assigned clients
        query = query.filter(Lead.account_manager_id == current_user.id)
    if is_sales_only and pipeline_stage in ("prospect", "onboarding_sales", "onboarding_backoffice", "client"):
        from sqlalchemy import or_ as _or2_
        query = query.filter(_or2_(
            Lead.sales_owner_id == current_user.id,
            Lead.assigned_user_id == current_user.id,
            Lead.dealer_id == current_user.id,
        ))

    # Account manager filter
    if account_manager_id:
        query = query.filter(Lead.account_manager_id == account_manager_id)

    # Filter snoozed leads (hide if snooze not expired)
    query = query.filter(or_(
        Lead.snoozed_until == None,
        Lead.snoozed_until <= datetime.now(timezone.utc),
    ))

    # Total count
    total = query.count()

    # Sorting
    _ALLOWED_SORT_FIELDS = {
        "created_at", "updated_at", "company_name", "contact_name",
        "status", "priority", "call_count", "last_called_at", "pipeline_stage",
    }
    safe_sort = sort_by if sort_by in _ALLOWED_SORT_FIELDS else "created_at"
    sort_column = getattr(Lead, safe_sort, Lead.created_at)
    if sort_dir == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # Eager load owner relations for name resolution
    # Load relationships for serialization
    from app.models.user import User as _User
    query = query.options(
        joinedload(Lead.sales_owner),
        joinedload(Lead.assigned_user),
        joinedload(Lead.account_manager),
    )

    # Pagination
    leads = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "leads": leads,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# ── Static sub-resource routes MUST appear before /{lead_id} ─────────────────
# FastAPI matches routes in registration order; a path like /lists/my would be
# captured by /{lead_id} (treating "lists" as a non-integer → 422) if placed later.

@router.get("/lists/my")
async def get_my_lists_early(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's custom lead lists."""
    lists = db.query(CustomList).filter(CustomList.user_id == current_user.id).all()
    return lists


@router.post("/lists")
async def create_custom_list_early(
    list_data: CustomListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom lead list."""
    custom_list = CustomList(
        name=list_data.name,
        description=list_data.description,
        user_id=current_user.id,
    )
    db.add(custom_list)
    db.commit()
    db.refresh(custom_list)
    return custom_list


@router.get("/pinned/my")
async def get_my_pinned_leads_early(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's pinned leads."""
    pins = (
        db.query(PinnedLead)
        .filter(PinnedLead.user_id == current_user.id)
        .order_by(PinnedLead.position)
        .all()
    )
    lead_ids = [p.lead_id for p in pins]
    if not lead_ids:
        return []
    leads = db.query(Lead).filter(Lead.id.in_(lead_ids), Lead.is_deleted == False).all()
    return leads


# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{lead_id}")
async def get_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get lead detail with all related data."""
    lead = db.query(Lead).options(
        joinedload(Lead.assigned_user),
        joinedload(Lead.sales_owner),
        joinedload(Lead.call_logs),
        joinedload(Lead.notes),
        joinedload(Lead.communications),
        joinedload(Lead.documents),
        joinedload(Lead.callbacks),
        joinedload(Lead.prospect_data),
    ).filter(Lead.id == lead_id, Lead.is_deleted == False).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/", response_model=LeadResponse)
async def create_lead(
    lead_data: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new lead with duplicate detection."""
    # Check for duplicates
    existing = db.query(Lead).filter(
        Lead.company_name.ilike(lead_data.company_name),
        Lead.is_deleted == False,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"Lead '{lead_data.company_name}' already exists",
                "existing_lead_id": existing.id,
                "existing_lead_name": existing.company_name,
            }
        )

    _lead_dump = lead_data.model_dump()
    _source = _lead_dump.pop('source', None) or 'manual'
    for _alias, _target in [('country','company_country'),('contact_person','contact_name'),('email','contact_email'),('phone','contact_phone')]:
        _v = _lead_dump.pop(_alias, None)
        if _v and not _lead_dump.get(_target): _lead_dump[_target] = _v
    # Auto-set sales_owner_id for ALL roles so new leads always appear in 'Mijn Leads'
    _auto_owner_id = current_user.id

    lead = Lead(
        **_lead_dump,
        assigned_user_id=current_user.id,
        sales_owner_id=_lead_dump.get('sales_owner_id') or _auto_owner_id,
        source=_source,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Auto-lock new lead for creator so it appears in "Mijn Leads"
    lead.is_locked = True
    lead.locked_by_user_id = current_user.id
    db.commit()

    # Activity log
    db.add(ActivityLog(
        user_id=current_user.id,
        lead_id=lead.id,
        action="created",
        entity_type="lead",
        entity_id=lead.id,
    ))
    db.commit()

    # Auto-create ContactMethod rows from the contact fields (skips empty values).
    _contact_label = (lead.contact_name or "").strip() or "Werk"
    _has_primary_phone = False
    if (lead.contact_email or "").strip():
        db.add(ContactMethod(
            lead_id=lead.id,
            type="email",
            value=lead.contact_email.strip(),
            label=_contact_label,
            is_primary=True,
        ))
    if (lead.contact_mobile or "").strip():
        db.add(ContactMethod(
            lead_id=lead.id,
            type="phone",
            value=lead.contact_mobile.strip(),
            label="Mobiel",
            is_primary=True,  # first phone becomes primary
        ))
        _has_primary_phone = True
    if (lead.contact_phone or "").strip() and (lead.contact_phone or "").strip() != (lead.contact_mobile or "").strip():
        db.add(ContactMethod(
            lead_id=lead.id,
            type="phone",
            value=lead.contact_phone.strip(),
            label="Werk",
            is_primary=not _has_primary_phone,
        ))
    db.commit()

    return lead


@router.put("/{lead_id}")
async def update_lead(
    lead_id: int,
    lead_data: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update lead fields."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Check lock
    # Backoffice users can always update checklist, pipeline_stage, and review fields
    # on onboarding leads regardless of lock status
    _backoffice_allowed_fields = {"onboarding_checklist", "pipeline_stage", "revision_status",
                                   "revision_note", "revision_date", "revision_by_id"}
    _is_bo_update = (
        current_user.role in ("backoffice", "admin_pay", "admin_trade")
        and set(lead_data.model_dump(exclude_unset=True).keys()).issubset(_backoffice_allowed_fields)
    )
    if lead.is_locked and lead.locked_by_user_id != current_user.id and not _is_bo_update:
        if current_user.role not in ["admin_pay", "admin_trade"] and not current_user.is_teamleader:
            raise HTTPException(status_code=403, detail="Lead is locked by another user")

    from sqlalchemy.orm.attributes import flag_modified

    update_data = lead_data.model_dump(exclude_unset=True)
    _json_fields = {"onboarding_checklist", "revenue_potential", "tf_revenue_potential", "ai_score_reasons"}
    for key, value in update_data.items():
        setattr(lead, key, value)
        # JSON columns need explicit change notification for SQLAlchemy
        if key in _json_fields:
            flag_modified(lead, key)

    # Security: onboarding_backoffice and client transitions require backoffice/admin role
    if 'pipeline_stage' in update_data:
        _restricted_stages = ('onboarding_backoffice', 'client')
        if update_data['pipeline_stage'] in _restricted_stages:
            _has_role = current_user.role in ('backoffice', 'admin_pay', 'admin_trade') or current_user.is_teamleader
            if not _has_role:
                raise HTTPException(status_code=403, detail="Gebruik de dedicated transition endpoints voor deze stap")

    # Auto-set first_contacted_at when status changes to contacted
    if 'status' in update_data and update_data['status'] == 'contacted' and not lead.first_contacted_at:
        lead.first_contacted_at = datetime.now(timezone.utc)
    # Auto-set churn_date when pipeline moves to LOST

    # Auto-set timestamps bij pipeline-overgang
    if 'pipeline_stage' in update_data:
        _ns = update_data['pipeline_stage']
        _now = datetime.now(timezone.utc)
        if _ns == 'prospect' and not lead.prospect_since:
            lead.prospect_since = _now
        elif _ns == 'onboarding_sales' and not lead.onboarding_started_at:
            lead.onboarding_started_at = _now
        elif _ns == 'onboarding_backoffice' and not lead.backoffice_started_at:
            lead.backoffice_started_at = _now
        elif _ns == 'client' and not lead.client_since_date:
            lead.client_since_date = _now
    if 'pipeline_stage' in update_data and update_data['pipeline_stage'] == 'lost' and not lead.churn_date:
        lead.churn_date = datetime.now(timezone.utc)

    db.commit()
    db.refresh(lead)

    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead.id,
        action="updated", entity_type="lead", entity_id=lead.id,
        details={"fields": list(update_data.keys())},
    ))
    db.commit()

    return lead


@router.post("/{lead_id}/to-daily-list")
async def add_to_daily_list(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add lead to today's call list (1-click)."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.on_daily_list = True
    lead.daily_list_date = date.today()
    lead.daily_list_user_id = current_user.id
    db.commit()
    return {"status": "added to daily list"}


@router.delete("/{lead_id}/from-daily-list")
async def remove_from_daily_list(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove lead from today's call list."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.on_daily_list = False
    lead.daily_list_date = None
    lead.daily_list_user_id = None
    db.commit()
    return {"status": "removed from daily list"}


@router.put("/{lead_id}/daily-list-position")
async def update_daily_list_position(
    lead_id: int,
    position: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update lead position in daily call list (drag & drop)."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.daily_list_position = position
    db.commit()
    return {"status": "position updated"}


@router.post("/{lead_id}/lock")
async def lock_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lock lead to current user's own list."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.is_locked and lead.locked_by_user_id != current_user.id:
        raise HTTPException(status_code=409, detail="Lead is already locked by another user")

    lead.is_locked = True
    lead.locked_by_user_id = current_user.id
    lead.assigned_user_id = current_user.id
    lead.sales_owner_id = current_user.id  # Permanent sales owner — persists through pipeline
    db.commit()
    return {
        "status": "locked",
        "id": lead.id,
        "locked_by_user_id": lead.locked_by_user_id,
        "sales_owner_id": lead.sales_owner_id,
        "assigned_user_id": lead.assigned_user_id,
    }


@router.post("/{lead_id}/unlock")
async def unlock_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unlock lead from user's list."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.locked_by_user_id != current_user.id:
        if current_user.role not in ["admin_pay", "admin_trade"] and not current_user.is_teamleader:
            raise HTTPException(status_code=403, detail="Only the lock owner or admin can unlock")

    lead.is_locked = False
    lead.locked_by_user_id = None
    db.commit()
    return {"status": "unlocked"}


@router.post("/{lead_id}/snooze")
async def snooze_lead(
    lead_id: int,
    snooze: SnoozeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Snooze lead until a specific date."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.status = LeadStatus.SNOOZED.value
    lead.snoozed_until = snooze.until
    lead.snooze_reason = snooze.reason
    lead.on_daily_list = False
    db.commit()
    return {"status": "snoozed", "until": snooze.until}


@router.post("/{lead_id}/back-to-prospect")
async def back_to_prospect(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a lead from onboarding_sales back to prospect stage. Sales users can do this on their own leads."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if lead.pipeline_stage != PipelineStage.ONBOARDING_SALES.value:
        raise HTTPException(status_code=400, detail="Lead is niet in sales onboarding fase")

    # Sales users can only send back their own leads
    is_admin_or_bo = current_user.role in ("admin_pay", "admin_trade", "backoffice") or current_user.is_teamleader
    is_own_lead = lead.sales_owner_id == current_user.id or lead.assigned_user_id == current_user.id
    if not is_admin_or_bo and not is_own_lead:
        raise HTTPException(status_code=403, detail="Geen toegang")

    lead.pipeline_stage = PipelineStage.PROSPECT.value
    lead.onboarding_started_at = None  # Reset timestamp
    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead.id,
        action="moved_back_to_prospect", entity_type="lead", entity_id=lead.id,
        details={"from": "onboarding_sales", "to": "prospect"},
    ))
    db.commit()
    return {"status": "ok", "pipeline_stage": "prospect"}


@router.post("/{lead_id}/to-prospect")
async def send_to_prospect(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move lead to prospect stage."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.pipeline_stage = PipelineStage.PROSPECT.value
    lead.status = LeadStatus.CONVERTED.value
    lead.prospect_since = datetime.now(timezone.utc)
    # Auto-assign prospect to the sales user who converts it
    if current_user.role in ("sales", "extern") or (
        not current_user.role in ("admin_pay", "admin_trade", "backoffice", "finance")
        and not current_user.is_teamleader
    ):
        lead.sales_owner_id = current_user.id

    # Create prospect data (get-or-create to avoid duplicates on repeated calls)
    prospect_data = db.query(ProspectData).filter(ProspectData.lead_id == lead.id).first()
    if not prospect_data:
        prospect_data = ProspectData(lead_id=lead.id)
        db.add(prospect_data)
        db.flush()

    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead.id,
        action="moved_to_prospect", entity_type="lead", entity_id=lead.id,
    ))
    db.commit()
    return {"status": "moved to prospect", "lead_id": lead.id}


@router.post("/{lead_id}/to-onboarding-backoffice")
async def send_to_onboarding_backoffice(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move lead from onboarding_sales to onboarding_backoffice."""
    # Role check: only backoffice/admin/teamleader can advance to backoffice phase
    if current_user.role not in ("backoffice", "admin_pay", "admin_trade") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Alleen backoffice/admin kan dit uitvoeren")
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.pipeline_stage = PipelineStage.ONBOARDING_BACKOFFICE.value
    lead.backoffice_started_at = datetime.now(timezone.utc)
    # Clear any previous revision when moving forward
    lead.revision_status = None
    lead.revision_note = None
    lead.revision_date = None
    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead.id,
        action="moved_to_onboarding_backoffice", entity_type="lead", entity_id=lead.id,
    ))
    db.commit()
    return {"status": "moved to onboarding_backoffice", "lead_id": lead.id}


@router.post("/{lead_id}/send-back-to-sales")
async def send_back_to_onboarding_sales(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a lead back from onboarding_backoffice to onboarding_sales with a required note.
    Payload: {
        "note": str (required — backoffice explanation),
        "revision_status": str (needs_refactor | needs_clarification | rejected)
    }
    """
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    note_text = (data.get("note") or "").strip()
    if not note_text:
        raise HTTPException(status_code=400, detail="Notitie is verplicht bij terugsturen")

    revision_status = data.get("revision_status", "needs_refactor")
    if revision_status not in ("needs_refactor", "needs_clarification", "rejected"):
        revision_status = "needs_refactor"

    # Move back to onboarding_sales
    lead.pipeline_stage = PipelineStage.ONBOARDING_SALES.value
    lead.revision_status = revision_status
    lead.revision_note = note_text
    lead.revision_date = datetime.now(timezone.utc)
    lead.revision_by_id = current_user.id

    # Notify the sales owner (fallback to assigned user) that the dossier came back
    _notify_user_id = lead.sales_owner_id or lead.assigned_user_id
    if _notify_user_id:
        db.add(Notification(
            user_id=_notify_user_id,
            title="Dossier teruggestuurd door backoffice",
            message=f"{lead.company_name}: {note_text}",
            notification_type="status_change",
            entity_type="lead",
            entity_id=lead.id,
        ))

    # Create a visible note so sales can see it
    note = Note(
        lead_id=lead.id,
        user_id=current_user.id,
        content=f"🔄 TERUGGESTUURD door backoffice ({revision_status.replace('_', ' ')}): {note_text}",
    )
    db.add(note)

    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead.id,
        action="sent_back_to_sales", entity_type="lead", entity_id=lead.id,
    ))
    db.commit()
    return {
        "status": "sent back to onboarding_sales",
        "lead_id": lead.id,
        "revision_status": revision_status,
        "revision_note": note_text,
    }


@router.post("/{lead_id}/to-client")
async def send_to_client(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move lead from onboarding_backoffice to client."""
    # Role check: only backoffice/admin/teamleader can finalize client
    if current_user.role not in ("backoffice", "admin_pay", "admin_trade") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Alleen backoffice/admin kan een client finaliseren")
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.pipeline_stage = PipelineStage.CLIENT.value
    lead.client_since_date = datetime.now(timezone.utc)
    lead.revision_status = None
    lead.revision_note = None
    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead.id,
        action="moved_to_client", entity_type="lead", entity_id=lead.id,
    ))
    db.commit()
    return {"status": "moved to client", "lead_id": lead.id}


@router.put("/{lead_id}/score")
async def update_score(
    lead_id: int,
    score_data: LeadScoreUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update manual lead score."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.manual_score = score_data.manual_score
    lead.priority = score_data.priority
    db.commit()
    return {"status": "score updated"}


@router.delete("/{lead_id}")
async def soft_delete_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a lead (admin only)."""
    if current_user.role not in ("admin_pay", "admin_trade") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Alleen admins kunnen leads verwijderen")
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.is_deleted = True
    lead.deleted_at = datetime.now(timezone.utc)
    lead.deleted_by = current_user.id
    db.commit()
    return {"status": "deleted"}


# --- Custom Lists ---

@router.get("/lists/my")
async def get_my_lists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's custom lead lists."""
    lists = db.query(CustomList).filter(CustomList.user_id == current_user.id).all()
    return lists


@router.post("/lists")
async def create_custom_list(
    list_data: CustomListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom lead list."""
    custom_list = CustomList(
        name=list_data.name,
        description=list_data.description,
        user_id=current_user.id,
    )
    db.add(custom_list)
    db.commit()
    db.refresh(custom_list)
    return custom_list


@router.post("/lists/{list_id}/add/{lead_id}")
async def add_lead_to_list(
    list_id: int,
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a lead to a custom list."""
    entry = CustomListLead(custom_list_id=list_id, lead_id=lead_id)
    db.add(entry)
    db.commit()
    return {"status": "added"}


# --- Pinned Leads ---

@router.get("/pinned/my")
async def get_my_pinned_leads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's pinned leads."""
    pins = (
        db.query(PinnedLead)
        .filter(PinnedLead.user_id == current_user.id)
        .order_by(PinnedLead.position)
        .all()
    )
    lead_ids = [p.lead_id for p in pins]
    if not lead_ids:
        return []
    leads = db.query(Lead).filter(Lead.id.in_(lead_ids), Lead.is_deleted == False).all()
    return leads


@router.post("/{lead_id}/pin")
async def pin_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pin a lead for current user."""
    existing = db.query(PinnedLead).filter(
        PinnedLead.user_id == current_user.id,
        PinnedLead.lead_id == lead_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Lead already pinned")

    max_pos = db.query(func.max(PinnedLead.position)).filter(
        PinnedLead.user_id == current_user.id
    ).scalar() or 0

    pin = PinnedLead(user_id=current_user.id, lead_id=lead_id, position=max_pos + 1)
    db.add(pin)
    db.commit()
    return {"status": "pinned"}


@router.delete("/{lead_id}/pin")
async def unpin_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unpin a lead for current user."""
    pin = db.query(PinnedLead).filter(
        PinnedLead.user_id == current_user.id,
        PinnedLead.lead_id == lead_id,
    ).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    db.delete(pin)
    db.commit()
    return {"status": "unpinned"}


# --- Notes ---


@router.post("/{lead_id}/call-log")
async def log_call(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a phone call for a lead. Creates a ConversationLog entry of type 'phone'."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead niet gevonden")

    from app.models.communication import ConversationLog
    from datetime import datetime, timezone

    log = ConversationLog(
        lead_id=lead_id,
        user_id=current_user.id,
        type="phone",
        direction=data.get("direction", "outbound"),
        outcome=data.get("outcome", "reached"),
        duration_seconds=data.get("duration", data.get("duration_seconds", 0)),
        summary=data.get("notes", data.get("summary", "")),
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(log)

    # Update lead last activity
    lead.last_activity_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(log)

    return {
        "id": log.id,
        "lead_id": log.lead_id,
        "type": log.type,
        "outcome": log.outcome,
        "duration_seconds": log.duration_seconds,
        "summary": log.summary,
        "occurred_at": log.occurred_at.isoformat(),
        "user_id": log.user_id,
    }

@router.get("/{lead_id}/notes")
async def get_lead_notes(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all notes for a lead."""
    notes = (
        db.query(Note)
        .options(joinedload(Note.user))
        .filter(Note.lead_id == lead_id, Note.deleted_at.is_(None))
        .order_by(Note.created_at.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "content": n.content,
            "user_id": n.user_id,
            "user_name": n.user.full_name if n.user else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]


@router.post("/{lead_id}/notes")
async def add_lead_note(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a note to a lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    note = Note(
        lead_id=lead_id,
        user_id=current_user.id,
        content=data.get("content", ""),
    )
    db.add(note)

    # Log activity
    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead_id,
        action="note_added", entity_type="lead", entity_id=lead_id,
    ))

    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "content": note.content,
        "user_id": note.user_id,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.delete("/{lead_id}/notes/{note_id}")
async def delete_note(
    lead_id: int,
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id, Note.lead_id == lead_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and current_user.role not in ("admin_pay", "admin_trade"):
        raise HTTPException(status_code=403, detail="Niet toegestaan")
    # Soft-delete: mark as deleted but keep in database for compliance
    note.deleted_by_id = current_user.id
    note.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "deleted"}


@router.put("/{lead_id}/notes/{note_id}")
async def update_note(
    lead_id: int,
    note_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id, Note.lead_id == lead_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id and current_user.role not in ("admin_pay", "admin_trade"):
        raise HTTPException(status_code=403, detail="Niet toegestaan")
    note.content = data.get("content", note.content)
    db.commit()
    return {"id": note.id, "content": note.content}


# --- Communications ---

@router.get("/{lead_id}/communications")
async def get_lead_communications(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all communications for a lead (across all pipeline stages)."""
    comms = (
        db.query(Communication)
        .filter(Communication.lead_id == lead_id)
        .order_by(Communication.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "content": c.content,
            "user_id": c.user_id,
            "user_name": c.user.full_name if c.user else None,
            "mentioned_user_ids": c.mentioned_user_ids or [],
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in comms
    ]


@router.post("/{lead_id}/communications")
async def add_lead_communication(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a communication entry to a lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    comm = Communication(
        lead_id=lead_id,
        user_id=current_user.id,
        content=data.get("content", ""),
        mentioned_user_ids=data.get("mentioned_user_ids"),
    )
    db.add(comm)

    # Log activity
    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead_id,
        action="communication_added", entity_type="lead", entity_id=lead_id,
    ))

    db.commit()
    db.refresh(comm)
    return {
        "id": comm.id,
        "content": comm.content,
        "user_id": comm.user_id,
        "user_name": current_user.full_name,
        "created_at": comm.created_at.isoformat() if comm.created_at else None,
    }


# --- Activity Log ---

@router.get("/{lead_id}/activity")
async def get_lead_activity(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get activity log for a lead."""
    activities = (
        db.query(ActivityLog)
        .options(joinedload(ActivityLog.user))
        .filter(ActivityLog.lead_id == lead_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id,
            "action": a.action,
            "entity_type": a.entity_type,
            "details": a.details,
            "user_name": a.user.full_name if a.user else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in activities
    ]


# ── Client Forecasting (currency pair volume/margin) ────────────

def _calc_forecasting_revenue(item):
    """Calculate spot + hedge revenue for a forecasting item."""
    vol = item.volume_per_year or 0
    spot_m = item.spot_margin_pct or 0
    hedge_pct = item.hedging_pct or 0
    hedge_m = item.hedging_margin_pct or 0
    # Fallback: if no pct-based margins set, use legacy margin_per_year as flat EUR
    if spot_m == 0 and hedge_pct == 0 and (item.margin_per_year or 0) > 0:
        return item.margin_per_year
    spot_vol = vol * (1 - hedge_pct)
    hedge_vol = vol * hedge_pct
    return (spot_vol * spot_m) + (hedge_vol * hedge_m)

def _forecasting_item_dict(item, deals=None):
    vol = item.volume_per_year or 0
    hedge_pct = item.hedging_pct or 0
    spot_m = item.spot_margin_pct or 0
    hedge_m = item.hedging_margin_pct or 0
    spot_vol = vol * (1 - hedge_pct)
    hedge_vol = vol * hedge_pct
    spot_rev = spot_vol * spot_m
    hedge_rev = hedge_vol * hedge_m
    total_rev = _calc_forecasting_revenue(item)

    # Booked deals for this pair
    booked_volume = sum(d.volume for d in (deals or [])) if deals is not None else 0
    booked_revenue = sum((d.volume or 0) * (d.margin_pct or 0) for d in (deals or [])) if deals is not None else 0

    return {
        "id": item.id,
        "buy_currency": item.buy_currency,
        "sell_currency": item.sell_currency,
        "volume_per_year": vol,
        "spot_margin_pct": spot_m,
        "hedging_pct": hedge_pct,
        "hedging_margin_pct": hedge_m,
        "margin_per_year": item.margin_per_year,
        "spot_volume": spot_vol,
        "hedge_volume": hedge_vol,
        "spot_revenue": spot_rev,
        "hedge_revenue": hedge_rev,
        "total_revenue": total_rev,
        "booked_volume": booked_volume,
        "booked_revenue": booked_revenue,
        "remaining_volume": max(0, vol - booked_volume),
        "notes": item.notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "_deals": [_deal_dict(d) for d in (deals or [])],
    }


@router.get("/{lead_id}/forecasting")
async def get_client_forecasting(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all annual forecasting items + individual deals for a client."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    items = (
        db.query(ClientForecasting)
        .filter(ClientForecasting.lead_id == lead_id)
        .order_by(ClientForecasting.buy_currency, ClientForecasting.sell_currency)
        .all()
    )

    # Load deals grouped by forecasting_item_id
    all_deals = db.query(ClientDeal).filter(ClientDeal.lead_id == lead_id).all()
    deals_by_item = {}
    for d in all_deals:
        key = d.forecasting_item_id
        deals_by_item.setdefault(key, []).append(d)

    item_dicts = [_forecasting_item_dict(i, deals_by_item.get(i.id, [])) for i in items]

    total_volume = sum(i["volume_per_year"] for i in item_dicts)
    total_revenue = sum(i["total_revenue"] for i in item_dicts)
    total_booked_volume = sum(i["booked_volume"] for i in item_dicts)
    total_booked_revenue = sum(i["booked_revenue"] for i in item_dicts)

    # Unlinked deals (no forecasting_item_id)
    unlinked_deals = [_deal_dict(d) for d in deals_by_item.get(None, [])]

    return {
        "lead_id": lead_id,
        "total_volume": total_volume,
        "total_revenue": total_revenue,
        "total_booked_volume": total_booked_volume,
        "total_booked_revenue": total_booked_revenue,
        "items": item_dicts,
        "unlinked_deals": unlinked_deals,
    }


@router.post("/{lead_id}/forecasting")
async def add_forecasting_item(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new annual forecasting currency pair."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    item = ClientForecasting(
        lead_id=lead_id,
        buy_currency=data.get("buy_currency", "").upper(),
        sell_currency=data.get("sell_currency", "").upper(),
        volume_per_year=data.get("volume_per_year", 0),
        spot_margin_pct=data.get("spot_margin_pct", 0),
        hedging_pct=data.get("hedging_pct", 0),
        hedging_margin_pct=data.get("hedging_margin_pct", 0),
        margin_per_year=data.get("margin_per_year", 0),
        notes=data.get("notes"),
    )
    db.add(item)
    db.commit()
    return _forecasting_item_dict(item, [])


@router.put("/{lead_id}/forecasting/{item_id}")
async def update_forecasting_item(
    lead_id: int,
    item_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an annual forecasting item."""
    item = db.query(ClientForecasting).filter(
        ClientForecasting.id == item_id,
        ClientForecasting.lead_id == lead_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Forecasting item not found")

    for field in ["buy_currency", "sell_currency", "volume_per_year",
                  "spot_margin_pct", "hedging_pct", "hedging_margin_pct",
                  "margin_per_year", "notes"]:
        if field in data:
            val = data[field]
            if field in ["buy_currency", "sell_currency"] and val:
                val = val.upper()
            setattr(item, field, val)

    db.commit()
    deals = db.query(ClientDeal).filter(ClientDeal.forecasting_item_id == item_id).all()
    return _forecasting_item_dict(item, deals)


@router.delete("/{lead_id}/forecasting/{item_id}")
async def delete_forecasting_item(
    lead_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a forecasting item (and its linked deals)."""
    item = db.query(ClientForecasting).filter(
        ClientForecasting.id == item_id,
        ClientForecasting.lead_id == lead_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Forecasting item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id}


# ── Individual Deals ─────────────────────────────────────────────────

def _deal_dict(d):
    return {
        "id": d.id,
        "lead_id": d.lead_id,
        "forecasting_item_id": d.forecasting_item_id,
        "buy_currency": d.buy_currency,
        "sell_currency": d.sell_currency,
        "deal_date": d.deal_date.isoformat() if d.deal_date else None,
        "volume": d.volume,
        "deal_type": d.deal_type,
        "margin_pct": d.margin_pct,
        "revenue": (d.volume or 0) * (d.margin_pct or 0),
        "notes": d.notes,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "created_by": d.created_by.full_name if d.created_by else None,
    }


@router.get("/{lead_id}/deals")
async def get_client_deals(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all individual booked deals for a client."""
    deals = (
        db.query(ClientDeal)
        .filter(ClientDeal.lead_id == lead_id)
        .order_by(ClientDeal.deal_date.desc())
        .all()
    )
    return [_deal_dict(d) for d in deals]


@router.post("/{lead_id}/deals")
async def add_client_deal(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an individual booked deal."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    deal_date_raw = data.get("deal_date")
    if isinstance(deal_date_raw, str):
        deal_date = date.fromisoformat(deal_date_raw)
    else:
        deal_date = date.today()

    deal = ClientDeal(
        lead_id=lead_id,
        forecasting_item_id=data.get("forecasting_item_id"),
        buy_currency=data.get("buy_currency", "").upper(),
        sell_currency=data.get("sell_currency", "").upper(),
        deal_date=deal_date,
        volume=data.get("volume", 0),
        deal_type=data.get("deal_type", "spot"),
        margin_pct=data.get("margin_pct", 0),
        notes=data.get("notes"),
        created_by_id=current_user.id,
    )
    db.add(deal)
    db.commit()
    return _deal_dict(deal)


@router.delete("/{lead_id}/deals/{deal_id}")
async def delete_client_deal(
    lead_id: int,
    deal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a booked deal."""
    deal = db.query(ClientDeal).filter(
        ClientDeal.id == deal_id,
        ClientDeal.lead_id == lead_id,
    ).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    db.delete(deal)
    db.commit()
    return {"status": "deleted", "id": deal_id}


# ── Compliance Cases (per client) ────────────────────────────────

@router.get("/{lead_id}/compliance")
async def get_client_compliance_cases(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all compliance cases for a client."""
    cases = (
        db.query(ComplianceCase)
        .filter(ComplianceCase.lead_id == lead_id)
        .order_by(ComplianceCase.created_at.desc())
        .all()
    )

    return {
        "lead_id": lead_id,
        "cases": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "status": c.status,
                "priority": c.priority,
                "resolution_notes": c.resolution_notes,
                "created_by_name": c.created_by.full_name if c.created_by else None,
                "assigned_to_name": c.assigned_to.full_name if c.assigned_to else None,
                "document_count": len(c.documents) if c.documents else 0,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            }
            for c in cases
        ],
        "total": len(cases),
    }


@router.post("/{lead_id}/compliance")
async def create_compliance_case(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new compliance case for a client."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

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

    return {
        "id": case.id,
        "title": case.title,
        "description": case.description,
        "status": case.status,
        "priority": case.priority,
        "created_at": case.created_at.isoformat() if case.created_at else None,
    }


@router.put("/{lead_id}/compliance/{case_id}")
async def update_compliance_case(
    lead_id: int,
    case_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a compliance case."""
    case = db.query(ComplianceCase).filter(
        ComplianceCase.id == case_id,
        ComplianceCase.lead_id == lead_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    from datetime import datetime, timezone
    for field in ["title", "description", "status", "priority", "resolution_notes", "assigned_to_id"]:
        if field in data:
            setattr(case, field, data[field])

    if data.get("status") == "resolved" and not case.resolved_at:
        case.resolved_at = datetime.now(timezone.utc)

    db.commit()
    return {"id": case.id, "status": case.status}


@router.post("/{lead_id}/compliance/{case_id}/documents")
async def link_document_to_compliance(
    lead_id: int,
    case_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Link an existing document to a compliance case."""
    case = db.query(ComplianceCase).filter(
        ComplianceCase.id == case_id,
        ComplianceCase.lead_id == lead_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    doc_id = data.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id required")

    link = ComplianceCaseDocument(
        compliance_case_id=case_id,
        document_id=doc_id,
    )
    db.add(link)
    db.commit()
    return {"status": "linked", "compliance_case_id": case_id, "document_id": doc_id}


@router.delete("/{lead_id}/compliance/{case_id}")
async def delete_compliance_case(
    lead_id: int,
    case_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a compliance case and its linked case-document rows.

    Uses the same access model as the other compliance writes
    (create/update) — any authenticated user with access to the lead.
    Only the ComplianceCaseDocument link rows are removed; the underlying
    Document records are left intact.
    """
    case = db.query(ComplianceCase).filter(
        ComplianceCase.id == case_id,
        ComplianceCase.lead_id == lead_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Compliance case not found")

    # Remove linked case-document rows first (FK integrity)
    db.query(ComplianceCaseDocument).filter(
        ComplianceCaseDocument.compliance_case_id == case_id
    ).delete(synchronize_session=False)

    db.delete(case)

    db.add(ActivityLog(
        user_id=current_user.id, lead_id=lead_id,
        action="deleted_compliance_case", entity_type="compliance_case", entity_id=case_id,
    ))
    db.commit()
    return {"status": "deleted", "id": case_id}


# ── Correspondentie (all mail & comms history) ───────────────────

@router.get("/{lead_id}/correspondentie")
async def get_client_correspondence(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full correspondence history: emails, notes, communications, call logs."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Emails
    emails = (
        db.query(EmailSync)
        .filter(EmailSync.lead_id == lead_id)
        .order_by(EmailSync.received_at.desc())
        .all()
    )

    # Call logs
    calls = (
        db.query(CallLog)
        .options(joinedload(CallLog.user))
        .filter(CallLog.lead_id == lead_id)
        .order_by(CallLog.created_at.desc())
        .all()
    )

    # Communications
    comms = (
        db.query(Communication)
        .options(joinedload(Communication.user))
        .filter(Communication.lead_id == lead_id)
        .order_by(Communication.created_at.desc())
        .all()
    )

    # Notes
    notes = (
        db.query(Note)
        .options(joinedload(Note.user))
        .filter(Note.lead_id == lead_id)
        .order_by(Note.created_at.desc())
        .all()
    )

    # Build unified timeline
    timeline = []

    for e in emails:
        timeline.append({
            "type": "email",
            "id": e.id,
            "subject": e.subject,
            "from_email": e.from_email,
            "to_email": e.to_email,
            "snippet": e.snippet,
            "direction": e.direction,
            "date": e.received_at.isoformat() if e.received_at else e.created_at.isoformat() if e.created_at else None,
        })

    for c in calls:
        timeline.append({
            "type": "call",
            "id": c.id,
            "phone_number": c.phone_number,
            "duration_seconds": c.duration_seconds,
            "outcome": c.outcome,
            "notes": c.notes,
            "user_name": c.user.full_name if c.user else None,
            "date": c.created_at.isoformat() if c.created_at else None,
        })

    for cm in comms:
        timeline.append({
            "type": "communication",
            "id": cm.id,
            "content": cm.content,
            "user_name": cm.user.full_name if cm.user else None,
            "date": cm.created_at.isoformat() if cm.created_at else None,
        })

    for n in notes:
        timeline.append({
            "type": "note",
            "id": n.id,
            "content": n.content,
            "user_name": n.user.full_name if n.user else None,
            "date": n.created_at.isoformat() if n.created_at else None,
        })

    # Sort by date descending
    timeline.sort(key=lambda x: x.get("date") or "", reverse=True)

    return {
        "lead_id": lead_id,
        "timeline": timeline,
        "counts": {
            "emails": len(emails),
            "calls": len(calls),
            "communications": len(comms),
            "notes": len(notes),
        },
    }


# ── Gmail Sync ───────────────────────────────────────────────────────────────

@router.post("/{lead_id}/sync-gmail")
async def sync_gmail_for_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sync Gmail for a lead using ALL relevant users' tokens (current user + past owners).
    This way Joost sees emails that Jan sent when Jan was the owner, and vice versa.
    """
    from app.services.gmail_sync import sync_emails_for_lead

    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead niet gevonden")

    # Use ALL active users with a Google token — same strategy as the background job.
    # This ensures every team member's correspondence with this lead is captured.
    token_pool = (
        db.query(User)
        .filter(
            User.status == "active",
            User.google_refresh_token.isnot(None),
            User.google_refresh_token != "",
        )
        .all()
    )

    if not token_pool:
        raise HTTPException(
            status_code=400,
            detail="Geen Google koppeling gevonden. Log eerst in via Google."
        )

    total_synced = 0
    all_emails: set[str] = set()
    all_errors: list[str] = []

    for user in token_pool:
        result = await sync_emails_for_lead(lead_id, user, db)
        total_synced += result["synced"]
        all_emails.update(result["email_addresses"])
        all_errors.extend(result["errors"])

    return {
        "synced": total_synced,
        "email_addresses": list(all_emails),
        "errors": all_errors,
        "users_synced": len(token_pool),
        "message": f"{total_synced} nieuwe e-mail(s) gesynchroniseerd" if total_synced > 0 else "Alles al up-to-date",
    }


@router.get("/{lead_id}/emails")
async def get_lead_emails(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all synced emails for a lead, newest first.
    Shows emails from ALL users who ever worked on this lead.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead niet gevonden")

    emails = (
        db.query(EmailSync)
        .filter(EmailSync.lead_id == lead_id)
        .order_by(EmailSync.received_at.desc())
        .all()
    )

    return [
        {
            "id": e.id,
            "gmail_message_id": e.gmail_message_id,
            "gmail_thread_id": e.gmail_thread_id,
            "subject": e.subject,
            "from_email": e.from_email,
            "to_email": e.to_email,
            "snippet": e.snippet,
            "body_html": e.body_html,
            "direction": e.direction,
            "synced_by": e.user.full_name if e.user else None,
            "received_at": e.received_at.isoformat() if e.received_at else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in emails
    ]


@router.put("/{lead_id}/assign-sales-user")
async def assign_sales_user(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a sales user (and optionally dealer) to a lead. Backoffice use."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Only backoffice, admin, and teamleader can reassign sales ownership
    if current_user.role not in ("backoffice", "admin_pay", "admin_trade") and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Alleen backoffice en admins kunnen sales eigenaren toewijzen")

    if "sales_owner_id" in data:
        lead.sales_owner_id = data["sales_owner_id"]
    if "dealer_id" in data:
        lead.dealer_id = data["dealer_id"]
    db.commit()
    return {"status": "ok"}


@router.post("/{lead_id}/assign-account-manager")
async def assign_account_manager(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign an accountmanager to a client."""
    # Allow admin, teamleader, and backoffice to assign account managers
    is_allowed = current_user.role in ("admin_pay", "admin_trade", "backoffice") or current_user.is_teamleader
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Only admins/teamleaders/backoffice can assign account managers")
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    manager_id = data.get("account_manager_id")
    lead.account_manager_id = manager_id if manager_id else None
    db.commit()
    db.refresh(lead)
    return {"status": "ok", "account_manager_id": lead.account_manager_id}


# ── Product Lines (multi-row volumes/revenue per lead) ───────────────

def _product_line_dict(pl: ProductLine):
    vol = pl.volume or 0
    margin = pl.margin_pct or 0
    return {
        "id": pl.id,
        "lead_id": pl.lead_id,
        "product": pl.product,
        "name": pl.name,
        "volume": vol,
        "margin_pct": margin,
        "note": pl.note,
        "revenue": vol * margin / 100,
        "created_at": pl.created_at.isoformat() if pl.created_at else None,
    }


@router.get("/{lead_id}/product-lines")
async def get_product_lines(
    lead_id: int,
    product: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List product lines for a lead, optionally filtered by product."""
    query = db.query(ProductLine).filter(ProductLine.lead_id == lead_id)
    if product:
        query = query.filter(ProductLine.product == product)
    lines = query.order_by(ProductLine.created_at.asc()).all()
    return [_product_line_dict(pl) for pl in lines]


@router.post("/{lead_id}/product-lines")
async def create_product_line(
    lead_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a product line for a lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    pl = ProductLine(
        lead_id=lead_id,
        product=data.get("product"),
        name=data.get("name", ""),
        volume=float(data.get("volume") or 0),
        margin_pct=float(data.get("margin_pct") or 0),
        note=data.get("note"),
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return _product_line_dict(pl)


@router.put("/{lead_id}/product-lines/{line_id}")
async def update_product_line(
    lead_id: int,
    line_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a product line."""
    pl = db.query(ProductLine).filter(
        ProductLine.id == line_id,
        ProductLine.lead_id == lead_id,
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Product line not found")
    if "name" in data:
        pl.name = data["name"]
    if "volume" in data:
        pl.volume = float(data.get("volume") or 0)
    if "margin_pct" in data:
        pl.margin_pct = float(data.get("margin_pct") or 0)
    if "note" in data:
        pl.note = data["note"]
    if "product" in data and data["product"]:
        pl.product = data["product"]
    db.commit()
    db.refresh(pl)
    return _product_line_dict(pl)


@router.delete("/{lead_id}/product-lines/{line_id}")
async def delete_product_line(
    lead_id: int,
    line_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a product line."""
    pl = db.query(ProductLine).filter(
        ProductLine.id == line_id,
        ProductLine.lead_id == lead_id,
    ).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Product line not found")
    db.delete(pl)
    db.commit()
    return {"status": "deleted", "id": line_id}
