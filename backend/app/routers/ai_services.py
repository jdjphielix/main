"""AI services router: lead enrichment, import, document scanning, report generation."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from pydantic import BaseModel
import anthropic
import json
import httpx
import base64
import logging
import re
import fitz

from bs4 import BeautifulSoup

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead, ProspectData
from app.models.communication import Document
from app.models.notification import OnboardingRequirement
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class CompanyEnrichRequest(BaseModel):
    company_name: str
    website: Optional[str] = None
    place_id: Optional[str] = None  # Google Place ID for detailed lookup


# ─── Google Places helpers ──────────────────────────────

async def google_places_search(query: str, limit: int = 5) -> List[dict]:
    """Search Google Places API (Text Search) for companies."""
    if not settings.GOOGLE_PLACES_API_KEY:
        return []

    results = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # Use the new Places API (v1) Text Search
            resp = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
                    "X-Goog-FieldMask": (
                        "places.id,places.displayName,places.formattedAddress,"
                        "places.internationalPhoneNumber,places.nationalPhoneNumber,"
                        "places.websiteUri,places.googleMapsUri,places.businessStatus,"
                        "places.types,places.primaryType,places.shortFormattedAddress,"
                        "places.addressComponents"
                    ),
                    "Content-Type": "application/json",
                },
                json={
                    "textQuery": query,
                    "languageCode": "nl",
                    "maxResultCount": limit,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                for place in data.get("places", []):
                    # Extract country from addressComponents
                    country = ""
                    city = ""
                    postal_code = ""
                    for comp in place.get("addressComponents", []):
                        types = comp.get("types", [])
                        if "country" in types:
                            country = comp.get("longText", "")
                        if "locality" in types:
                            city = comp.get("longText", "")
                        if "postal_code" in types:
                            postal_code = comp.get("longText", "")

                    results.append({
                        "company_name": place.get("displayName", {}).get("text", ""),
                        "address": place.get("formattedAddress", ""),
                        "short_address": place.get("shortFormattedAddress", ""),
                        "phone": place.get("internationalPhoneNumber", "")
                                 or place.get("nationalPhoneNumber", ""),
                        "website": place.get("websiteUri", ""),
                        "google_maps_url": place.get("googleMapsUri", ""),
                        "place_id": place.get("id", ""),
                        "country": country,
                        "city": city,
                        "postal_code": postal_code,
                        "business_status": place.get("businessStatus", ""),
                        "types": place.get("types", []),
                        "primary_type": place.get("primaryType", ""),
                        "source": "google_places",
                    })
            else:
                logger.warning(f"Google Places search failed: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Google Places search error: {e}")

    return results


async def google_place_details(place_id: str) -> dict:
    """Get detailed info for a specific Google Place by its place_id."""
    if not settings.GOOGLE_PLACES_API_KEY or not place_id:
        return {}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://places.googleapis.com/v1/places/{place_id}",
                headers={
                    "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
                    "X-Goog-FieldMask": (
                        "id,displayName,formattedAddress,internationalPhoneNumber,"
                        "nationalPhoneNumber,websiteUri,googleMapsUri,businessStatus,"
                        "types,primaryType,editorialSummary,reviews,rating,"
                        "userRatingCount,addressComponents,shortFormattedAddress"
                    ),
                },
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning(f"Google Place details error: {e}")

    return {}


# ─── Website scraping helper ────────────────────────────

async def scrape_website_info(url: str) -> dict:
    """Scrape a company website for meta info (description, industry, etc.)."""
    info = {}
    if not url:
        return info

    # Ensure URL has scheme
    if not url.startswith("http"):
        url = "https://" + url

    try:
        async with httpx.AsyncClient(
            timeout=8.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; TaperCRM/1.0)"},
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")

                # Title
                title_tag = soup.find("title")
                if title_tag:
                    info["page_title"] = title_tag.get_text(strip=True)

                # Meta description
                meta_desc = soup.find("meta", attrs={"name": "description"})
                if meta_desc:
                    info["description"] = meta_desc.get("content", "")

                # OG tags
                og_desc = soup.find("meta", attrs={"property": "og:description"})
                if og_desc and not info.get("description"):
                    info["description"] = og_desc.get("content", "")

                og_title = soup.find("meta", attrs={"property": "og:site_name"})
                if og_title:
                    info["site_name"] = og_title.get("content", "")

                # Look for LinkedIn link
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if "linkedin.com/company" in href:
                        info["linkedin_url"] = href
                        break

                # Look for email addresses
                email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
                page_text = soup.get_text()
                emails = email_pattern.findall(page_text)
                # Filter out common non-contact emails
                filtered = [e for e in emails if not any(x in e.lower() for x in ['@example', '@test', 'noreply', 'no-reply', '.png', '.jpg'])]
                if filtered:
                    info["emails"] = list(set(filtered))[:3]

                # Look for phone numbers (Dutch format)
                phone_pattern = re.compile(r'(?:\+31|0031|0)\s*[\-\.]?\s*(?:[1-9]\d{1,2})\s*[\-\.]?\s*\d{3}\s*[\-\.]?\s*\d{2,4}')
                phones = phone_pattern.findall(page_text)
                if phones:
                    info["phones"] = list(set(p.strip() for p in phones))[:3]

    except Exception as e:
        logger.debug(f"Website scrape failed for {url}: {e}")

    return info


# ─── Company lookup & enrich endpoints ──────────────────

@router.get("/company-lookup")
async def company_lookup(
    query: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user),
):
    """
    Search for companies by name.
    Priority: Google Places API → fallback manual entry.
    Returns list of matching companies with address, phone, website from Google Maps.
    """
    results = []

    # 1. Google Places API (primary source — real data from Google Maps)
    places_results = await google_places_search(query)
    if places_results:
        results = places_results

    # 2. If no Google results and no API key, provide manual fallback
    if not results:
        # Fallback: allow manual entry with the typed name
        results.append({
            "company_name": query,
            "address": "",
            "phone": "",
            "website": "",
            "country": "",
            "city": "",
            "place_id": "",
            "source": "manual",
        })

    return {"results": results, "total": len(results)}


@router.post("/company-enrich")
async def company_enrich(
    request: CompanyEnrichRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Enrich company info by combining:
    1. Google Place details (address, phone, reviews, rating)
    2. Website scraping (description, LinkedIn, emails)
    3. Claude AI analysis (industry classification, description, fit assessment)
    """
    enriched = {
        "company_name": request.company_name,
        "website": request.website,
    }

    # Step 1: Get Google Place details if we have a place_id
    if request.place_id:
        place = await google_place_details(request.place_id)
        if place:
            enriched.update({
                "company_name": place.get("displayName", {}).get("text", request.company_name),
                "address": place.get("formattedAddress", ""),
                "phone": place.get("internationalPhoneNumber", "")
                         or place.get("nationalPhoneNumber", ""),
                "website": place.get("websiteUri", "") or request.website,
                "google_maps_url": place.get("googleMapsUri", ""),
                "rating": place.get("rating"),
                "review_count": place.get("userRatingCount"),
            })
            # Extract country/city
            for comp in place.get("addressComponents", []):
                types = comp.get("types", [])
                if "country" in types:
                    enriched["country"] = comp.get("longText", "")
                if "locality" in types:
                    enriched["city"] = comp.get("longText", "")

            # Editorial summary from Google
            editorial = place.get("editorialSummary", {})
            if editorial:
                enriched["google_description"] = editorial.get("text", "")

    # Step 2: Scrape the company website
    website = enriched.get("website") or request.website
    if website:
        site_info = await scrape_website_info(website)
        if site_info:
            enriched["description"] = site_info.get("description", "")
            enriched["linkedin_url"] = site_info.get("linkedin_url", "")
            if site_info.get("emails"):
                enriched["contact_emails"] = site_info["emails"]
            if site_info.get("phones"):
                enriched["extra_phones"] = site_info["phones"]
            enriched["website"] = website

    # Step 3: Use Claude to generate a professional description + industry
    try:
        ai_client = get_ai_client()

        context_parts = [f'Company name: "{request.company_name}"']
        if enriched.get("website"):
            context_parts.append(f'Website: {enriched["website"]}')
        if enriched.get("address"):
            context_parts.append(f'Address: {enriched["address"]}')
        if enriched.get("description"):
            context_parts.append(f'Website description: {enriched["description"]}')
        if enriched.get("google_description"):
            context_parts.append(f'Google description: {enriched["google_description"]}')

        context = "\n".join(context_parts)

        prompt = f"""Based on this company information, provide a JSON object with:
- description: Professional 2-3 sentence company description (in Dutch if it's a Dutch company)
- industry: Primary industry/sector
- company_size: Estimated size if possible ("1-10", "11-50", "51-200", "201-500", "500+") or null
- kvk_number: Dutch KVK number if you know it, or null
- international_trade: true/false - does this company likely do international trade?
- fx_relevance: Brief note on why they might need FX/payment services, or null

Company info:
{context}

Return ONLY the JSON object, no other text."""

        message = ai_client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start >= 0 and end > start:
            ai_data = json.loads(response_text[start:end])
            # Merge AI data (don't overwrite real data with AI guesses)
            enriched["industry"] = ai_data.get("industry", "")
            enriched["company_size"] = ai_data.get("company_size")
            if not enriched.get("description"):
                enriched["description"] = ai_data.get("description", "")
            elif ai_data.get("description"):
                enriched["ai_description"] = ai_data["description"]
            enriched["kvk_number"] = ai_data.get("kvk_number")
            enriched["international_trade"] = ai_data.get("international_trade")
            enriched["fx_relevance"] = ai_data.get("fx_relevance")
    except Exception as e:
        logger.warning(f"AI enrichment failed: {e}")

    return enriched


# Lazy-initialize Anthropic client to avoid import-time errors in restricted envs
_client = None

def get_ai_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


@router.post("/enrich-lead/{lead_id}")
async def enrich_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Full-pipeline enrichment: website scraping + Google Places + Claude deep analysis.
    Returns a comprehensive company profile and saves it to the lead.
    """
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    context_parts = [f'Bedrijfsnaam: "{lead.company_name}"']
    scraped = {}

    # Step 1: Scrape website
    website = lead.company_website
    if website:
        context_parts.append(f"Website: {website}")
        scraped = await scrape_website_info(website) or {}
        if scraped.get("description"):
            context_parts.append(f"Website beschrijving: {scraped['description']}")
        if scraped.get("page_title"):
            context_parts.append(f"Paginatitel: {scraped['page_title']}")
        if scraped.get("emails"):
            context_parts.append(f"Gevonden e-mails: {', '.join(scraped['emails'])}")
        if scraped.get("phones"):
            context_parts.append(f"Gevonden telefoonnummers: {', '.join(scraped['phones'])}")
        if scraped.get("linkedin_url"):
            context_parts.append(f"LinkedIn: {scraped['linkedin_url']}")

    # Step 2: Google Places lookup
    if lead.company_name:
        places = await google_places_search(lead.company_name)
        if places:
            p = places[0]
            if p.get("address"):
                context_parts.append(f"Adres: {p['address']}")
            if p.get("phone"):
                context_parts.append(f"Telefoon: {p['phone']}")
            if p.get("country"):
                context_parts.append(f"Land: {p['country']}")
            if p.get("city"):
                context_parts.append(f"Stad: {p['city']}")

    # Existing DB data
    if lead.company_country:
        context_parts.append(f"Land (bestaand): {lead.company_country}")
    if lead.company_industry:
        context_parts.append(f"Industrie (bestaand): {lead.company_industry}")
    if lead.company_size:
        context_parts.append(f"Bedrijfsgrootte (bestaand): {lead.company_size}")
    if lead.kvk_number:
        context_parts.append(f"KVK: {lead.kvk_number}")
    if lead.linkedin_url:
        context_parts.append(f"LinkedIn: {lead.linkedin_url}")

    context = "\n".join(context_parts)

    prompt = f"""Je bent een business intelligence analist voor Taper, een fintech bedrijf dat FX-betalingen, internationale betalingen en handelsfinanciering levert aan MKB-bedrijven die internationaal actief zijn.

Analyseer dit bedrijf grondig en geef een uitgebreid profiel terug als JSON:

{context}

Geef ALLEEN een JSON object terug met deze velden:
{{
  "description": "Professionele 3-4 zinnige bedrijfsbeschrijving (in het Nederlands als het een Nederlands bedrijf is, anders Engels)",
  "industry": "Primaire industrie/sector",
  "company_size": "Geschatte grootte: 1-10, 11-50, 51-200, 201-500, 500+ of null",
  "founding_year": Oprichtingsjaar als integer of null,
  "headquarters": "Stad, Land of null",
  "annual_revenue_estimate": "Geschatte jaaromzet bijv. €1M-€5M of null",
  "kvk_number": "KVK-nummer als je het weet, anders null",
  "international_trade": true of false — handelt dit bedrijf internationaal?,
  "trade_countries": ["land1", "land2"] — landen waarmee ze waarschijnlijk handelen,
  "products_services": ["product/dienst 1", "product/dienst 2"] — maximaal 5 kernproducten/-diensten,
  "fx_relevance": "Korte notitie waarom dit bedrijf valuta- of betalingsdiensten nodig heeft, of null",
  "pain_points": ["pijnpunt 1", "pijnpunt 2"] — financiële pijnpunten die Taper oplost, maximaal 3,
  "business_segments": ["segment 1", "segment 2"] — zakelijke segmenten relevant voor internationale betalingen,
  "fit_score": score 0-10 hoe goed dit bedrijf bij Taper past,
  "fit_reason": "Uitleg van de fit score in 1-2 zinnen",
  "taper_fit_products": ["TaperPay FX Spot", "TaperPay Fixed Forward", "TaperTrade Debtor Finance"] — relevante Taper producten (kies uit: TaperPay FX Spot, TaperPay Fixed Forward, TaperPay Window Forward, TaperPay Dynamic Forward, TaperPay IBAN Accounts, TaperTrade Debtor Finance, TaperTrade Portfolio Based Lending, TaperTrade Structured Commodity Finance)
}}

Wees specifiek en accuraat. Gebruik ALLEEN de JSON, geen andere tekst."""

    try:
        message = get_ai_client().messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown fences
        if raw.startswith("```"):
            raw = "\n".join(l for l in raw.split("\n") if not l.strip().startswith("```")).strip()
        start = raw.find('{')
        end = raw.rfind('}') + 1
        enrichment_json = json.loads(raw[start:end]) if start >= 0 and end > start else {}
    except Exception as e:
        logger.warning(f"AI enrichment failed: {e}")
        enrichment_json = {"description": f"Verrijking mislukt: {e}"}

    # Merge scraped data into enrichment
    if scraped.get("linkedin_url") and not enrichment_json.get("linkedin_url"):
        enrichment_json["linkedin_url"] = scraped["linkedin_url"]
    if scraped.get("phones"):
        enrichment_json["phone"] = scraped["phones"][0]

    # Add metadata
    from datetime import datetime, timezone
    enrichment_json["enriched_at"] = datetime.now(timezone.utc).isoformat()
    enrichment_json["website"] = website or lead.company_website

    # Save back to lead model
    lead.company_description = json.dumps(enrichment_json, ensure_ascii=False)
    if enrichment_json.get("industry"):
        lead.company_industry = enrichment_json["industry"]
    if enrichment_json.get("company_size"):
        lead.company_size = enrichment_json["company_size"]
    if enrichment_json.get("kvk_number"):
        lead.kvk_number = enrichment_json["kvk_number"]
    if enrichment_json.get("linkedin_url"):
        lead.linkedin_url = enrichment_json["linkedin_url"]
    if enrichment_json.get("fit_score") is not None:
        lead.ai_score = enrichment_json["fit_score"] / 10.0
    if enrichment_json.get("fit_reason"):
        lead.ai_score_reasons = {
            "fit_reason": enrichment_json["fit_reason"],
            "fit_products": enrichment_json.get("taper_fit_products", []),
        }

    db.commit()

    return {
        "lead_id": lead_id,
        "enrichment": enrichment_json,
        "status": "enriched",
    }


@router.post("/import-leads")
async def import_leads(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import leads from Excel/PDF/image file using Claude to parse.
    Returns list of detected leads for user to confirm before creating.
    """
    contents = await file.read()

    # Determine file type
    filename = file.filename.lower()
    if filename.endswith('.pdf'):
        file_type = "PDF"
    elif filename.endswith(('.xlsx', '.xls')):
        file_type = "Excel"
    elif filename.endswith('.csv'):
        file_type = "CSV"
    elif filename.endswith(('.png', '.jpg', '.jpeg')):
        file_type = "Image"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload een PDF, Excel, CSV of afbeelding.")

    # Parse file content based on type
    file_text = ""

    if file_type == "CSV":
        # Parse CSV directly — no need for AI for simple CSVs
        import csv
        import io
        try:
            text_content = contents.decode('utf-8', errors='replace')
            reader = csv.DictReader(io.StringIO(text_content))
            rows = list(reader)
            if rows:
                file_text = f"CSV with {len(rows)} rows. Headers: {', '.join(rows[0].keys() if rows else [])}\n\nData:\n"
                for row in rows[:200]:  # Max 200 rows
                    file_text += str(dict(row)) + "\n"
        except Exception as e:
            # Fallback: treat as raw text
            file_text = contents.decode('utf-8', errors='replace')[:10000]

    elif file_type == "Excel":
        # Try to read Excel with openpyxl
        try:
            import openpyxl
            import io
            wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if rows:
                headers = [str(h or '') for h in rows[0]]
                file_text = f"Excel with {len(rows)-1} data rows. Headers: {', '.join(headers)}\n\nData:\n"
                for row in rows[1:201]:  # Max 200 rows
                    row_dict = {headers[i]: str(v or '') for i, v in enumerate(row) if i < len(headers)}
                    file_text += str(row_dict) + "\n"
        except Exception:
            file_text = contents.decode('utf-8', errors='ignore')[:10000]

    elif file_type == "Image":
        # For images, use base64 with Claude vision
        import base64
        ext = filename.rsplit('.', 1)[-1]
        media_type = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else 'png'}"
        b64 = base64.standard_b64encode(contents).decode('utf-8')

        import_prompt = """
        Analyze this image (could be a KvK uittreksel, business card, document scan, or any business document).
        Extract ALL companies and contact persons you can find.
        For each company/person, extract:
        - company_name (REQUIRED)
        - contact_name
        - contact_email
        - contact_phone
        - contact_position
        - company_country
        - company_website
        - kvk_number (if visible, e.g. from KvK uittreksel)
        - company_industry

        Return ONLY a JSON array. Include every recognizable company/person, even with partial info.
        If it's a KvK extract, extract the company details as a single lead.
        """

        message = get_ai_client().messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": import_prompt},
                ]
            }]
        )

        # Skip the text-based flow below
        response_text = message.content[0].text
        try:
            import json as json_lib
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start >= 0 and end > start:
                leads_json = json_lib.loads(response_text[start:end])
            else:
                leads_json = []
        except Exception:
            leads_json = []

        return {
            "file_name": file.filename,
            "file_type": file_type,
            "detected_leads": leads_json,
            "total_detected": len(leads_json),
            "status": "pending_confirmation",
            "message": "Review detected leads and confirm import",
        }

    else:
        # PDF or unknown text-based
        file_text = contents.decode('utf-8', errors='ignore')[:10000]

    import_prompt = f"""
    Parse the following {file_type} data and extract lead/company information.
    For each company/person found, extract:
    - company_name (REQUIRED - skip if not present)
    - contact_name
    - contact_email
    - contact_phone
    - contact_position (optional)
    - company_country (optional)
    - company_website (optional)
    - kvk_number (optional, KvK/Chamber of Commerce number)
    - company_industry (optional)

    Return ONLY a valid JSON array with these fields. No explanation text.
    Include every recognizable company/person, even with partial info (at minimum company_name).
    """

    message = get_ai_client().messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": import_prompt + "\n\nFile content:\n" + file_text,
                    }
                ]
            }
        ]
    )

    response_text = message.content[0].text
    try:
        # Extract JSON from response
        import json as json_lib
        # Find JSON array in response
        start = response_text.find('[')
        end = response_text.rfind(']') + 1
        if start >= 0 and end > start:
            leads_json = json_lib.loads(response_text[start:end])
        else:
            leads_json = []
    except json_lib.JSONDecodeError:
        leads_json = []

    return {
        "file_name": file.filename,
        "file_type": file_type,
        "detected_leads": leads_json,
        "total_detected": len(leads_json),
        "status": "pending_confirmation",
        "message": "Review detected leads and confirm import",
    }


@router.post("/scan-document/{document_id}")
async def scan_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    AI document check for onboarding.
    Matches document against the admin-defined onboarding requirement
    (name + description) linked via requirement_id.
    Falls back to generic KYC/AML scan if no requirement is linked.
    Supports PDF, images, and text-based files.
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.is_deleted == False,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    logger.info(f"Scanning document {document_id}: filename={document.original_filename}, path={document.file_path}")

    # Load the linked onboarding requirement (admin-defined criteria)
    requirement = None
    if document.requirement_id:
        requirement = db.query(OnboardingRequirement).filter(
            OnboardingRequirement.id == document.requirement_id,
            OnboardingRequirement.is_active == True,
        ).first()

    # Build requirement context for the prompt
    if requirement:
        req_context = f"""
    ONBOARDING REQUIREMENT (set by admin):
    - Requirement name: {requirement.name}
    - Description/criteria: {requirement.description or 'No specific description provided'}
    - Product: {requirement.product_type.upper() if requirement.product_type else 'General'}
    - Broker: {requirement.broker.upper() if requirement.broker else 'Any'}
    - Required: {'Yes — this document is mandatory' if requirement.is_required else 'No — optional document'}

    Your task: Check if the uploaded document MATCHES and SATISFIES this specific requirement.
    Determine whether the document is the right type and contains all necessary information
    for the requirement above."""
    else:
        req_context = """
    No specific onboarding requirement linked. Perform a general KYC/AML compliance check."""

    # Read document — handle different file types
    file_ext = document.original_filename.rsplit('.', 1)[-1].lower() if document.original_filename else ''
    is_image = file_ext in ('png', 'jpg', 'jpeg', 'gif', 'webp')
    is_pdf = file_ext == 'pdf'

    # For images, use Claude vision API
    if is_image:
        try:
            with open(document.file_path, 'rb') as f:
                image_data = f.read()
            b64 = base64.b64encode(image_data).decode('utf-8')
            media_type = f"image/{'jpeg' if file_ext in ('jpg', 'jpeg') else file_ext}"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read image: {str(e)}")

        scan_prompt = f"""You are a compliance officer at a fintech company (Taper).
    Analyze this uploaded document image for an onboarding process.

    Original filename: {document.original_filename}
    {req_context}

    Analyze the image and determine:
    1. What type of document is this? (e.g., KvK extract, passport, proof of address, bank statement, UBO declaration, etc.)
    2. Does this document match the requirement above?
    3. Are the required fields present and legible?
    4. Are there any red flags or compliance concerns?
    5. Overall compliance status

    You MUST return valid JSON with exactly these keys:
    - document_type: string describing what kind of document this is
    - matches_requirement: true/false — does this document match what was requested?
    - required_fields: {{present: [list of fields found], missing: [list of expected but missing fields]}}
    - red_flags: [list of concerns, or empty list]
    - compliance_status: one of "compliant", "requires_clarification", "needs_rejection"
    - recommendations: [list of action items]
    - summary: brief 1-2 sentence assessment in Dutch

    Return ONLY the JSON object, no other text."""

        try:
            message = get_ai_client().messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                        {"type": "text", "text": scan_prompt},
                    ],
                }],
            )
        except Exception as e:
            logger.error(f"Anthropic API error (image scan): {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail=f"AI scan fout: {type(e).__name__}: {str(e)}")
    elif is_pdf:
        # PDF: Render pages as images and use Claude vision API
        import os as _os
        if not _os.path.exists(document.file_path):
            raise HTTPException(status_code=400, detail=f"PDF file not found at path: {document.file_path}")
        try:
            pdf_document = fitz.open(document.file_path)
            page_images = []

            # Render first 3 pages as PNG images at 200 DPI
            max_pages = min(3, len(pdf_document))
            for page_num in range(max_pages):
                page = pdf_document[page_num]
                # Render at 200 DPI (approx 2.67x zoom from default 72 DPI)
                mat = fitz.Matrix(200/72, 200/72)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                image_bytes = pix.tobytes("png")
                b64_image = base64.b64encode(image_bytes).decode('utf-8')
                page_images.append(b64_image)

            pdf_document.close()

            if not page_images:
                raise HTTPException(status_code=400, detail="PDF has no readable pages")
        except HTTPException:
            raise  # Re-raise HTTP exceptions as-is
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not process PDF: {type(e).__name__}: {str(e)}")

        scan_prompt = f"""You are a compliance officer at a fintech company (Taper).
    Analyze this uploaded document for an onboarding process.

    Original filename: {document.original_filename}
    {req_context}

    Analyze the document and determine:
    1. What type of document is this? (e.g., KvK extract, passport, proof of address, bank statement, UBO declaration, articles of association, etc.)
    2. Does this document match the requirement above?
    3. Are the required fields present and legible?
    4. Are there any red flags or compliance concerns?
    5. Overall compliance status

    You MUST return valid JSON with exactly these keys:
    - document_type: string describing what kind of document this is
    - matches_requirement: true/false — does this document match what was requested?
    - required_fields: {{present: [list of fields found], missing: [list of expected but missing fields]}}
    - red_flags: [list of concerns, or empty list]
    - compliance_status: one of "compliant", "requires_clarification", "needs_rejection"
    - recommendations: [list of action items]
    - summary: brief 1-2 sentence assessment in Dutch

    Return ONLY the JSON object, no other text."""

        # Build message with image blocks for each PDF page
        message_content = []
        for b64_image in page_images:
            message_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": b64_image
                }
            })
        message_content.append({
            "type": "text",
            "text": scan_prompt
        })

        try:
            message = get_ai_client().messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": message_content}],
            )
        except Exception as e:
            logger.error(f"Anthropic API error (PDF scan): {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail=f"AI scan fout: {type(e).__name__}: {str(e)}")

    else:
        # Text-based files (CSV, Excel, text files, etc.)
        try:
            with open(document.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                doc_content = f.read()[:8000]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read document: {str(e)}")

        if not doc_content.strip():
            doc_content = "(Document could not be read as text)"

        scan_prompt = f"""You are a compliance officer at a fintech company (Taper).
    Analyze this uploaded document for an onboarding process.

    Original filename: {document.original_filename}
    File type: {file_ext.upper() if file_ext else 'Unknown'}
    {req_context}

    Analyze the document content and determine:
    1. What type of document is this? (e.g., KvK extract, passport copy, proof of address, bank statement, UBO declaration, articles of association, etc.)
    2. Does this document match the requirement above?
    3. Are the required fields present? (names, addresses, registration numbers, dates, etc.)
    4. Are there any red flags or compliance concerns?
    5. Overall compliance status

    You MUST return valid JSON with exactly these keys:
    - document_type: string describing what kind of document this is
    - matches_requirement: true/false — does this document match what was requested?
    - required_fields: {{present: [list of fields found], missing: [list of expected but missing fields]}}
    - red_flags: [list of concerns, or empty list]
    - compliance_status: one of "compliant", "requires_clarification", "needs_rejection"
    - recommendations: [list of action items]
    - summary: brief 1-2 sentence assessment in Dutch

    Return ONLY the JSON object, no other text.

    Document content:
    {doc_content}"""

        try:
            message = get_ai_client().messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": scan_prompt}],
            )
        except Exception as e:
            logger.error(f"Anthropic API error (text scan): {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail=f"AI scan fout: {type(e).__name__}: {str(e)}")

    # Wrap Anthropic API call errors
    if not message or not message.content:
        raise HTTPException(status_code=500, detail="AI service returned empty response")

    # Parse response
    response_text = message.content[0].text
    try:
        import json as json_lib
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start >= 0 and end > start:
            scan_result = json_lib.loads(response_text[start:end])
        else:
            scan_result = {
                "document_type": "Onbekend",
                "matches_requirement": False,
                "compliance_status": "requires_clarification",
                "required_fields": {"present": [], "missing": ["Kon document niet analyseren"]},
                "red_flags": [],
                "recommendations": ["Upload het document opnieuw in een leesbaar formaat"],
                "summary": "Document kon niet geanalyseerd worden. Probeer een ander formaat.",
            }
    except json_lib.JSONDecodeError:
        scan_result = {
            "document_type": "Onbekend",
            "matches_requirement": False,
            "compliance_status": "requires_clarification",
            "required_fields": {"present": [], "missing": ["Parsefout in AI-respons"]},
            "red_flags": [],
            "recommendations": ["Probeer het document opnieuw te uploaden"],
            "summary": "AI-analyse kon niet worden verwerkt.",
        }

    # Ensure compliance_status is always set
    if "compliance_status" not in scan_result or scan_result["compliance_status"] not in (
        "compliant", "requires_clarification", "needs_rejection"
    ):
        scan_result["compliance_status"] = "requires_clarification"

    # Update document
    document.ai_scan_result = json.dumps(scan_result)
    document.ai_scan_status = "scanned"
    db.commit()

    return {
        "document_id": document_id,
        "scan_result": scan_result,
        "status": "scanned",
    }


@router.post("/text-instruction")
async def process_text_instruction(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Process a free-text instruction using Claude.
    Extracts client references, contact names, and actions.
    Adds conversation logs to matched clients.
    """
    from app.models.lead import Lead, PipelineStage
    from app.models.communication import ConversationLog
    from datetime import datetime, timezone
    import json as _json

    instruction = (data.get("instruction") or "").strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="instruction is required")

    # Load ALL active leads across all pipeline stages for matching
    STAGE_LABELS = {
        "lead": "Lead",
        "prospect": "Prospect",
        "onboarding_sales": "Onboarding (Sales)",
        "onboarding_backoffice": "Onboarding (Backoffice)",
        "client": "Client",
    }

    all_leads = db.query(Lead).filter(
        Lead.is_deleted == False,
        Lead.pipeline_stage.in_(list(STAGE_LABELS.keys())),
    ).all()

    client_list = [
        {
            "id": c.id,
            "company_name": c.company_name,
            "contact_name": c.contact_name,
            "pipeline_stage": STAGE_LABELS.get(c.pipeline_stage, c.pipeline_stage),
        }
        for c in all_leads
    ]

    ai_client = get_ai_client()

    prompt = f"""Je bent een CRM-assistent voor TaperPay, een FX en trade finance bedrijf.
De gebruiker heeft de volgende instructie getypt:
"{instruction}"

Dit is een lijst van alle actieve relaties in het platform (leads, prospects, onboarding cases en clients):
{_json.dumps(client_list, ensure_ascii=False)}

Parseer de instructie en retourneer een JSON object met:
{{
  "matched_client_id": <int of null>,
  "matched_company_name": "<string of null>",
  "matched_pipeline_stage": "<pipeline stage label of null>",
  "contact_name": "<geëxtraheerde contactnaam of null>",
  "summary": "<korte samenvatting van de instructie in het Nederlands, max 200 tekens>",
  "action": "add_conversation_log",
  "confidence": <0.0-1.0>
}}

Regels:
- match op company_name: gebruik fuzzy matching, negeer hoofd/kleine letters en kleine spelfouten
- match ook op contact_name als de gebruiker een persoonsnaam noemt
- Als geen duidelijke match: matched_client_id = null
- summary: schrijf in verleden tijd wat er besproken is, bijv "Klant heeft interesse in window forward 500K op 1.17"
- action is altijd "add_conversation_log" voor nu
- Retourneer ALLEEN het JSON object, geen tekst eromheen"""

    try:
        response = ai_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code blocks if present
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:-1])
        parsed = _json.loads(raw)
    except Exception as e:
        logger.error("Text instruction parsing failed: %s", e)
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {e}")

    client_id = parsed.get("matched_client_id")
    summary = parsed.get("summary", instruction[:200])
    contact_name = parsed.get("contact_name")
    confidence = parsed.get("confidence", 0)

    result = {
        "parsed": parsed,
        "actions_taken": [],
        "warnings": [],
    }

    if client_id and confidence >= 0.5:
        # Verify client exists
        lead = db.query(Lead).filter(Lead.id == client_id, Lead.is_deleted == False).first()
        if lead:
            log = ConversationLog(
                lead_id=client_id,
                user_id=current_user.id,
                type="note",
                direction="outbound",
                contact_value=contact_name,
                summary=summary,
                ai_summary=f"Automatisch verwerkt via Tekst Instructie: {instruction[:100]}",
                occurred_at=datetime.now(timezone.utc),
            )
            db.add(log)
            db.commit()
            result["actions_taken"].append({
                "type": "conversation_log_added",
                "lead_id": client_id,
                "company_name": lead.company_name,
                "summary": summary,
            })
        else:
            result["warnings"].append(f"Client ID {client_id} niet gevonden")
    elif not client_id:
        result["warnings"].append("Geen klant herkend in de instructie. Gebruik @klantnaam om te specificeren.")
    else:
        result["warnings"].append(f"Lage zekerheid ({confidence:.0%}) — geen actie ondernomen")

    return result


@router.post("/generate-report")
async def generate_report(
    lead_id: int,
    report_type: str = "summary",  # summary, compliance, suitability, all
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate on-demand AI report for prospect.
    Types: summary (company overview), compliance (KYC status), suitability (TaperPay/TaperTrade fit), all
    """
    lead = db.query(Lead).options(
        joinedload(Lead.prospect_data).joinedload(ProspectData.currencies)
    ).filter(
        Lead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    prospect_data = lead.prospect_data

    report_prompt = f"""
    Generate a professional business intelligence report for this prospect.

    Company Information:
    - Name: {lead.company_name}
    - Website: {lead.company_website or 'N/A'}
    - Industry: {lead.company_industry or 'N/A'}
    - Country: {lead.company_country or 'N/A'}
    - Description: {lead.company_description or 'N/A'}

    Prospect Status:
    - Pipeline Stage: {lead.pipeline_stage}
    - Priority: {lead.priority}
    - Last Called: {lead.last_called_at or 'Never'}
    - Call Count: {lead.call_count}

    Product Interest:
    - TaperPay Active: {prospect_data.taperpay_active if prospect_data else False}
    - TaperTrade Active: {prospect_data.tapertrade_active if prospect_data else False}

    {f'''Financial Forecast:
    - FX Volume: €{prospect_data.fx_estimated_volume or 'TBD'}
    - FX Margin: {prospect_data.fx_estimated_margin_pct or 'TBD'}%
    - TF Volume: €{prospect_data.tf_estimated_volume or 'TBD'}
    - TF Margin: {prospect_data.tf_estimated_margin_pct or 'TBD'}%
    ''' if prospect_data else ''}

    Generate a {report_type} report with:
    1. Executive summary
    2. Company profile and market position
    3. Product suitability analysis
    4. Revenue opportunity assessment
    5. Next steps and recommendations

    Format as professional markdown report.
    """

    message = get_ai_client().messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4096,
        messages=[
            {"role": "user", "content": report_prompt}
        ]
    )

    report_content = message.content[0].text

    return {
        "lead_id": lead_id,
        "report_type": report_type,
        "report": report_content,
        "generated_at": __import__('datetime').datetime.now(
            __import__('datetime').timezone.utc
        ).isoformat(),
    }
