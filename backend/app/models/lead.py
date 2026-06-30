"""Lead and Prospect models with full pipeline support."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey, JSON, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property
from app.database import Base
import enum


class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    CALLBACK = "callback"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    SNOOZED = "snoozed"
    ARCHIVED = "archived"
    CONVERTED = "converted"  # Moved to prospect


class LeadPriority(str, enum.Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"


class PipelineStage(str, enum.Enum):
    LEAD = "lead"
    PROSPECT = "prospect"
    ONBOARDING_SALES = "onboarding_sales"
    ONBOARDING_BACKOFFICE = "onboarding_backoffice"
    CLIENT = "client"
    LOST = "lost"
    ARCHIVED = "archived"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)

    # Company Info
    company_name = Column(String(255), nullable=False, index=True)
    company_website = Column(String(500))
    company_country = Column(String(100))
    company_industry = Column(String(255))
    company_size = Column(String(100))
    company_description = Column(Text)  # AI-enriched
    kvk_number = Column(String(50))
    linkedin_url = Column(String(500))

    # Contact Info
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    contact_mobile = Column(String(50))
    contact_position = Column(String(255))

    # Status & Pipeline
    status = Column(String(50), default=LeadStatus.NEW.value, index=True)
    pipeline_stage = Column(String(50), default=PipelineStage.LEAD.value, index=True)
    priority = Column(String(20), default=LeadPriority.COLD.value)

    # Scoring
    manual_score = Column(Integer)  # 1-10 by sales
    ai_score = Column(Float)  # AI-calculated
    ai_score_reasons = Column(JSON)  # AI reasoning

    # Assignment
    assigned_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    is_locked = Column(Boolean, default=False)  # Locked to user's own list
    locked_by_user_id = Column(Integer, ForeignKey("users.id"))
    sales_owner_id = Column(Integer, ForeignKey("users.id"), index=True)  # Permanent sales owner, set on lock

    # Call tracking
    last_called_at = Column(DateTime(timezone=True))
    call_count = Column(Integer, default=0)
    is_called = Column(Boolean, default=False)

    # Call list
    on_daily_list = Column(Boolean, default=False)
    daily_list_position = Column(Integer)
    daily_list_date = Column(Date)
    daily_list_user_id = Column(Integer, ForeignKey("users.id"))

    # Snooze
    snoozed_until = Column(DateTime(timezone=True))
    snooze_reason = Column(String(500))

    # Callbacks
    next_callback = Column(DateTime(timezone=True))

    # Source & Import
    source = Column(String(100))  # manual, import, api
    import_batch_id = Column(String(100))

    # Contact & company details (missing critical fields)
    vat_number = Column(String(50))           # BTW-nummer
    client_iban = Column(String(50))          # IBAN van de klant zelf
    address_street = Column(String(255))      # Correspondentieadres
    address_city = Column(String(100))
    address_postcode = Column(String(20))
    communication_preference = Column(String(20))  # email, phone, whatsapp

    # Pipeline timestamps (for velocity tracking)
    first_contacted_at = Column(DateTime(timezone=True))
    prospect_since = Column(DateTime(timezone=True))
    onboarding_started_at = Column(DateTime(timezone=True))
    backoffice_started_at = Column(DateTime(timezone=True))
    client_since_date = Column(DateTime(timezone=True))

    # Churn tracking
    churn_reason = Column(String(200))
    churn_date = Column(DateTime(timezone=True))
    churn_to_competitor = Column(String(255))

    # Partner referral
    partner_name = Column(String(255))

    # Backoffice revision (sent back from backoffice to onboarding_sales)
    revision_status = Column(String(50))   # needs_refactor, needs_clarification, rejected
    revision_note = Column(Text)           # Backoffice note explaining why
    revision_date = Column(DateTime(timezone=True))
    revision_by_id = Column(Integer, ForeignKey("users.id"))

    # Dealer assignment
    dealer_id = Column(Integer, ForeignKey("users.id"), index=True)

    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True))
    deleted_by = Column(Integer, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    assigned_user = relationship("User", back_populates="leads", foreign_keys=[assigned_user_id])
    locked_by = relationship("User", foreign_keys=[locked_by_user_id])
    sales_owner = relationship("User", foreign_keys=[sales_owner_id])
    dealer = relationship("User", foreign_keys=[dealer_id])
    call_logs = relationship("CallLog", back_populates="lead", order_by="CallLog.created_at.desc()")
    notes = relationship("Note", back_populates="lead", order_by="Note.created_at.desc()")
    communications = relationship("Communication", back_populates="lead", order_by="Communication.created_at.desc()")
    documents = relationship("Document", back_populates="lead")
    callbacks = relationship("Callback", back_populates="lead", order_by="Callback.scheduled_at")
    activity_logs = relationship("ActivityLog", back_populates="lead")
    custom_lists = relationship("CustomListLead", back_populates="lead")
    forecasting_items = relationship("ClientForecasting", back_populates="lead", order_by="ClientForecasting.buy_currency")
    deals = relationship("ClientDeal", back_populates="lead", order_by="ClientDeal.deal_date.desc()")
    compliance_cases = relationship("ComplianceCase", back_populates="lead", order_by="ComplianceCase.created_at.desc()")
    contact_methods = relationship("ContactMethod", back_populates="lead", order_by="ContactMethod.created_at.asc()")
    conversation_logs = relationship("ConversationLog", back_populates="lead", order_by="ConversationLog.occurred_at.desc()")

    @property
    def sales_owner_name(self):
        return self.sales_owner.full_name if self.sales_owner else None

    # Onboarding checklist (JSON: key->bool for each step)
    onboarding_checklist = Column(JSON)

    # Revenue potential rows (JSON array: [{currency_pair, volume, margin_pct, revenue}])
    revenue_potential = Column(JSON)

    # Prospect-specific fields (filled when pipeline_stage = prospect)
    prospect_data = relationship("ProspectData", back_populates="lead", uselist=False)


class ProspectData(Base):
    """Extended data for leads that have been converted to prospects."""
    __tablename__ = "prospect_data"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), unique=True, nullable=False)

    # TaperPay activated
    taperpay_active = Column(Boolean, default=False)
    # TaperTrade activated
    tapertrade_active = Column(Boolean, default=False)

    # FX Revenue Forecast
    fx_estimated_volume = Column(Float)  # Annual EUR volume
    fx_estimated_margin_pct = Column(Float)  # Margin percentage
    fx_estimated_revenue = Column(Float)  # Calculated

    # TF Revenue Forecast
    tf_estimated_volume = Column(Float)
    tf_estimated_margin_pct = Column(Float)
    tf_estimated_revenue = Column(Float)

    # Strategy / Exposure
    strategy_notes = Column(Text)

    # Trade Finance specifics
    tf_debtor_finance = Column(Boolean, default=False)
    tf_portfolio_finance = Column(Boolean, default=False)
    tf_voorraad_finance = Column(Boolean, default=False)
    tf_total_financing_need = Column(Float)
    tf_additional_info = Column(Text)

    # Broker selection (onboarding)
    selected_broker = Column(String(50))  # ibanfirst, corpay, ebury, alt21
    broker_feedback = Column(Text)

    # KYC / Compliance
    kyc_status = Column(String(50), default="pending")  # pending, in_progress, approved, rejected
    risk_profile = Column(String(20))                   # low, medium, high
    ubo_name = Column(String(255))                      # Ultimate Beneficial Owner
    ubo_nationality = Column(String(100))
    legal_entity_type = Column(String(100))             # BV, NV, Ltd, GmbH, etc.
    kyc_notes = Column(Text)
    aml_cleared = Column(Boolean, default=False)

    # Pricing
    fx_spot_spread_pct = Column(Float)          # FX spot spread in %
    fx_forward_margin_pct = Column(Float)       # Forward margin in %
    credit_limit_eur = Column(Float)            # Client credit limit in EUR
    min_deal_size_eur = Column(Float)           # Minimum FX deal size EUR
    tf_interest_rate_pct = Column(Float)        # Trade Finance interest rate %
    tf_fee_pct = Column(Float)                  # TF arrangement fee %
    tf_closing_fee_pct = Column(Float)          # TF closing fee / afsluitprovisie %
    payment_terms_days = Column(Integer)        # Payment terms in days
    pricing_notes = Column(Text)                # Free-text pricing notes

    # Compliance velden
    contract_signed_date = Column(DateTime(timezone=True))
    cdd_next_review_date = Column(Date)
    pep_cleared = Column(Boolean, default=False)
    sanctions_cleared = Column(Boolean, default=False)
    compliance_officer_id = Column(Integer, ForeignKey("users.id"))

    # Broker integratie
    broker_account_id = Column(String(100))
    broker_onboarded_at = Column(DateTime(timezone=True))
    iban_issued_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    lead = relationship("Lead", back_populates="prospect_data")
    currencies = relationship("ProspectCurrency", back_populates="prospect_data")


class ProspectCurrency(Base):
    """Currency pairs for a prospect (incoming/outgoing funds, buy/sell currencies)."""
    __tablename__ = "prospect_currencies"

    id = Column(Integer, primary_key=True, index=True)
    prospect_data_id = Column(Integer, ForeignKey("prospect_data.id"), nullable=False)

    # Type: incoming_country, outgoing_country, buying_currency, selling_currency
    currency_type = Column(String(50), nullable=False)
    value = Column(String(10), nullable=False)  # Country code or currency code
    volume = Column(Float)  # Optional volume
    notes = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prospect_data = relationship("ProspectData", back_populates="currencies")


class ClientForecasting(Base):
    """Per-client currency pair annual volume forecasting with hedging split."""
    __tablename__ = "client_forecasting"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)

    buy_currency = Column(String(10), nullable=False)   # e.g. EUR, USD, GBP
    sell_currency = Column(String(10), nullable=False)   # e.g. USD, GBP, JPY
    volume_per_year = Column(Float, default=0)           # Annual volume in buy currency (EUR)

    # Spot (unhedged) portion
    spot_margin_pct = Column(Float, default=0)           # Spread % on spot trades e.g. 0.005 = 0.5%

    # Hedging portion
    hedging_pct = Column(Float, default=0)               # % of annual volume that is hedged e.g. 0.6 = 60%
    hedging_margin_pct = Column(Float, default=0)        # Spread % on forward/hedge trades

    # Legacy field kept for backward compat (used as flat EUR margin if spot_margin_pct=0)
    margin_per_year = Column(Float, default=0)

    notes = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    lead = relationship("Lead", back_populates="forecasting_items")
    deals = relationship("ClientDeal", back_populates="forecasting_item", cascade="all, delete-orphan")


class ClientDeal(Base):
    """Individual booked deals/transactions per client per currency pair."""
    __tablename__ = "client_deals"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    forecasting_item_id = Column(Integer, ForeignKey("client_forecasting.id"), nullable=True)

    buy_currency = Column(String(10), nullable=False)
    sell_currency = Column(String(10), nullable=False)

    deal_date = Column(Date, nullable=False)
    volume = Column(Float, nullable=False)               # Volume in EUR
    deal_type = Column(String(50), default="spot")       # spot, fixed_forward, window_forward, dynamic_forward
    margin_pct = Column(Float, default=0)                # Actual spread % achieved
    notes = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"))

    lead = relationship("Lead")
    forecasting_item = relationship("ClientForecasting", back_populates="deals")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ProductLine(Base):
    """Multiple product/volume lines per lead (TaperPay / TaperTrade).

    Lives on the lead_id so it follows the lead automatically through the
    pipeline (prospect → client). Each row is one product/volume entry with a
    margin expressed as a PERCENT (e.g. 0.5 = 0,5%); revenue is computed.
    """
    __tablename__ = "product_lines"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    product = Column(String(20), nullable=False)   # 'taperpay' of 'tapertrade'
    name = Column(String(255))                      # bv. 'FX EUR/USD' of 'Debtor Finance'
    volume = Column(Float, default=0)               # jaarvolume EUR
    margin_pct = Column(Float, default=0)           # marge in PROCENT (bv. 0.5 = 0,5%)
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    lead = relationship("Lead")


class ComplianceCase(Base):
    """Compliance case/ticket linked to a client."""
    __tablename__ = "compliance_cases"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"))

    title = Column(String(255), nullable=False)
    description = Column(Text)            # Compliance request / notes
    status = Column(String(50), default="open")  # open, in_progress, resolved, closed
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    broker = Column(String(50))           # ibanfirst, corpay, ebury, trade_finance
    resolution_notes = Column(Text)
    gmail_thread_id = Column(String(255), index=True)  # Linked Gmail thread
    follow_up_date = Column(DateTime(timezone=True))  # opvolgdatum voor pending tickets

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))

    lead = relationship("Lead", back_populates="compliance_cases")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    documents = relationship("ComplianceCaseDocument", back_populates="compliance_case")


class ComplianceCaseDocument(Base):
    """Documents attached to a compliance case."""
    __tablename__ = "compliance_case_documents"

    id = Column(Integer, primary_key=True, index=True)
    compliance_case_id = Column(Integer, ForeignKey("compliance_cases.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compliance_case = relationship("ComplianceCase", back_populates="documents")
    document = relationship("Document")


class CustomList(Base):
    """User-created lead lists."""
    __tablename__ = "custom_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    leads = relationship("CustomListLead", back_populates="custom_list")


class CustomListLead(Base):
    """Many-to-many for custom lists and leads."""
    __tablename__ = "custom_list_leads"

    id = Column(Integer, primary_key=True, index=True)
    custom_list_id = Column(Integer, ForeignKey("custom_lists.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    position = Column(Integer, default=0)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    custom_list = relationship("CustomList", back_populates="leads")
    lead = relationship("Lead", back_populates="custom_lists")


class LimitOrder(Base):
    """Price level alert for a client lead."""
    __tablename__ = "limit_orders"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    currency_pair = Column(String(20), nullable=False)   # e.g. "EURUSD"
    rate = Column(Float, nullable=False)                  # trigger rate
    volume = Column(Float)                                # optional volume in EUR
    direction = Column(String(10))                        # buy, sell, or None
    status = Column(String(20), default="active")        # active, triggered, cancelled
    notes = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    triggered_at = Column(DateTime(timezone=True))

    lead = relationship("Lead")
    created_by = relationship("User", foreign_keys=[created_by_id])
