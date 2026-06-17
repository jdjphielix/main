"""Users router: admin management (add, roles, teamleader, deactivate, reassign)."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import or_
from typing import Optional, List
import os
import shutil

from app.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User, UserRole, UserStatus, ScoringConfig
from app.models.lead import Lead, PipelineStage, ClientForecasting
from app.models.communication import CallLog

router = APIRouter()

AVATAR_DIR = "app/static/avatars"


@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Get current user's profile."""
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_teamleader": current_user.is_teamleader,
        "is_superuser": getattr(current_user, 'is_superuser', False) or False,
        "dashboard_period_pref": getattr(current_user, 'dashboard_period_pref', 'month') or 'month',
        "is_active": current_user.status == "active",
        "avatar_url": current_user.avatar_url,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/me")
async def update_my_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's own profile (name, phone only)."""
    allowed = ["full_name", "phone"]
    for field in allowed:
        if field in data:
            setattr(current_user, field, data[field])
    db.commit()

    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_teamleader": current_user.is_teamleader,
        "is_active": current_user.status == "active",
        "avatar_url": current_user.avatar_url,
    }


@router.post("/me/avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload profile avatar (JPG/PNG, max 5 MB)."""
    # Validate content type
    if avatar.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(status_code=400, detail="Alleen JPG of PNG bestanden zijn toegestaan")

    # Read and check size (5 MB limit)
    contents = await avatar.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Bestand is te groot (max 5 MB)")

    # Ensure avatars directory exists
    os.makedirs(AVATAR_DIR, exist_ok=True)

    # Save as user_id.jpg regardless of original format
    file_path = os.path.join(AVATAR_DIR, f"{current_user.id}.jpg")
    with open(file_path, "wb") as f:
        f.write(contents)

    # Store URL in DB
    avatar_url = f"/static/avatars/{current_user.id}.jpg"
    current_user.avatar_url = avatar_url
    db.commit()

    return {"avatar_url": avatar_url}


@router.get("/team")
async def list_team_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List active team members (for dropdowns). Extern users only see minimal data."""
    query = db.query(User).filter(User.status == "active").order_by(User.full_name.asc())
    # Extern users should not see the full user list — only what's needed for contact dropdowns
    if current_user.role == 'extern':
        query = query.filter(User.id == current_user.id)
    users = query.all()
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role}
        for u in users
    ]


@router.get("/")
async def list_users(
    status: Optional[str] = None,
    role: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users (admin only)."""
    query = db.query(User)

    if status:
        query = query.filter(User.status == status)
    if role:
        query = query.filter(User.role == role)

    users = query.order_by(User.full_name.asc()).all()

    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "status": u.status,
                "is_teamleader": u.is_teamleader,
                "show_on_sales_dashboard": u.show_on_sales_dashboard or False,
                "team_leader_id": u.team_leader_id,
                "created_at": u.created_at,
                "last_login": u.last_login,
            }
            for u in users
        ],
        "total": len(users),
    }


@router.post("/")
async def create_user(
    user_data: dict,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Add new user by email (admin only).
    Payload: {
        "email": str,
        "full_name": str,
        "role": str (optional, default "sales"),
    }
    Note: User must complete OAuth login to fully onboard.
    """
    email = user_data.get("email")
    full_name = user_data.get("full_name")

    # Check if user exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        email=email,
        full_name=full_name,
        role=user_data.get("role", UserRole.SALES.value),
        status=UserStatus.ACTIVE.value,
    )
    db.add(user)
    db.commit()

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "status": user.status,
        "message": "User created. They must complete Google OAuth login to activate.",
    }


@router.put("/{user_id}/role")
async def change_user_role(
    user_id: int,
    role_data: dict,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Change user role (admin only).
    Payload: {"role": "admin_pay|admin_trade|teamleader|sales|backoffice|finance"}
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = role_data.get("role")
    if new_role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail="Invalid role")

    user.role = new_role
    # Automatically sync is_teamleader flag with the teamleader role
    if new_role == UserRole.TEAMLEADER.value:
        user.is_teamleader = True
    elif user.is_teamleader and new_role != UserRole.TEAMLEADER.value:
        # Demoting from teamleader role also removes the flag
        user.is_teamleader = False
    db.commit()

    return {
        "user_id": user.id,
        "new_role": new_role,
        "is_teamleader": user.is_teamleader,
        "status": "updated",
    }


@router.put("/{user_id}/teamleader")
async def toggle_teamleader(
    user_id: int,
    is_teamleader_data: dict,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Toggle teamleader flag for user (admin only).
    Payload: {"is_teamleader": bool}
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_teamleader = is_teamleader_data.get("is_teamleader", False)
    db.commit()

    return {
        "user_id": user.id,
        "is_teamleader": user.is_teamleader,
        "status": "updated",
    }


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: int,
    reassign_to_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deactivate user. If reassign_to_id is provided, bulk-reassign all their leads/clients."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    reassigned_count = 0
    if reassign_to_id:
        new_owner = db.query(User).filter(User.id == reassign_to_id, User.status == "active").first()
        if not new_owner:
            raise HTTPException(status_code=404, detail="Reassign target user not found or inactive")

        from app.models.lead import Lead
        # Reassign all leads where this user is assigned, sales_owner, or dealer
        leads_to_update = db.query(Lead).filter(
            Lead.is_deleted == False,
            or_(
                Lead.sales_owner_id == user_id,
                Lead.assigned_user_id == user_id,
                Lead.dealer_id == user_id,
            )
        ).all()

        for lead in leads_to_update:
            if lead.sales_owner_id == user_id:
                lead.sales_owner_id = reassign_to_id
            if lead.assigned_user_id == user_id:
                lead.assigned_user_id = reassign_to_id
            if lead.dealer_id == user_id:
                lead.dealer_id = reassign_to_id
            # Unlock if locked by departing user
            if lead.is_locked and lead.locked_by_user_id == user_id:
                lead.is_locked = False
                lead.locked_by_user_id = None

        reassigned_count = len(leads_to_update)

    user.status = UserStatus.INACTIVE.value
    db.commit()

    return {
        "user_id": user.id,
        "status": "deactivated",
        "leads_reassigned": reassigned_count,
    }


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Reactivate a deactivated user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    db.commit()
    return {"user_id": user.id, "status": "activated"}


@router.post("/{user_id}/reassign")
async def reassign_leads(
    user_id: int,
    reassign_data: dict,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reassign all leads from one user to another (admin only).
    Payload: {"new_assigned_user_id": int}
    """
    from_user = db.query(User).filter(User.id == user_id).first()
    if not from_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_user_id = reassign_data.get("new_assigned_user_id")
    to_user = db.query(User).filter(User.id == new_user_id).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Update all leads assigned to from_user
    count = db.query(Lead).filter(
        Lead.assigned_user_id == user_id,
        Lead.is_deleted == False,
    ).update({Lead.assigned_user_id: new_user_id}, synchronize_session=False)

    db.commit()

    return {
        "from_user_id": user_id,
        "to_user_id": new_user_id,
        "leads_reassigned": count,
        "status": "completed",
    }


@router.get("/sales-dashboard")
async def get_sales_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get aggregated stats for all users on the sales dashboard.
    Restricted to sales/backoffice/teamleader/admin — not extern or finance.
    """
    if current_user.role in ('extern', 'backoffice', 'finance') and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Geen toegang tot sales dashboard")
    from app.models.lead import Lead, PipelineStage, ClientForecasting, ProspectData
    from app.models.communication import CallLog

    # ── 1. Fetch dashboard users (one query) ──────────────────────────────────
    dashboard_users = db.query(User).filter(
        User.show_on_sales_dashboard == True,
        User.status == "active",
    ).order_by(User.full_name).all()

    if not dashboard_users:
        return {"users": [], "total": 0, "weights": {
            "call_points": 2, "lead_points": 1, "prospect_points": 10,
            "onboarding_points": 50, "client_points": 100,
        }}

    user_ids = [u.id for u in dashboard_users]

    # ── 2. Lead counts per stage per user (two bulk queries) ──────────────────
    # Ownership = sales_owner_id OR locked_by_user_id
    stage_rows = (
        db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.pipeline_stage,
            func.count(Lead.id).label("cnt"),
        )
        .filter(
            Lead.is_deleted == False,
            or_(
                Lead.sales_owner_id.in_(user_ids),
                Lead.locked_by_user_id.in_(user_ids),
            ),
        )
        .group_by(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id),
            Lead.pipeline_stage,
        )
        .all()
    )

    # Index: {user_id: {stage: count}}
    stage_counts: dict = {uid: {} for uid in user_ids}
    for uid, stage, cnt in stage_rows:
        if uid in stage_counts:
            stage_counts[uid][stage] = stage_counts[uid].get(stage, 0) + cnt

    # ── 3. Call stats per user (one bulk query) ────────────────────────────────
    call_rows = (
        db.query(
            CallLog.user_id,
            func.count(CallLog.id).label("call_count"),
            func.coalesce(func.sum(CallLog.duration_seconds), 0).label("call_duration"),
        )
        .filter(CallLog.user_id.in_(user_ids))
        .group_by(CallLog.user_id)
        .all()
    )
    call_stats: dict = {uid: (0, 0) for uid in user_ids}
    for uid, cnt, dur in call_rows:
        call_stats[uid] = (int(cnt), int(dur))

    # ── 4. Revenue per user (bulk ProspectData + ClientForecasting) ───────────
    # Prospect revenue (pipeline stage only)
    prospect_owner_map = (
        db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        )
        .filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            or_(Lead.sales_owner_id.in_(user_ids), Lead.locked_by_user_id.in_(user_ids)),
        )
        .all()
    )
    prospect_lead_to_uid = {r.lead_id: r.uid for r in prospect_owner_map if r.uid in user_ids}

    # Onboarding revenue
    onboard_owner_map = (
        db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        )
        .filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage.in_(["onboarding_sales", "onboarding_backoffice"]),
            or_(Lead.sales_owner_id.in_(user_ids), Lead.locked_by_user_id.in_(user_ids)),
        )
        .all()
    )
    onboard_lead_to_uid = {r.lead_id: r.uid for r in onboard_owner_map if r.uid in user_ids}

    # Bulk ProspectData for prospect + onboarding leads
    all_pd_lead_ids = list(set(list(prospect_lead_to_uid.keys()) + list(onboard_lead_to_uid.keys())))
    pipeline_rev: dict = {uid: 0.0 for uid in user_ids}
    onboarding_rev: dict = {uid: 0.0 for uid in user_ids}
    if all_pd_lead_ids:
        pd_rows = db.query(ProspectData).filter(ProspectData.lead_id.in_(all_pd_lead_ids)).all()
        for pd in pd_rows:
            rev = (pd.fx_estimated_revenue or 0) + (pd.tf_estimated_revenue or 0)
            if pd.lead_id in prospect_lead_to_uid:
                uid = prospect_lead_to_uid[pd.lead_id]
                pipeline_rev[uid] = pipeline_rev.get(uid, 0) + rev
            if pd.lead_id in onboard_lead_to_uid:
                uid = onboard_lead_to_uid[pd.lead_id]
                onboarding_rev[uid] = onboarding_rev.get(uid, 0) + rev

    # Client revenue via ClientForecasting
    client_owner_map = (
        db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        )
        .filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
            or_(Lead.sales_owner_id.in_(user_ids), Lead.locked_by_user_id.in_(user_ids)),
        )
        .all()
    )
    client_lead_to_uid = {r.lead_id: r.uid for r in client_owner_map if r.uid in user_ids}
    client_rev: dict = {uid: 0.0 for uid in user_ids}
    if client_lead_to_uid:
        fc_rows = db.query(ClientForecasting).filter(
            ClientForecasting.lead_id.in_(list(client_lead_to_uid.keys()))
        ).all()
        for item in fc_rows:
            uid = client_lead_to_uid.get(item.lead_id)
            if uid is None:
                continue
            vol = item.volume_per_year or 0
            hedge_pct = item.hedging_pct or 0
            spot_m = item.spot_margin_pct or 0
            hedge_m = item.hedging_margin_pct or 0
            if spot_m == 0 and hedge_pct == 0 and (item.margin_per_year or 0) > 0:
                client_rev[uid] = client_rev.get(uid, 0) + (item.margin_per_year or 0)
            else:
                client_rev[uid] = client_rev.get(uid, 0) + vol * (1 - hedge_pct) * spot_m + vol * hedge_pct * hedge_m


    # Bulk: hot prospect counts per sales owner
    hot_rows = (
        db.query(
            Lead.sales_owner_id,
            func.count(Lead.id).label("cnt"),
        )
        .filter(
            Lead.is_hot_prospect == True,
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            Lead.sales_owner_id.in_(user_ids),
        )
        .group_by(Lead.sales_owner_id)
        .all()
    )
    hot_counts: dict = {r.sales_owner_id: r.cnt for r in hot_rows}

        # ── 5. Assemble results ───────────────────────────────────────────────────
    results = []
    for u in dashboard_users:
        sc = stage_counts.get(u.id, {})
        calls, dur = call_stats.get(u.id, (0, 0))
        results.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "leads_count": sc.get(PipelineStage.LEAD.value, 0),
            "prospects_count": sc.get(PipelineStage.PROSPECT.value, 0),
            "onboarding_count": sc.get("onboarding_sales", 0) + sc.get("onboarding_backoffice", 0),
            "clients_count": sc.get(PipelineStage.CLIENT.value, 0),
            "hot_prospects_count": hot_counts.get(u.id, 0),
            "call_count": calls,
            "total_call_duration_seconds": dur,
            "pipeline_revenue": round(pipeline_rev.get(u.id, 0), 2),
            "onboarding_revenue": round(onboarding_rev.get(u.id, 0), 2),
            "client_revenue": round(client_rev.get(u.id, 0), 2),
        })

    # Get scoring weights and calculate scores
    # Guard against: missing row, row with NULL values, table not yet created
    _W_DEFAULTS = dict(call_points=2, lead_points=1, prospect_points=10, onboarding_points=50, client_points=100)
    try:
        weights = db.query(ScoringConfig).filter(ScoringConfig.id == 1).first()
    except Exception:
        weights = None

    # Row might exist but have NULL column values (legacy data) — fill in defaults
    if weights:
        for k, v in _W_DEFAULTS.items():
            if getattr(weights, k, None) is None:
                setattr(weights, k, v)
    else:
        # No row yet — create one with safe defaults
        try:
            weights = ScoringConfig(id=1, **_W_DEFAULTS)
            db.add(weights)
            db.commit()
        except Exception:
            db.rollback()
            weights = ScoringConfig(id=1, **_W_DEFAULTS)

    # Safe accessors with int() cast to prevent None * int TypeError
    w_call = int(weights.call_points or 2)
    w_lead = int(weights.lead_points or 1)
    w_prospect = int(weights.prospect_points or 10)
    w_onboard = int(weights.onboarding_points or 50)
    w_client = int(weights.client_points or 100)

    for r in results:
        r["score"] = (
            r["call_count"] * w_call +
            r["leads_count"] * w_lead +
            r["prospects_count"] * w_prospect +
            r["onboarding_count"] * w_onboard +
            r["clients_count"] * w_client
        )

    # Sort by score descending, add rank
    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return {
        "users": results,
        "total": len(results),
        "weights": {
            "call_points": weights.call_points,
            "lead_points": weights.lead_points,
            "prospect_points": weights.prospect_points,
            "onboarding_points": weights.onboarding_points,
            "client_points": weights.client_points,
        }
    }


@router.put("/{user_id}/sales-dashboard")
async def toggle_sales_dashboard(
    user_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Toggle show_on_sales_dashboard for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.show_on_sales_dashboard = data.get("show_on_sales_dashboard", False)
    db.commit()
    return {"id": user.id, "show_on_sales_dashboard": user.show_on_sales_dashboard}


@router.get("/scoring-weights")
async def get_scoring_weights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current scoring point weights."""
    if current_user.role not in ('admin_pay', 'admin_trade') and not current_user.is_teamleader:
        raise HTTPException(status_code=403, detail="Geen toegang tot scoring configuratie")
    try:
        weights = db.query(ScoringConfig).filter(ScoringConfig.id == 1).first()
    except Exception:
        weights = None
    if not weights:
        try:
            weights = ScoringConfig(
                id=1, call_points=2, lead_points=1,
                prospect_points=10, onboarding_points=50, client_points=100,
            )
            db.add(weights)
            db.commit()
        except Exception:
            db.rollback()
            return {"call_points": 2, "lead_points": 1, "prospect_points": 10, "onboarding_points": 50, "client_points": 100}
    return {
        "call_points": weights.call_points or 2,
        "lead_points": weights.lead_points or 1,
        "prospect_points": weights.prospect_points or 10,
        "onboarding_points": weights.onboarding_points or 50,
        "client_points": weights.client_points or 100,
    }


@router.put("/{user_id}/assign-teamleader")
async def assign_teamleader(
    user_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Assign a user to a teamleader (admin only).
    Payload: {"team_leader_id": int | null}
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    tl_id = data.get("team_leader_id")
    if tl_id is not None:
        tl = db.query(User).filter(User.id == tl_id).first()
        if not tl:
            raise HTTPException(status_code=404, detail="Teamleader not found")

    user.team_leader_id = tl_id
    db.commit()
    return {"user_id": user.id, "team_leader_id": user.team_leader_id, "status": "updated"}


@router.get("/my-team")
async def get_my_team(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get cumulative + per-user stats for the calling teamleader's team.
    Also accessible by admins.
    """
    from app.models.lead import Lead, PipelineStage, ClientForecasting, ProspectData
    from app.models.communication import CallLog

    is_allowed = current_user.is_teamleader or current_user.role in ["admin_pay", "admin_trade"]
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Alleen teamleaders en admins mogen dit zien")

    team_members = db.query(User).filter(
        User.team_leader_id == current_user.id,
        User.status == "active",
    ).order_by(User.full_name).all()

    if not team_members:
        return {
            "team_leader": {"id": current_user.id, "full_name": current_user.full_name},
            "members": [],
            "cumulative": {
                "leads_count": 0, "prospects_count": 0, "onboarding_count": 0,
                "clients_count": 0, "call_count": 0,
                "pipeline_revenue": 0, "onboarding_revenue": 0, "client_revenue": 0,
            },
            "total_members": 0,
        }

    member_ids = [u.id for u in team_members]

    # Bulk stage counts per user
    stage_rows = (
        db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.pipeline_stage,
            func.count(Lead.id).label("cnt"),
        )
        .filter(
            Lead.is_deleted == False,
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        )
        .group_by(func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id), Lead.pipeline_stage)
        .all()
    )
    stage_counts: dict = {uid: {} for uid in member_ids}
    for uid, stage, cnt in stage_rows:
        if uid in stage_counts:
            stage_counts[uid][stage] = stage_counts[uid].get(stage, 0) + cnt

    # Bulk call counts
    call_rows = (
        db.query(CallLog.user_id, func.count(CallLog.id).label("cnt"))
        .filter(CallLog.user_id.in_(member_ids))
        .group_by(CallLog.user_id)
        .all()
    )
    call_cnt: dict = {uid: 0 for uid in member_ids}
    for uid, cnt in call_rows:
        call_cnt[uid] = int(cnt)

    # Bulk revenue — prospect stage
    p_map = {
        r.lead_id: r.uid for r in db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        ).filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        ).all() if r.uid in member_ids
    }
    # Onboarding stage
    o_map = {
        r.lead_id: r.uid for r in db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        ).filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage.in_(["onboarding_sales", "onboarding_backoffice"]),
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        ).all() if r.uid in member_ids
    }
    # Client stage
    c_map = {
        r.lead_id: r.uid for r in db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        ).filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        ).all() if r.uid in member_ids
    }

    pipeline_rev: dict = {uid: 0.0 for uid in member_ids}
    onboarding_rev: dict = {uid: 0.0 for uid in member_ids}
    all_pd_ids = list(set(list(p_map.keys()) + list(o_map.keys())))
    if all_pd_ids:
        for pd in db.query(ProspectData).filter(ProspectData.lead_id.in_(all_pd_ids)).all():
            rev = (pd.fx_estimated_revenue or 0) + (pd.tf_estimated_revenue or 0)
            if pd.lead_id in p_map:
                pipeline_rev[p_map[pd.lead_id]] = pipeline_rev.get(p_map[pd.lead_id], 0) + rev
            if pd.lead_id in o_map:
                onboarding_rev[o_map[pd.lead_id]] = onboarding_rev.get(o_map[pd.lead_id], 0) + rev

    client_rev: dict = {uid: 0.0 for uid in member_ids}
    if c_map:
        for item in db.query(ClientForecasting).filter(ClientForecasting.lead_id.in_(list(c_map.keys()))).all():
            uid = c_map.get(item.lead_id)
            if uid is None:
                continue
            vol = item.volume_per_year or 0
            hedge_pct = item.hedging_pct or 0
            spot_m = item.spot_margin_pct or 0
            hedge_m = item.hedging_margin_pct or 0
            if spot_m == 0 and hedge_pct == 0 and (item.margin_per_year or 0) > 0:
                client_rev[uid] = client_rev.get(uid, 0) + (item.margin_per_year or 0)
            else:
                client_rev[uid] = client_rev.get(uid, 0) + vol * (1 - hedge_pct) * spot_m + vol * hedge_pct * hedge_m

    # Assemble
    members_data = []
    for u in team_members:
        sc = stage_counts.get(u.id, {})
        members_data.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "leads_count": sc.get(PipelineStage.LEAD.value, 0),
            "prospects_count": sc.get(PipelineStage.PROSPECT.value, 0),
            "onboarding_count": sc.get("onboarding_sales", 0) + sc.get("onboarding_backoffice", 0),
            "clients_count": sc.get(PipelineStage.CLIENT.value, 0),
            "call_count": call_cnt.get(u.id, 0),
            "pipeline_revenue": round(pipeline_rev.get(u.id, 0), 2),
            "onboarding_revenue": round(onboarding_rev.get(u.id, 0), 2),
            "client_revenue": round(client_rev.get(u.id, 0), 2),
        })

    # Cumulative totals
    cumulative = {
        "leads_count": sum(m["leads_count"] for m in members_data),
        "prospects_count": sum(m["prospects_count"] for m in members_data),
        "onboarding_count": sum(m["onboarding_count"] for m in members_data),
        "clients_count": sum(m["clients_count"] for m in members_data),
        "call_count": sum(m["call_count"] for m in members_data),
        "pipeline_revenue": sum(m["pipeline_revenue"] for m in members_data),
        "onboarding_revenue": sum(m["onboarding_revenue"] for m in members_data),
        "client_revenue": sum(m["client_revenue"] for m in members_data),
    }

    return {
        "team_leader": {"id": current_user.id, "full_name": current_user.full_name},
        "members": members_data,
        "cumulative": cumulative,
        "total_members": len(members_data),
    }


@router.get("/team-revenue-forecast")
async def get_team_revenue_forecast(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revenue forecast per salesperson in the teamleader's team.
    Returns prospect_revenue, onboarding_revenue, client_revenue and totals.
    Accessible by teamleaders and admins.
    """
    from app.models.lead import Lead, PipelineStage, ClientForecasting, ProspectData

    is_allowed = current_user.is_teamleader or current_user.role in ["admin_pay", "admin_trade"]
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Alleen teamleaders en admins mogen dit zien")

    team_members = db.query(User).filter(
        User.team_leader_id == current_user.id,
        User.status == "active",
    ).order_by(User.full_name).all()

    if not team_members:
        return {
            "members": [],
            "totals": {
                "prospect_revenue": 0.0,
                "onboarding_revenue": 0.0,
                "client_revenue": 0.0,
                "total_revenue": 0.0,
            },
        }

    member_ids = [u.id for u in team_members]

    # Bulk stage counts per user
    stage_rows = (
        db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.pipeline_stage,
            func.count(Lead.id).label("cnt"),
        )
        .filter(
            Lead.is_deleted == False,
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        )
        .group_by(func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id), Lead.pipeline_stage)
        .all()
    )
    stage_counts_fc: dict = {uid: {} for uid in member_ids}
    for uid, stage, cnt in stage_rows:
        if uid in stage_counts_fc:
            stage_counts_fc[uid][stage] = stage_counts_fc[uid].get(stage, 0) + cnt

    # Prospect stage lead->owner map
    p_map = {
        r.lead_id: r.uid for r in db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        ).filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.PROSPECT.value,
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        ).all() if r.uid in member_ids
    }
    # Onboarding stage
    o_map = {
        r.lead_id: r.uid for r in db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        ).filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage.in_(["onboarding_sales", "onboarding_backoffice"]),
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        ).all() if r.uid in member_ids
    }
    # Client stage
    c_map = {
        r.lead_id: r.uid for r in db.query(
            func.coalesce(Lead.sales_owner_id, Lead.locked_by_user_id).label("uid"),
            Lead.id.label("lead_id"),
        ).filter(
            Lead.is_deleted == False,
            Lead.pipeline_stage == PipelineStage.CLIENT.value,
            or_(Lead.sales_owner_id.in_(member_ids), Lead.locked_by_user_id.in_(member_ids)),
        ).all() if r.uid in member_ids
    }

    prospect_rev: dict = {uid: 0.0 for uid in member_ids}
    onboarding_rev_fc: dict = {uid: 0.0 for uid in member_ids}
    all_pd_ids = list(set(list(p_map.keys()) + list(o_map.keys())))
    if all_pd_ids:
        for pd in db.query(ProspectData).filter(ProspectData.lead_id.in_(all_pd_ids)).all():
            rev = (pd.fx_estimated_revenue or 0) + (pd.tf_estimated_revenue or 0)
            if pd.lead_id in p_map:
                prospect_rev[p_map[pd.lead_id]] = prospect_rev.get(p_map[pd.lead_id], 0) + rev
            if pd.lead_id in o_map:
                onboarding_rev_fc[o_map[pd.lead_id]] = onboarding_rev_fc.get(o_map[pd.lead_id], 0) + rev

    client_rev_fc: dict = {uid: 0.0 for uid in member_ids}
    if c_map:
        for item in db.query(ClientForecasting).filter(ClientForecasting.lead_id.in_(list(c_map.keys()))).all():
            uid = c_map.get(item.lead_id)
            if uid is None:
                continue
            vol = item.volume_per_year or 0
            hedge_pct = item.hedging_pct or 0
            spot_m = item.spot_margin_pct or 0
            hedge_m = item.hedging_margin_pct or 0
            if spot_m == 0 and hedge_pct == 0 and (item.margin_per_year or 0) > 0:
                client_rev_fc[uid] = client_rev_fc.get(uid, 0) + (item.margin_per_year or 0)
            else:
                client_rev_fc[uid] = client_rev_fc.get(uid, 0) + vol * (1 - hedge_pct) * spot_m + vol * hedge_pct * hedge_m

    members_data_fc = []
    for u in team_members:
        sc = stage_counts_fc.get(u.id, {})
        p_rev = round(prospect_rev.get(u.id, 0), 2)
        o_rev = round(onboarding_rev_fc.get(u.id, 0), 2)
        c_rev = round(client_rev_fc.get(u.id, 0), 2)
        members_data_fc.append({
            "user_id": u.id,
            "full_name": u.full_name,
            "role": u.role,
            "leads_count": sc.get(PipelineStage.LEAD.value, 0),
            "prospects_count": sc.get(PipelineStage.PROSPECT.value, 0),
            "onboarding_count": sc.get("onboarding_sales", 0) + sc.get("onboarding_backoffice", 0),
            "clients_count": sc.get(PipelineStage.CLIENT.value, 0),
            "prospect_revenue": p_rev,
            "onboarding_revenue": o_rev,
            "client_revenue": c_rev,
            "total_revenue": round(p_rev + o_rev + c_rev, 2),
        })

    totals_fc = {
        "prospect_revenue": round(sum(m["prospect_revenue"] for m in members_data_fc), 2),
        "onboarding_revenue": round(sum(m["onboarding_revenue"] for m in members_data_fc), 2),
        "client_revenue": round(sum(m["client_revenue"] for m in members_data_fc), 2),
        "total_revenue": round(sum(m["total_revenue"] for m in members_data_fc), 2),
    }

    return {"members": members_data_fc, "totals": totals_fc}


@router.put("/scoring-weights")
async def update_scoring_weights(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update scoring point weights (teamleader/admin only)."""
    is_allowed = current_user.is_teamleader or current_user.role in ["admin_pay", "admin_trade"]
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Alleen teamleaders en admins mogen dit aanpassen")
    weights = db.query(ScoringConfig).filter(ScoringConfig.id == 1).first()
    if not weights:
        weights = ScoringConfig(
            id=1, call_points=2, lead_points=1,
            prospect_points=10, onboarding_points=50, client_points=100,
        )
        db.add(weights)
    for key in ["call_points", "lead_points", "prospect_points", "onboarding_points", "client_points"]:
        if key in data and isinstance(data[key], int):
            setattr(weights, key, data[key])
    db.commit()
    return {
        "call_points": weights.call_points,
        "lead_points": weights.lead_points,
        "prospect_points": weights.prospect_points,
        "onboarding_points": weights.onboarding_points,
        "client_points": weights.client_points,
    }
