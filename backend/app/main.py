# MIGRATIES: Gebruik Alembic voor nieuwe schema-wijzigingen:
#   docker exec -w /app -e DOCKER_ENV=1 taperpay_backend alembic revision --autogenerate -m beschrijving
#   docker exec -w /app -e DOCKER_ENV=1 taperpay_backend alembic upgrade head
# De bestaande inline ALTER TABLE migraties in deze file blijven als backward-compat fallback.
"""TaperPay Backoffice - Main FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import asyncio
import logging

from app.config import settings
from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.routers import auth, leads, prospects, callbacks, documents, chat, notifications, users, dashboard, ai_services, admin, conversations, compliance, limit_orders
from app.routers.tickets import router as tickets_router
from app.routers.team_onboarding import router as team_onboarding_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    # Add new columns to existing tables — each statement in its own transaction
    # so one failure never blocks the rest.
    _migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS sales_owner_id INTEGER REFERENCES users(id)",
        "CREATE INDEX IF NOT EXISTS ix_leads_sales_owner_id ON leads(sales_owner_id)",
        "UPDATE leads SET sales_owner_id = locked_by_user_id WHERE sales_owner_id IS NULL AND locked_by_user_id IS NOT NULL",
        "ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS broker VARCHAR(50)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'pending'",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS risk_profile VARCHAR(20)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS ubo_name VARCHAR(255)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS ubo_nationality VARCHAR(100)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS legal_entity_type VARCHAR(100)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS kyc_notes TEXT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS aml_cleared BOOLEAN DEFAULT FALSE",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS fx_spot_spread_pct FLOAT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS fx_forward_margin_pct FLOAT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS credit_limit_eur FLOAT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS min_deal_size_eur FLOAT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS tf_interest_rate_pct FLOAT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS tf_fee_pct FLOAT",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS pricing_notes TEXT",
        """CREATE TABLE IF NOT EXISTS contact_methods (
            id SERIAL PRIMARY KEY,
            lead_id INTEGER NOT NULL REFERENCES leads(id),
            type VARCHAR(20) NOT NULL,
            value VARCHAR(255) NOT NULL,
            label VARCHAR(50),
            is_primary BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_contact_methods_lead_id ON contact_methods(lead_id)",
        """CREATE TABLE IF NOT EXISTS conversation_logs (
            id SERIAL PRIMARY KEY,
            lead_id INTEGER NOT NULL REFERENCES leads(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            type VARCHAR(20) NOT NULL,
            direction VARCHAR(10) DEFAULT 'outbound',
            contact_value VARCHAR(255),
            duration_seconds INTEGER,
            outcome VARCHAR(50),
            summary TEXT,
            ai_summary TEXT,
            transcript_text TEXT,
            transcript_filename VARCHAR(500),
            whatsapp_raw TEXT,
            occurred_at TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_conversation_logs_lead_id ON conversation_logs(lead_id)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revision_status VARCHAR(50)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revision_note TEXT",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revision_date TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revision_by_id INTEGER REFERENCES users(id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS show_on_sales_dashboard BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS team_leader_id INTEGER REFERENCES users(id)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS dealer_id INTEGER REFERENCES users(id)",
        """CREATE TABLE IF NOT EXISTS scoring_config (
            id INTEGER PRIMARY KEY,
            call_points INTEGER DEFAULT 2,
            lead_points INTEGER DEFAULT 1,
            prospect_points INTEGER DEFAULT 10,
            onboarding_points INTEGER DEFAULT 50,
            client_points INTEGER DEFAULT 100
        )""",
        # Insert with explicit values; on conflict update only if columns are NULL
        # (fixes rows created by old migration that stored NULL for all point columns)
        """INSERT INTO scoring_config (id, call_points, lead_points, prospect_points, onboarding_points, client_points)
           VALUES (1, 2, 1, 10, 50, 100)
           ON CONFLICT (id) DO UPDATE SET
               call_points = COALESCE(scoring_config.call_points, EXCLUDED.call_points),
               lead_points = COALESCE(scoring_config.lead_points, EXCLUDED.lead_points),
               prospect_points = COALESCE(scoring_config.prospect_points, EXCLUDED.prospect_points),
               onboarding_points = COALESCE(scoring_config.onboarding_points, EXCLUDED.onboarding_points),
               client_points = COALESCE(scoring_config.client_points, EXCLUDED.client_points)""",
        # Sync is_teamleader flag for users who already have the teamleader role
        "UPDATE users SET is_teamleader = TRUE WHERE role = 'teamleader' AND (is_teamleader IS NULL OR is_teamleader = FALSE)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS tf_closing_fee_pct FLOAT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_potential JSON",
        "ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE",
        "ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS gmail_thread_id VARCHAR(255)",
        "CREATE INDEX IF NOT EXISTS ix_compliance_cases_thread_id ON compliance_cases(gmail_thread_id)",
        "ALTER TABLE email_syncs ADD COLUMN IF NOT EXISTS compliance_case_id INTEGER REFERENCES compliance_cases(id)",
        # Partner referral
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS partner_name VARCHAR(255)",
        "CREATE INDEX IF NOT EXISTS ix_leads_partner_name ON leads(partner_name)",
        # Callback Google Calendar & invited colleagues
        "ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS invited_user_ids JSON",
        "ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255)",
        "ALTER TABLE callbacks ADD COLUMN IF NOT EXISTS add_to_calendar BOOLEAN DEFAULT FALSE",
        """CREATE TABLE IF NOT EXISTS contact_family_members (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    contact_name VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    relation VARCHAR(100),
    birth_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
)""",
        "CREATE INDEX IF NOT EXISTS ix_contact_family_members_lead_id ON contact_family_members(lead_id)",
        """CREATE TABLE IF NOT EXISTS limit_orders (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    currency_pair VARCHAR(20) NOT NULL,
    rate FLOAT NOT NULL,
    volume FLOAT,
    direction VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_at TIMESTAMPTZ
)""",
        "CREATE INDEX IF NOT EXISTS ix_limit_orders_lead_id ON limit_orders(lead_id)",
        "CREATE INDEX IF NOT EXISTS ix_limit_orders_status ON limit_orders(status)",
        # === CRM audit fixes — ontbrekende velden ===
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_iban VARCHAR(50)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_street VARCHAR(255)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_city VARCHAR(100)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_postcode VARCHAR(20)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS communication_preference VARCHAR(20)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_contacted_at TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS prospect_since TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS backoffice_started_at TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_since_date TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS churn_reason VARCHAR(200)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS churn_date TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS churn_to_competitor VARCHAR(255)",
        # Document valid_until + soft-delete for notes
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_until DATE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by_id INTEGER REFERENCES users(id)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_by_id INTEGER REFERENCES users(id)",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
        # ProspectData compliance + broker velden
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS contract_signed_date TIMESTAMPTZ",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS cdd_next_review_date DATE",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS pep_cleared BOOLEAN DEFAULT FALSE",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS sanctions_cleared BOOLEAN DEFAULT FALSE",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS compliance_officer_id INTEGER REFERENCES users(id)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS broker_account_id VARCHAR(100)",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS broker_onboarded_at TIMESTAMPTZ",
        "ALTER TABLE prospect_data ADD COLUMN IF NOT EXISTS iban_issued_at TIMESTAMPTZ",
        """CREATE TABLE IF NOT EXISTS manual_achievements (
            id SERIAL PRIMARY KEY,
            target_id INTEGER REFERENCES team_targets(id) ON DELETE SET NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            registered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount INTEGER DEFAULT 1,
            note VARCHAR(500),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            target_type VARCHAR(50),
            period_date DATE
        )""",
        "CREATE INDEX IF NOT EXISTS ix_manual_achievements_user_id ON manual_achievements (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_manual_achievements_target_id ON manual_achievements (target_id)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_hot_prospect BOOLEAN DEFAULT FALSE",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS hot_prospect_set_at TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS hot_prospect_set_by INTEGER REFERENCES users(id)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_approved BOOLEAN DEFAULT FALSE",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_approved_by INTEGER REFERENCES users(id)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_approved_at TIMESTAMPTZ",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_approved_value NUMERIC(12,2)",
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_approved_note TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_period_pref VARCHAR(20) DEFAULT 'month'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE",
    ]
    for _sql in _migrations:
        try:
            with engine.connect() as _conn:
                _conn.execute(text(_sql))
                _conn.commit()
        except Exception as _e:
            logger.warning("Migration skipped (%s): %s", _sql[:60].strip(), _e)
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs("app/static/avatars", exist_ok=True)

    # ── Seed system chat channels and sync role-based membership ───────────────
    _seed_system_channels()

    # ── Start background Gmail auto-sync scheduler ──────────────────────────
    sync_task = asyncio.create_task(_gmail_sync_loop())
    yield
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass


def _seed_system_channels():
    """
    Ensure the 4 role-based system channels exist and have the right members.
    Runs at startup — idempotent (safe to call multiple times).

    Channel → roles that belong to it:
      Sales       → sales, teamleader
      Backoffice  → backoffice, admin_pay, admin_trade
      Finance     → finance, admin_pay, admin_trade
      Management  → teamleider, admin_pay, admin_trade
    """
    from app.models.chat import ChatChannel, ChatMember
    from app.models.user import User

    SYSTEM_CHANNELS = [
        {"name": "Sales",       "roles": {"sales", "teamleader"}},
        {"name": "Backoffice",  "roles": {"backoffice", "admin_pay", "admin_trade"}},
        {"name": "Finance",     "roles": {"finance", "admin_pay", "admin_trade"}},
        {"name": "Management",  "roles": {"teamleader", "admin_pay", "admin_trade"}},
    ]

    db = SessionLocal()
    try:
        for cfg in SYSTEM_CHANNELS:
            # Find or create the system channel
            channel = db.query(ChatChannel).filter(
                ChatChannel.name == cfg["name"],
                ChatChannel.is_system == True,
            ).first()
            if not channel:
                channel = ChatChannel(
                    name=cfg["name"],
                    description=f"Systeem kanaal voor {cfg['name']} medewerkers",
                    channel_type="channel",
                    is_system=True,
                )
                db.add(channel)
                db.flush()  # get channel.id

            # Fetch all active users whose role matches
            eligible_users = db.query(User).filter(
                User.status == "active",
                User.role.in_(cfg["roles"]),
            ).all()
            eligible_ids = {u.id for u in eligible_users}

            # Fetch current members
            current_members = db.query(ChatMember).filter(
                ChatMember.channel_id == channel.id
            ).all()
            current_ids = {m.user_id for m in current_members}

            # Add missing members
            for uid in eligible_ids - current_ids:
                db.add(ChatMember(channel_id=channel.id, user_id=uid))

            # Remove members who no longer have the right role
            for m in current_members:
                if m.user_id not in eligible_ids:
                    db.delete(m)

        db.commit()
        logger.info("System chat channels seeded/synced OK")
    except Exception as exc:
        logger.error("Failed to seed system channels: %s", exc)
        db.rollback()
    finally:
        db.close()


async def _gmail_sync_loop():
    """Background task: auto-sync Gmail for all active leads every 30 minutes."""
    from app.services.gmail_sync import sync_all_active_leads
    # Initial delay so the app fully starts up first
    await asyncio.sleep(60)
    while True:
        db = None
        try:
            db = SessionLocal()
            # Hard cap: entire sync run must finish within 20 minutes
            result = await asyncio.wait_for(
                sync_all_active_leads(db),
                timeout=20 * 60,
            )
            logger.info(
                "Auto Gmail sync: %d leads, %d new emails",
                result["leads_processed"],
                result["total_synced"],
            )
            from app.services.gmail_sync import sync_compliance_inbox
            await sync_compliance_inbox(db)
        except asyncio.TimeoutError:
            logger.error("Gmail auto-sync timed out after 20 minutes — skipping this cycle")
            if db is not None:
                try:
                    db.rollback()
                except Exception:
                    pass
        except Exception as exc:
            logger.error("Gmail auto-sync error: %s", exc)
        finally:
            if db is not None:
                try:
                    db.close()
                except Exception:
                    pass
        # Wait 30 minutes before next run
        await asyncio.sleep(30 * 60)


app = FastAPI(
    title="TaperPay Backoffice",
    description="Sales CRM & Onboarding Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (uploads, media, branding)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# API Routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(leads.router, prefix="/api/v1/leads", tags=["Leads"])
app.include_router(prospects.router, prefix="/api/v1/prospects", tags=["Prospects"])
app.include_router(callbacks.router, prefix="/api/v1/callbacks", tags=["Callbacks"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(ai_services.router, prefix="/api/v1/ai", tags=["AI Services"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(conversations.router, prefix="/api/v1/leads", tags=["Conversations"])
app.include_router(compliance.router, prefix="/api/v1/compliance", tags=["Compliance"])
app.include_router(limit_orders.router, prefix="/api/v1/limit-orders", tags=["Limit Orders"])
app.include_router(tickets_router)
app.include_router(team_onboarding_router, prefix="/api/v1/team-onboarding", tags=["team_onboarding"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "TaperPay Backoffice"}
