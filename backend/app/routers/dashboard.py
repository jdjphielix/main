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
from app.models.lead import Lead, PipelineStage, LeadStatus
from app.models.communication import CallLog
from app.models.notification import ActivityLog, TeamTarget, ManualAchievement
from app.routers.leads import product_lines_revenue_bulk

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

    # Total leads in pipeline (snapshot — not period filtered: this is a current state count)
    # Separately: new leads created in period
    leads_q = db.query(func.count(Lead.id)).filter(Lead.is_deleted == False)
    if is_personal:
        leads_q = leads_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
    leads_assigned = leads_q.scalar() or 0

    # New leads created in this period
    new_leads_q = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.created_at >= start,
        Lead.created_at <= end,
        Lead.pipeline_stage == PipelineStage.LEAD.value,
    )
    if is_personal:
        new_leads_q = new_leads_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
    new_leads_in_period = new_leads_q.scalar() or 0

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
    if is_personal:
        contacted_q = contacted_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
        converted_q = converted_q.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )

    contacted = contacted_q.scalar() or 0
    converted = converted_q.scalar() or 0
    conversion_rate = (converted / contacted * 100) if contacted > 0 else 0

    return {
        "period": period,
        "calls": calls,
        "leads_assigned": leads_assigned,
        "by_stage": by_stage,
        "contacted": contacted,
        "converted": converted,
        "conversion_rate": round(conversion_rate, 2),
        "is_personal": is_personal,
        "new_leads_in_period": new_leads_in_period,
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
        # Filter op prospect_since: wanneer de lead écht prospect werd (niet aanmaakdatum)
        progress = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == user_id, Lead.sales_owner_id == user_id),
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            Lead.prospect_since >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

    elif target.target_type == "pipeline_value":
        # Count leads in prospect+ stages owned by user
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
        # Filter op client_since_date zodat alleen klanten van deze periode tellen
        progress = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == user_id, Lead.sales_owner_id == user_id),
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
            Lead.client_since_date >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

    # Add manual achievements for this period
    manual = db.query(ManualAchievement).filter(
        ManualAchievement.user_id == user_id,
        ManualAchievement.target_type == target.target_type,
        ManualAchievement.period_date >= start.date() if hasattr(start, 'date') else start,
    ).all()
    progress += sum(a.amount for a in manual)

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
        # Pre-load all users to avoid N+1 queries in the loop below
        _target_user_ids = list({t.user_id for t in targets if t.user_id})
        _users_map = {
            u.id: u for u in db.query(User).filter(User.id.in_(_target_user_ids)).all()
        } if _target_user_ids else {}

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
                user = _users_map.get(target.user_id)
                grouped[key]["user_targets"].append({
                    "id": target.id,
                    "user_id": target.user_id,
                    "user_name": user.full_name if user else "Onbekend",
                    "target_value": target.target_value,
                    "progress": progress,
                    "percentage": round((progress / target.target_value * 100), 1) if target.target_value else 0,
                })
            else:
                # Team-wide target: aggregate across all sales users
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


# ─── Manual Achievements ───

@router.post("/targets/{target_id}/achievement")
async def register_achievement(
    target_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teamleader/admin registers a manual achievement for a user."""
    if not current_user.is_teamleader and current_user.role not in ("admin_pay", "admin_trade"):
        raise HTTPException(status_code=403, detail="Alleen teamleaders/admins kunnen achievements registreren")

    target = db.query(TeamTarget).filter(TeamTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target niet gevonden")

    user_id = data.get("user_id") or (target.user_id if target.user_id else current_user.id)
    amount = data.get("amount", 1)
    note = data.get("note", "")

    achievement = ManualAchievement(
        target_id=target_id,
        user_id=user_id,
        registered_by=current_user.id,
        amount=amount,
        note=note,
        target_type=target.target_type,
        period_date=datetime.now(timezone.utc).date(),
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)
    return {"status": "ok", "achievement_id": achievement.id, "amount": amount}


@router.get("/targets/{target_id}/achievements")
async def get_achievements(
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    achievements = db.query(ManualAchievement).filter(
        ManualAchievement.target_id == target_id
    ).order_by(ManualAchievement.created_at.desc()).limit(50).all()

    return {"achievements": [
        {
            "id": a.id,
            "user_id": a.user_id,
            "amount": a.amount,
            "note": a.note,
            "created_at": a.created_at.isoformat(),
            "target_type": a.target_type,
        }
        for a in achievements
    ]}


# â”€â”€â”€ Hot Prospects (for teamleader/admin dashboard widget) â”€â”€â”€

@router.get("/hot-prospects")
async def get_hot_prospects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all hot prospects. Teamleader sees team's, sales sees own."""
    from sqlalchemy.orm import joinedload as jl
    from app.models.lead import ProspectData

    query = db.query(Lead).options(
        jl(Lead.prospect_data),
        jl(Lead.sales_owner),
    ).filter(
        Lead.is_hot_prospect == True,
        Lead.pipeline_stage == PipelineStage.PROSPECT.value,
        Lead.is_deleted == False,
    )

    is_personal = _is_sales_only(current_user)
    if is_personal:
        query = query.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
    elif not (current_user.is_superuser or _is_admin(current_user)):
        team_ids = db.query(User.id).filter(
            User.team_leader_id == current_user.id,
            User.status == "active",
        ).all()
        team_ids = [u[0] for u in team_ids] + [current_user.id]
        query = query.filter(
            or_(Lead.sales_owner_id.in_(team_ids), Lead.assigned_user_id.in_(team_ids))
        )

    prospects = query.order_by(Lead.hot_prospect_set_at.desc()).all()

    # Revenue now comes from the "+" product lines (volume * margin% / 100)
    pl_rev_map = product_lines_revenue_bulk(db, [p.id for p in prospects])

    result = []
    for p in prospects:
        total_rev = pl_rev_map.get(p.id, 0)
        result.append({
            "id": p.id,
            "company_name": p.company_name,
            "sales_owner_name": p.sales_owner.full_name if p.sales_owner else None,
            "sales_owner_id": p.sales_owner_id,
            "product_lines_revenue": total_rev,
            "total_revenue": total_rev,
            "hot_prospect_set_at": p.hot_prospect_set_at,
            "prospect_since": p.prospect_since,
        })

    return {"hot_prospects": result, "total": len(result)}


# â”€â”€â”€ Revenue Pipeline (ProspectData based) â”€â”€â”€

@router.get("/revenue-pipeline")
async def get_revenue_pipeline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate revenue from ProspectData across pipeline stages."""
    from sqlalchemy.orm import joinedload as jl
    from app.models.lead import ProspectData

    is_personal = _is_sales_only(current_user)

    stages = [
        PipelineStage.PROSPECT.value,
        PipelineStage.ONBOARDING_SALES.value,
        PipelineStage.ONBOARDING_BACKOFFICE.value,
        PipelineStage.CLIENT.value,
    ]

    query = db.query(Lead).options(jl(Lead.prospect_data)).filter(
        Lead.pipeline_stage.in_(stages),
        Lead.is_deleted == False,
    )
    if is_personal:
        query = query.filter(
            or_(Lead.assigned_user_id == current_user.id, Lead.sales_owner_id == current_user.id)
        )
    elif not (current_user.is_superuser or _is_admin(current_user)) and current_user.is_teamleader:
        team_ids = db.query(User.id).filter(
            User.team_leader_id == current_user.id,
            User.status == "active",
        ).all()
        team_ids = [u[0] for u in team_ids] + [current_user.id]
        query = query.filter(
            or_(Lead.sales_owner_id.in_(team_ids), Lead.assigned_user_id.in_(team_ids))
        )

    leads = query.all()

    # Revenue from the "+" product lines. Split fx/tf by ProductLine.product
    # (taperpay = FX, tapertrade = TF) with a single bulk query (no N+1).
    from app.models.lead import ProductLine
    lead_ids = [lead.id for lead in leads]
    fx_map: dict = {}
    tf_map: dict = {}
    if lead_ids:
        for pl in db.query(ProductLine).filter(ProductLine.lead_id.in_(lead_ids)).all():
            rev = (pl.volume or 0) * (pl.margin_pct or 0) / 100
            if pl.product == "tapertrade":
                tf_map[pl.lead_id] = tf_map.get(pl.lead_id, 0) + rev
            else:
                fx_map[pl.lead_id] = fx_map.get(pl.lead_id, 0) + rev

    by_stage = {s: {"count": 0, "fx_revenue": 0.0, "tf_revenue": 0.0, "total": 0.0} for s in stages}
    for lead in leads:
        fx = fx_map.get(lead.id, 0)
        tf = tf_map.get(lead.id, 0)
        s = lead.pipeline_stage
        if s in by_stage:
            by_stage[s]["count"] += 1
            by_stage[s]["fx_revenue"] += fx
            by_stage[s]["tf_revenue"] += tf
            by_stage[s]["total"] += fx + tf

    total_pipeline = sum(v["total"] for v in by_stage.values())
    hot_total = 0
    for lead in leads:
        if lead.is_hot_prospect and lead.pipeline_stage == PipelineStage.PROSPECT.value:
            hot_total += fx_map.get(lead.id, 0) + tf_map.get(lead.id, 0)

    return {
        "by_stage": by_stage,
        "total_pipeline": total_pipeline,
        "hot_prospects_total": hot_total,
        "is_personal": is_personal,
    }


# â”€â”€â”€ Dashboard Period Preference â”€â”€â”€

@router.get("/my-period")
async def get_my_period(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"period": getattr(current_user, 'dashboard_period_pref', 'month') or 'month'}


@router.put("/my-period")
async def save_my_period(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    period = data.get("period", "month")
    if period not in ("today", "week", "month"):
        raise HTTPException(status_code=400, detail="Ongeldige periode")
    user = db.query(User).filter(User.id == current_user.id).first()
    user.dashboard_period_pref = period
    db.commit()
    return {"period": period}


# â”€â”€â”€ Leaderboard â”€â”€â”€

@router.get("/leaderboard")
async def get_leaderboard(
    period: str = "month",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sales leaderboard â€” visible to all sales users for competitive comparison."""
    from datetime import date
    from app.models.notification import ActivityLog
    from app.models.communication import CallLog
    from app.models.user import ScoringConfig

    now = datetime.now(timezone.utc)
    start = _get_period_start(period, now)

    cfg = db.query(ScoringConfig).filter(ScoringConfig.id == 1).first()
    call_pts = cfg.call_points if cfg else 2
    lead_pts = cfg.lead_points if cfg else 1
    prospect_pts = cfg.prospect_points if cfg else 10
    onboarding_pts = cfg.onboarding_points if cfg else 50
    client_pts = cfg.client_points if cfg else 100

    sales_users = db.query(User).filter(
        User.role.in_(["sales", "extern"]),
        User.status == "active",
        User.show_on_sales_dashboard == True,
    ).all()

    results = []
    for u in sales_users:
        calls = db.query(func.count(CallLog.id)).filter(
            CallLog.user_id == u.id,
            CallLog.created_at >= start,
        ).scalar() or 0

        new_leads = db.query(func.count(Lead.id)).filter(
            Lead.assigned_user_id == u.id,
            Lead.created_at >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

        # Prospects: gefilterd op prospect_since (wanneer lead echt prospect werd in periode)
        prospects = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == u.id, Lead.sales_owner_id == u.id),
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            Lead.prospect_since >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

        # Onboarding: gefilterd op onboarding_started_at
        onboarding = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == u.id, Lead.sales_owner_id == u.id),
            Lead.pipeline_stage.in_([PipelineStage.ONBOARDING_SALES.value, PipelineStage.ONBOARDING_BACKOFFICE.value]),
            Lead.onboarding_started_at >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

        # Clients: gefilterd op client_since_date (alleen nieuwe klanten in periode)
        clients = db.query(func.count(Lead.id)).filter(
            or_(Lead.assigned_user_id == u.id, Lead.sales_owner_id == u.id),
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
            Lead.client_since_date >= start,
            Lead.is_deleted == False,
        ).scalar() or 0

        hot_leads = db.query(Lead).filter(
            Lead.is_hot_prospect == True,
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            or_(Lead.assigned_user_id == u.id, Lead.sales_owner_id == u.id),
            Lead.is_deleted == False,
        ).all()
        # Pipeline revenue = sum of the "+" product lines for these hot prospects
        _hot_pl_map = product_lines_revenue_bulk(db, [l.id for l in hot_leads])
        pipeline_revenue = sum(_hot_pl_map.get(l.id, 0) for l in hot_leads)

        score = (calls * call_pts) + (new_leads * lead_pts) + (prospects * prospect_pts) + (onboarding * onboarding_pts) + (clients * client_pts)

        results.append({
            "user_id": u.id,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "calls": calls,
            "new_leads": new_leads,
            "prospects": prospects,
            "onboarding": onboarding,
            "clients": clients,
            "pipeline_revenue": pipeline_revenue,
            "score": score,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    current_user_rank = next((r["rank"] for r in results if r["user_id"] == current_user.id), None)

    return {
        "leaderboard": results,
        "period": period,
        "current_user_rank": current_user_rank,
    }
