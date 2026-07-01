"""Pydantic schemas for leads API."""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class LeadCreate(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    company_country: Optional[str] = None
    country: Optional[str] = None
    company_industry: Optional[str] = None
    company_size: Optional[str] = None
    kvk_number: Optional[str] = None
    linkedin_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    email: Optional[str] = None
    contact_phone: Optional[str] = None
    phone: Optional[str] = None
    contact_mobile: Optional[str] = None
    contact_position: Optional[str] = None
    priority: Optional[str] = "cold"
    partner_name: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    manual_score: Optional[int] = None
    company_description: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_postcode: Optional[str] = None
    vat_number: Optional[str] = None
    client_iban: Optional[str] = None
    communication_preference: Optional[str] = None
    onboarding_checklist: Optional[dict] = None
    revenue_potential: Optional[list] = None


class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    company_country: Optional[str] = None
    company_industry: Optional[str] = None
    company_size: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_mobile: Optional[str] = None
    contact_position: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    pipeline_stage: Optional[str] = None
    onboarding_checklist: Optional[dict] = None
    partner_name: Optional[str] = None
    vat_number: Optional[str] = None
    client_iban: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_postcode: Optional[str] = None
    communication_preference: Optional[str] = None
    churn_reason: Optional[str] = None
    churn_to_competitor: Optional[str] = None
    revenue_potential: Optional[list] = None
    manual_score: Optional[int] = None
    source: Optional[str] = None
    company_description: Optional[str] = None


class LeadResponse(BaseModel):
    id: int
    company_name: str
    company_website: Optional[str] = None
    company_country: Optional[str] = None
    company_industry: Optional[str] = None
    company_size: Optional[str] = None
    company_description: Optional[str] = None
    kvk_number: Optional[str] = None
    linkedin_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_mobile: Optional[str] = None
    contact_position: Optional[str] = None
    status: str
    priority: str
    pipeline_stage: Optional[str] = None
    is_called: bool = False
    on_daily_list: bool = False
    manual_score: Optional[int] = None
    ai_score: Optional[float] = None
    ai_score_reasons: Optional[dict] = None
    assigned_user_id: Optional[int] = None
    sales_owner_id: Optional[int] = None
    sales_owner_name: Optional[str] = None
    is_locked: bool = False
    call_count: int = 0
    last_called_at: Optional[datetime] = None
    next_callback: Optional[datetime] = None
    source: Optional[str] = None
    partner_name: Optional[str] = None
    onboarding_checklist: Optional[dict] = None
    vat_number: Optional[str] = None
    client_iban: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_postcode: Optional[str] = None
    communication_preference: Optional[str] = None
    first_contacted_at: Optional[datetime] = None
    prospect_since: Optional[datetime] = None
    onboarding_started_at: Optional[datetime] = None
    backoffice_started_at: Optional[datetime] = None
    client_since_date: Optional[datetime] = None
    churn_reason: Optional[str] = None
    churn_date: Optional[datetime] = None
    churn_to_competitor: Optional[str] = None
    revision_status: Optional[str] = None
    revision_note: Optional[str] = None
    revision_date: Optional[datetime] = None
    revenue_potential: Optional[list] = None
    contact_person: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    account_manager_id: Optional[int] = None
    account_manager_name: Optional[str] = None
    is_hot_prospect: bool = False
    revenue_approved: bool = False
    revenue_approved_by: Optional[int] = None
    revenue_approved_at: Optional[datetime] = None
    revenue_approved_value: Optional[float] = None
    revenue_approved_note: Optional[str] = None
    snoozed_until: Optional[datetime] = None
    snooze_reason: Optional[str] = None
    tf_revenue_potential: Optional[float] = None
    is_pinned: bool = False

    class Config:
        from_attributes = True


class LeadListResponse(BaseModel):
    leads: List[LeadResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DailyListUpdate(BaseModel):
    position: int


class LeadScoreUpdate(BaseModel):
    manual_score: Optional[int] = None
    priority: Optional[str] = None


class SnoozeRequest(BaseModel):
    until: datetime
    reason: Optional[str] = None


class BulkActionRequest(BaseModel):
    lead_ids: List[int]
    action: str  # delete, assign, lock, unlock


class CustomListCreate(BaseModel):
    name: str
    description: Optional[str] = None
