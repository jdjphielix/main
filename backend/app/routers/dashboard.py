"""Dashboard router: KPIs, pipeline, activity feed, targets, daily call list."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func, and_, or_
from datetime import datetime, date, timezone, timedelta
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead, PipelineStage, LeadStatus, ClientForecasting, ProspectData
from app.models.communication import CallLog
from app.models.notification import ActivityLog, TeamTarget

router = APIRouter()


# ─── Helpers ───

def _is_admin_or_teamleader(user: User) -> bool:
    """Return True if user is admin (any type) or teamleader."""
    return user.role in ("admin_pay", "admin_trade", "teamleader") or user.is_teamleader


def _is_admin(user: User) -> bool:
    return user.role in ("admin_pay", "admin_trade")


def _is_sales_only(user: User) -> bool:
    return user.role == "sales" and not user.is_teamleader


def _get_period_start(period: str, now: datetime) -> datetime:
    if period == "today":
        return datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    elif period == "week" or period == "weekly":
        start = now - timedelta(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month" or period == "monthly":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "daily":
        return datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    return now


def _apply_user_filter(query, user: User, use_sales_owner: bool = False):
    """
    For sales-only users: filter by sales_owner_id (for post-lock stages) or assigned_user_id.
    For admin/teamleader: no filter (team-wide).
    """
    if _is_sales_only(user):
        if use_sales_owner:
            return query.filter(
                or_(
                    Lead.sales_owner_id == user.id,
                    Lead.assigned_user_id == user.id,
                )
            )
        else:
            return query.filter(Lead.assigned_user_id == user.id)
    return query


def _get_sales_user_ids(db: Session) -> list:
    """Get all sales user IDs (for team-wide aggregation)."""
    users = db.query(User.id).filter(
        User.role == "sales",
        User.status == "active",
    ).all()
    return [u[0] for u in users]


# ─── KPIs ───

@router.get("/kpis")
async def get_kpis(
    period: str = "today",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get KPIs: calls, pipeline counts, conversion rate.
    Sales users see only their own data.
    Admin/teamleader see team-wide totals.
    """
    now = datetime.now(timezone.utc)
    start = _get_period_start(period, now)
    end = now

    is_personal = _is_sales_only(current_user)

    # Calls in period
    calls_q = db.query(func.count(CallLog.id)).filter(
        CallLog.created_at >= start,
        CallLog.created_at <= end,
    )
    if is_personal:
        calls_q = calls_q.filter(CallLog.user_id == current_user.id)
    calls = calls_q.scalar() or 0

    # Total leads
    leads_q = db.query(func.count(Lead.id)).filter(Lead.is_deleted == False)
    if is_personal:
        leads_q = leads_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
    leads_assigned = leads_q.scalar() or 0

    # Leads by stage
    by_stage = {}
    for stage in PipelineStage:
        q = db.query(func.count(Lead.id)).filter(
            Lead.pipeline_stage == stage.value,
            Lead.is_deleted == False,
        )
        if is_personal:
            q = q.filter(
                or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
            )
        by_stage[stage.value] = q.scalar() or 0

    # Conversion rate
    # Consistent definition: (# leads that ever converted, i.e. pipeline_stage
    # >= prospect) / (total # leads), so teller and noemer share the same base
    # and the rate can never exceed 100%. `contacted` (is_called) is kept as a
    # separate informational metric in the response.
    contacted_q = db.query(func.count(Lead.id)).filter(
        Lead.is_called == True,
        Lead.is_deleted == False,
    )
    converted_q = db.query(func.count(Lead.id)).filter(
        Lead.pipeline_stage.in_([
            PipelineStage.PROSPECT.value,
            PipelineStage.ONBOARDING_SALES.value,
            PipelineStage.ONBOARDING_BACKOFFICE.value,
            PipelineStage.CLIENT.value,
        ]),
        Lead.is_deleted == False,
    )
    total_leads_q = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
    )
    if is_personal:
        contacted_q = contacted_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
        converted_q = converted_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
        total_leads_q = total_leads_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )

    contacted = contacted_q.scalar() or 0
    converted = converted_q.scalar() or 0
    total_leads = total_leads_q.scalar() or 0
    conversion_rate = (converted / total_leads * 100) if total_leads > 0 else 0
    conversion_rate = min(conversion_rate, 100)

    return {
        "period": period,
        "calls": calls,
        "leads_assigned": leads_assigned,
        "by_stage": by_stage,
        "contacted": contacted,
        "converted": converted,
        "conversion_rate": round(conversion_rate, 2),
        "is_personal": is_personal,
    }


# ─── Pipeline ───

@router.get("/pipeline")
async def get_pipeline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get funnel data per stage. Sales users see only their own."""
    stages = [
        PipelineStage.LEAD,
        PipelineStage.PROSPECT,
        PipelineStage.ONBOARDING_SALES,
        PipelineStage.ONBOARDING_BACKOFFICE,
        PipelineStage.CLIENT,
    ]
    is_personal = _is_sales_only(current_user)

    pipeline = []
    for stage in stages:
        q = db.query(func.count(Lead.id)).filter(
            Lead.pipeline_stage == stage.value,
            Lead.is_deleted == False,
        )
        if is_personal:
            q = q.filter(
                or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
            )
        count = q.scalar() or 0
        pipeline.append({"stage": stage.value, "count": count})

    return {"pipeline": pipeline, "is_personal": is_personal}


# ─── Activity Feed ───

@router.get("/activity-feed")
async def get_activity_feed(
    own_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get recent activities."""
    query = db.query(ActivityLog).options(
        joinedload(ActivityLog.user),
        joinedload(ActivityLog.lead),
    )

    if own_only or _is_sales_only(current_user):
        query = query.filter(ActivityLog.user_id == current_user.id)
    elif current_user.is_teamleader or _is_admin(current_user):
        # Show all sales team activities
        pass  # No filter — team-wide
    else:
        query = query.filter(ActivityLog.user_id == current_user.id)

    total = query.count()
    activities = query.order_by(
        ActivityLog.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "activities": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "user_name": a.user.full_name if a.user else "Onbekend",
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "details": a.details,
                "created_at": a.created_at,
                "lead": {
                    "id": a.lead.id,
                    "company_name": a.lead.company_name,
                } if a.lead else None,
            }
            for a in activities
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ─── Targets ───

def _client_forecasting_revenue(item: ClientForecasting) -> float:
    """Annual revenue for a single client forecasting row.

    Mirrors the proven calculation used in the sales leaderboard (users.py):
    margins are FRACTIONS here; `margin_per_year` is the legacy flat-EUR field
    used only when no spot/hedge split is configured.
    """
    vol = item.volume_per_year or 0
    hedge_pct = item.hedging_pct or 0
    spot_m = item.spot_margin_pct or 0
    hedge_m = item.hedging_margin_pct or 0
    if spot_m == 0 and hedge_pct == 0 and (item.margin_per_year or 0) > 0:
        return item.margin_per_year or 0
    return vol * (1 - hedge_pct) * spot_m + vol * hedge_pct * hedge_m


def _user_revenue_sum(user_id: int, db: Session) -> float:
    """Total revenue attributed to a user across their pipeline + client leads.

    Reuses the same revenue sources as the leaderboard (users.py): prospect/
    onboarding revenue from ProspectData estimates, client revenue from
    ClientForecasting. Ownership = sales_owner_id OR assigned_user_id so a
    user gets credit consistently with the leads list.
    """
    owner = or_(Lead.sales_owner_id == user_id, Lead.assigned_user_id == user_id)

    total = 0.0

    # Pipeline (prospect + onboarding) revenue from ProspectData estimates
    pd_lead_ids = [
        r.lead_id for r in db.query(ProspectData.lead_id)
        .join(Lead, Lead.id == ProspectData.lead_id)
        .filter(
            Lead.is_deleted == False,
            owner,
            Lead.pipeline_stage.in_([
                PipelineStage.PROSPECT.value,
                PipelineStage.ONBOARDING_SALES.value,
                PipelineStage.ONBOARDING_BACKOFFICE.value,
            ]),
        ).all()
    ]
    if pd_lead_ids:
        for pd in db.query(ProspectData).filter(ProspectData.lead_id.in_(pd_lead_ids)).all():
            total += (pd.fx_estimated_revenue or 0) + (pd.tf_estimated_revenue or 0)

    # Client revenue from ClientForecasting
    client_lead_ids = [
        r.id for r in db.query(Lead.id).filter(
            Lead.is_deleted == False,
            owner,
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
        ).all()
    ]
    if client_lead_ids:
        for item in db.query(ClientForecasting).filter(
            ClientForecasting.lead_id.in_(client_lead_ids)
        ).all():
            total += _client_forecasting_revenue(item)

    return total


def _calculate_target_progress(target: TeamTarget, user_id: int, db: Session, now: datetime) -> int:
    """Calculate progress for a specific target and user."""
    start = _get_period_start(target.period or "weekly", now)
    progress = 0

    if target.target_type == "calls_per_week":
        progress = db.query(func.count(CallLog.id)).filter(
            CallLog.user_id == user_id,
            CallLog.created_at >= start,
        ).scalar() or 0

    elif target.target_type == "conversions":
        # A "conversion" = a lead that reached prospect (or beyond) within the
        # period. Count on prospect_since (when the conversion happened) rather
        # than created_at, and include every stage >= prospect — a lead that
        # already moved on to onboarding/client still converted in-period.
        progress = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == user_id, Lead.sales_owner_id == user_id),
            Lead.pipeline_stage.in_([
                PipelineStage.PROSPECT.value,
                PipelineStage.ONBOARDING_SALES.value,
                PipelineStage.ONBOARDING_BACKOFFICE.value,
                PipelineStage.CLIENT.value,
            ]),
            Lead.prospect_since != None,
            Lead.prospect_since >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

    elif target.target_type == "revenue":
        # Sum of pipeline + client revenue attributed to this user. Rounded to
        # an int to match the int return contract of this helper.
        progress = int(round(_user_revenue_sum(user_id, db)))

    elif target.target_type == "pipeline_value":
        # NOTE: despite the "value" name, this target historically tracks the
        # *count* of leads in prospect+ stages owned by the user, and the UI
        # renders it as such. Kept as a count to avoid a UI break. For an
        # actual revenue figure use the dedicated "revenue" target type above.
        progress = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == user_id, Lead.sales_owner_id == user_id),
            Lead.pipeline_stage.in_([
                PipelineStage.PROSPECT.value,
                PipelineStage.ONBOARDING_SALES.value,
                PipelineStage.ONBOARDING_BACKOFFICE.value,
                PipelineStage.CLIENT.value,
            ]),
            Lead.is_deleted == False,
        ).scalar() or 0

    elif target.target_type == "leads_called":
        progress = db.query(func.count(Lead.id)).filter(
            Lead.assigned_user_id == user_id,
            Lead.is_called == True,
            Lead.last_called_at >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

    elif target.target_type == "clients_won":
        progress = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == user_id, Lead.sales_owner_id == user_id),
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
            Lead.is_deleted == False,
        ).scalar() or 0

    return progress


@router.get("/targets")
async def get_targets(
    user_id: Optional[int] = None,   # admin/teamleader can request a specific user's targets
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get targets with progress.
    - Sales users: always their own targets (user_id param is ignored).
    - Admin/teamleader without user_id: cumulative team-wide overview.
    - Admin/teamleader with user_id: individual targets for that specific user.
    """
    now = datetime.now(timezone.utc)
    is_personal = _is_sales_only(current_user)

    # Admin/teamleader requesting a specific user's individual targets
    if not is_personal and user_id is not None:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")

        targets = db.query(TeamTarget).filter(
            TeamTarget.is_active == True,
            or_(
                TeamTarget.user_id == user_id,
                TeamTarget.user_id == None,
            ),
        ).all()

        result = []
        for target in targets:
            progress = _calculate_target_progress(target, user_id, db, now)
            result.append({
                "id": target.id,
                "target_type": target.target_type,
                "target_value": target.target_value,
                "progress": progress,
                "percentage": round((progress / target.target_value * 100), 1) if target.target_value else 0,
                "period": target.period,
                "user_id": target.user_id,
            })
        return {"targets": result, "is_personal": False, "for_user_id": user_id}


    if is_personal:
        # Show only targets assigned to this user (or team-wide targets applied to them)
        targets = db.query(TeamTarget).filter(
            TeamTarget.is_active == True,
            or_(
                TeamTarget.user_id == current_user.id,
                TeamTarget.user_id == None,
            ),
        ).all()

        result = []
        for target in targets:
            progress = _calculate_target_progress(target, current_user.id, db, now)
            result.append({
                "id": target.id,
                "target_type": target.target_type,
                "target_value": target.target_value,
                "progress": progress,
                "percentage": round((progress / target.target_value * 100), 1) if target.target_value else 0,
                "period": target.period,
                "user_id": target.user_id,
            })

        return {"targets": result, "is_personal": True}

    else:
        # Teamleader/admin: show cumulative targets across all sales users
        # Get all unique target types that are active
        targets = db.query(TeamTarget).filter(
            TeamTarget.is_active == True,
        ).all()

        # Group by target_type + period
        grouped = {}
        for target in targets:
            key = f"{target.target_type}_{target.period}"
            if key not in grouped:
                grouped[key] = {
                    "target_type": target.target_type,
                    "period": target.period,
                    "total_target_value": 0,
                    "total_progress": 0,
                    "user_targets": [],
                }
            # Determine which user(s) this applies to
            if target.user_id:
                progress = _calculate_target_progress(target, target.user_id, db, now)
                grouped[key]["total_target_value"] += target.target_value
                grouped[key]["total_progress"] += progress
                user = db.query(User).filter(User.id == target.user_id).first()
                grouped[key]["user_targets"].append({
                    "id": target.id,
                    "user_id": target.user_id,
                    "user_name": user.full_name if user else "Onbekend",
                    "target_value": target.target_value,
                    "progress": progress,
                    "percentage": round((progress / target.target_value * 100), 1) if target.target_value else 0,
                })
            else:
                # Team-wide target (target.user_id is NULL): the target_value is
                # defined PER sales user, so the team total is value × headcount.
                # Progress is summed per user with the SAME owner definition used
                # in _calculate_target_progress, keeping numerator and denominator
                # on the same per-user basis (consistent team aggregate).
                sales_ids = _get_sales_user_ids(db)
                total_progress = 0
                for uid in sales_ids:
                    total_progress += _calculate_target_progress(target, uid, db, now)
                grouped[key]["total_target_value"] += target.target_value * len(sales_ids)
                grouped[key]["total_progress"] += total_progress

        result = []
        for key, data in grouped.items():
            pct = round((data["total_progress"] / data["total_target_value"] * 100), 1) if data["total_target_value"] else 0
            result.append({
                "id": key,
                "target_type": data["target_type"],
                "target_value": data["total_target_value"],
                "progress": data["total_progress"],
                "percentage": pct,
                "period": data["period"],
                "user_targets": data["user_targets"],
            })

        return {"targets": result, "is_personal": False}


# ─── Team Breakdown (for teamleaders) ───

@router.get("/targets/team-breakdown")
async def get_targets_team_breakdown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get per-user target breakdown. Teamleaders and admins only."""
    if not _is_admin_or_teamleader(current_user):
        raise HTTPException(status_code=403, detail="Alleen teamleiders en admins")

    now = datetime.now(timezone.utc)

    # Get all sales users
    sales_users = db.query(User).filter(
        User.role == "sales",
        User.status == "active",
    ).all()

    breakdown = []
    for su in sales_users:
        # Get targets for this user
        user_targets = db.query(TeamTarget).filter(
            TeamTarget.is_active == True,
            or_(
                TeamTarget.user_id == su.id,
                TeamTarget.user_id == None,
            ),
        ).all()

        user_data = {
            "user_id": su.id,
            "user_name": su.full_name,
            "targets": [],
        }
        for t in user_targets:
            progress = _calculate_target_progress(t, su.id, db, now)
            user_data["targets"].append({
                "id": t.id,
                "target_type": t.target_type,
                "target_value": t.target_value,
                "progress": progress,
                "percentage": round((progress / t.target_value * 100), 1) if t.target_value else 0,
                "period": t.period,
            })
        breakdown.append(user_data)

    return {"breakdown": breakdown}


# ─── Admin Target Management ───

class TargetCreate(BaseModel):
    user_id: Optional[int] = None  # None = team-wide
    target_type: str  # calls_per_week, conversions, pipeline_value, leads_called, clients_won, revenue
    target_value: int
    period: str = "weekly"  # daily, weekly, monthly


class TargetUpdate(BaseModel):
    target_value: Optional[int] = None
    period: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/targets")
async def create_target(
    data: TargetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a target for a specific user or team-wide. Admin only."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Alleen admins kunnen targets instellen")

    # Validate user exists if user_id given
    if data.user_id:
        user = db.query(User).filter(User.id == data.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")

    # Deactivate existing target of same type for same user/team
    existing = db.query(TeamTarget).filter(
        TeamTarget.target_type == data.target_type,
        TeamTarget.period == data.period,
        TeamTarget.is_active == True,
    )
    if data.user_id:
        existing = existing.filter(TeamTarget.user_id == data.user_id)
    else:
        existing = existing.filter(TeamTarget.user_id == None)
    existing.update({"is_active": False})

    target = TeamTarget(
        user_id=data.user_id,
        target_type=data.target_type,
        target_value=data.target_value,
        period=data.period,
        created_by_id=current_user.id,
        is_active=True,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    return {
        "id": target.id,
        "user_id": target.user_id,
        "target_type": target.target_type,
        "target_value": target.target_value,
        "period": target.period,
        "is_active": target.is_active,
    }


@router.put("/targets/{target_id}")
async def update_target(
    target_id: int,
    data: TargetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a target. Admin only."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Alleen admins kunnen targets wijzigen")

    target = db.query(TeamTarget).filter(TeamTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target niet gevonden")

    if data.target_value is not None:
        target.target_value = data.target_value
    if data.period is not None:
        target.period = data.period
    if data.is_active is not None:
        target.is_active = data.is_active

    db.commit()
    db.refresh(target)

    return {
        "id": target.id,
        "user_id": target.user_id,
        "target_type": target.target_type,
        "target_value": target.target_value,
        "period": target.period,
        "is_active": target.is_active,
    }


@router.delete("/targets/{target_id}")
async def delete_target(
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate a target. Admin only."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Alleen admins kunnen targets verwijderen")

    target = db.query(TeamTarget).filter(TeamTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target niet gevonden")

    target.is_active = False
    db.commit()

    return {"ok": True}


@router.get("/targets/all")
async def get_all_targets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all targets (active and inactive) for admin management. Admin only."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Alleen admins")

    targets = db.query(TeamTarget).options(
        joinedload(TeamTarget.user),
    ).order_by(TeamTarget.is_active.desc(), TeamTarget.created_at.desc()).all()

    return {
        "targets": [
            {
                "id": t.id,
                "user_id": t.user_id,
                "user_name": t.user.full_name if t.user else "Team-breed",
                "target_type": t.target_type,
                "target_value": t.target_value,
                "period": t.period,
                "is_active": t.is_active,
                "created_by_id": t.created_by_id,
            }
            for t in targets
        ]
    }


# ─── Sales Users List (for admin target assignment) ───

@router.get("/sales-users")
async def get_sales_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get list of all sales users. Admin/teamleader only."""
    if not _is_admin_or_teamleader(current_user):
        raise HTTPException(status_code=403, detail="Niet geautoriseerd")

    users = db.query(User).filter(
        User.role == "sales",
        User.status == "active",
    ).order_by(User.full_name).all()

    return {
        "users": [
            {"id": u.id, "full_name": u.full_name, "email": u.email, "is_teamleader": u.is_teamleader}
            for u in users
        ]
    }


# ─── Daily List ───

@router.get("/my-daily-list")
async def get_daily_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get today's call list, sorted by position."""
    today = date.today()

    leads = db.query(Lead).filter(
        Lead.on_daily_list == True,
        Lead.daily_list_date == today,
        Lead.daily_list_user_id == current_user.id,
        Lead.is_deleted == False,
    ).order_by(Lead.daily_list_position.asc()).all()

    return {
        "date": today.isoformat(),
        "calls": [
            {
                "id": l.id,
                "company_name": l.company_name,
                "contact_name": l.contact_name,
                "contact_phone": l.contact_phone,
                "contact_mobile": l.contact_mobile,
                "position": l.daily_list_position,
                "is_called": l.is_called,
                "last_called_at": l.last_called_at,
            }
            for l in leads
        ],
        "total": len(leads),
    }
