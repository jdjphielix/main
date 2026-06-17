"""Seed database with users, leads across ALL pipeline stages, prospect data, callbacks, notes, activity logs, chat."""

from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole, UserStatus
from app.models.lead import Lead, LeadStatus, PipelineStage, ProspectData, ProspectCurrency
from app.models.communication import CallLog, Note, Communication, Callback, Document, EmailSync
from app.models.notification import AdminSetting, OnboardingRequirement, TeamTarget, Notification, ActivityLog
from app.models.chat import ChatChannel, ChatMember, ChatMessage

NOW = datetime.now(timezone.utc)


def seed_database(force: bool = False):
    """Run all seeders. Pass force=True to reseed (drops existing data)."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if force:
            print("Force reseed: clearing existing data...")
            for model in [
                ChatMessage, ChatMember, ChatChannel,
                ProspectCurrency, ProspectData,
                ActivityLog, Notification, TeamTarget, OnboardingRequirement, AdminSetting,
                Document, EmailSync, Callback, Communication, Note, CallLog,
                Lead, User,
            ]:
                db.query(model).delete()
            db.commit()
            print("  Cleared all tables.")
        else:
            if db.query(User).count() > 0:
                print("Database already seeded. Use force=True to reseed.")
                return

        print("Seeding database...")

        # ═══════════════════════════════════════
        # USERS
        # ═══════════════════════════════════════
        users = [
            User(
                email="jp@taperpay.com",
                full_name="Joost P.",
                role=UserRole.ADMIN_PAY.value,
                status=UserStatus.ACTIVE.value,
                is_teamleader=True,
                language="nl",
            ),
            User(
                email="jvl@taperpay.com",
                full_name="J. van Leeuwen",
                role=UserRole.ADMIN_TRADE.value,
                status=UserStatus.ACTIVE.value,
                is_teamleader=True,
                language="nl",
            ),
            User(
                email="sales1@taperpay.com",
                full_name="Mark de Vries",
                role=UserRole.SALES.value,
                status=UserStatus.ACTIVE.value,
                language="nl",
            ),
            User(
                email="sales2@taperpay.com",
                full_name="Lisa Bakker",
                role=UserRole.SALES.value,
                status=UserStatus.ACTIVE.value,
                language="nl",
            ),
            User(
                email="backoffice1@taperpay.com",
                full_name="Sophie Jansen",
                role=UserRole.BACKOFFICE.value,
                status=UserStatus.ACTIVE.value,
                language="nl",
            ),
        ]
        db.add_all(users)
        db.flush()
        joost, jan, mark, lisa, sophie = users
        print(f"  Created {len(users)} users")

        # ═══════════════════════════════════════
        # LEADS — pipeline_stage = "lead"
        # ═══════════════════════════════════════
        lead_companies = [
            Lead(
                company_name="Van der Berg International Trading BV",
                company_website="https://vanderbergtrading.nl",
                company_country="Netherlands",
                company_industry="International Commodity Trading",
                company_size="50-100",
                company_description="Nederlands handelsbedrijf gespecialiseerd in import en export van agrarische grondstoffen. Opereert in 25+ landen, focus op Oost-Europa en Azië. Opgericht 1998, hoofdkantoor Rotterdam.",
                kvk_number="12345678",
                contact_name="Pieter van der Berg",
                contact_email="p.vanderberg@vdbt.nl",
                contact_phone="+31 10 234 5678",
                contact_mobile="+31 6 1234 5678",
                contact_position="Managing Director",
                status=LeadStatus.CONTACTED.value,
                pipeline_stage=PipelineStage.LEAD.value,
                priority="warm",
                manual_score=7,
                ai_score=7.5,
                ai_score_reasons={"factors": ["Active international trade", "Multi-currency needs", "Growing company"]},
                assigned_user_id=mark.id,
                call_count=2,
                is_called=True,
                last_called_at=NOW - timedelta(days=1),
                source="manual",
            ),
            Lead(
                company_name="Nordic Supply Chain AS",
                company_website="https://nordicsupplychain.no",
                company_country="Norway",
                company_industry="Supply Chain & Logistics",
                company_size="25-50",
                company_description="Noors logistiek bedrijf gericht op supply chain optimalisatie voor Scandinavische exporteurs. Verschepingen naar 40+ landen.",
                contact_name="Erik Johansen",
                contact_email="erik@nordicsupply.no",
                contact_phone="+47 22 33 44 55",
                contact_mobile="+47 900 12 345",
                contact_position="Head of Finance",
                status=LeadStatus.NEW.value,
                pipeline_stage=PipelineStage.LEAD.value,
                priority="cold",
                manual_score=5,
                ai_score=6.2,
                ai_score_reasons={"factors": ["International operations", "Multi-currency needs", "Growing sector"]},
                assigned_user_id=lisa.id,
                call_count=0,
                is_called=False,
                source="manual",
            ),
            Lead(
                company_name="Grupo Exportador Ibérico SL",
                company_website="https://grupoexportador.es",
                company_country="Spain",
                company_industry="Agricultural Export",
                company_size="50-100",
                company_description="Spaans exportbedrijf in olijfolie, wijn en citrusvruchten. Export naar 30+ landen, jaaromzet €45M. Zoekt betere FX-oplossingen voor USD en GBP.",
                contact_name="Carlos Martínez",
                contact_email="c.martinez@grupoexportador.es",
                contact_phone="+34 91 234 56 78",
                contact_mobile="+34 612 345 678",
                contact_position="Director Financiero",
                status=LeadStatus.CALLBACK.value,
                pipeline_stage=PipelineStage.LEAD.value,
                priority="warm",
                manual_score=6,
                ai_score=7.0,
                ai_score_reasons={"factors": ["Large export volume", "Multi-currency needs (USD, GBP)", "Seeking better FX rates"]},
                assigned_user_id=lisa.id,
                call_count=1,
                is_called=True,
                last_called_at=NOW - timedelta(days=3),
                next_callback=NOW + timedelta(days=1),
                source="manual",
            ),
            Lead(
                company_name="Rhein-Cargo Logistics GmbH",
                company_website="https://rheincargo.de",
                company_country="Germany",
                company_industry="Freight & Cargo Logistics",
                company_size="100-250",
                company_description="Duits vrachtbedrijf in Düsseldorf. Intermodale transportoplossingen voor Europese en Aziatische markt. Omzet €80M+.",
                contact_name="Hans Müller",
                contact_email="h.mueller@rheincargo.de",
                contact_phone="+49 211 456 7890",
                contact_mobile="+49 170 123 4567",
                contact_position="Geschäftsführer",
                status=LeadStatus.NEW.value,
                pipeline_stage=PipelineStage.LEAD.value,
                priority="cold",
                manual_score=4,
                ai_score=5.5,
                ai_score_reasons={"factors": ["Large company", "International logistics", "EUR-based, limited FX initially"]},
                assigned_user_id=None,
                call_count=0,
                is_called=False,
                source="import",
            ),
            Lead(
                company_name="Balkanic Fresh Produce EOOD",
                company_website="https://balkanicfresh.bg",
                company_country="Bulgaria",
                company_industry="Fresh Produce Export",
                company_size="10-25",
                company_description="Bulgaars bedrijf gespecialiseerd in export van verse groenten en fruit naar West-Europa. Groeiend bedrijf met toenemende EUR/BGN wisselkoersrisico's.",
                contact_name="Ivana Petrova",
                contact_email="i.petrova@balkanicfresh.bg",
                contact_phone="+359 2 987 6543",
                contact_mobile="+359 88 765 4321",
                contact_position="Finance Manager",
                status=LeadStatus.INTERESTED.value,
                pipeline_stage=PipelineStage.LEAD.value,
                priority="warm",
                manual_score=6,
                ai_score=6.8,
                ai_score_reasons={"factors": ["Growing exports", "FX risk exposure EUR/BGN", "Interested in hedging"]},
                assigned_user_id=mark.id,
                call_count=1,
                is_called=True,
                last_called_at=NOW - timedelta(hours=6),
                source="api",
            ),
        ]
        db.add_all(lead_companies)
        db.flush()
        print(f"  Created {len(lead_companies)} leads (pipeline_stage=lead)")

        # ═══════════════════════════════════════
        # PROSPECTS — pipeline_stage = "prospect"
        # ═══════════════════════════════════════
        prospect_companies = [
            Lead(
                company_name="Meridian Commodities Ltd",
                company_website="https://meridiancommodities.co.uk",
                company_country="United Kingdom",
                company_industry="Commodity Trading & Finance",
                company_size="100-250",
                company_description="London-based trading house in soft commodities, metals, and energy. Portfolio £200M+ annual trades across Europe, Africa, Middle East.",
                kvk_number="UK-09876543",
                contact_name="James Whitfield",
                contact_email="j.whitfield@meridiancomm.co.uk",
                contact_phone="+44 20 7946 0958",
                contact_mobile="+44 7700 900123",
                contact_position="CFO",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.PROSPECT.value,
                priority="hot",
                manual_score=9,
                ai_score=8.8,
                ai_score_reasons={"factors": ["High trade volume", "Multi-currency exposure", "CFO contact", "FX hedging interest"]},
                assigned_user_id=mark.id,
                call_count=5,
                is_called=True,
                last_called_at=NOW - timedelta(hours=4),
                source="manual",
            ),
            Lead(
                company_name="Amara Coffee Trading BV",
                company_website="https://amaracoffee.nl",
                company_country="Netherlands",
                company_industry="Coffee Import & Distribution",
                company_size="25-50",
                company_description="Nederlandse koffie-importeur met directe relaties in Ethiopië, Colombia en Vietnam. Jaarlijks €15M aan imports, voornamelijk in USD. Zoekt FX forward producten en handelsfinanciering.",
                kvk_number="87654321",
                contact_name="Yusuf Abdi",
                contact_email="y.abdi@amaracoffee.nl",
                contact_phone="+31 20 567 8901",
                contact_mobile="+31 6 9876 5432",
                contact_position="CEO & Founder",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.PROSPECT.value,
                priority="hot",
                manual_score=8,
                ai_score=8.2,
                ai_score_reasons={"factors": ["High USD volume", "Trade finance need", "Active FX hedging interest", "CEO direct contact"]},
                assigned_user_id=mark.id,
                call_count=4,
                is_called=True,
                last_called_at=NOW - timedelta(days=2),
                source="manual",
            ),
            Lead(
                company_name="Hellas Marine Supplies SA",
                company_website="https://hellasmarine.gr",
                company_country="Greece",
                company_industry="Marine Equipment & Supplies",
                company_size="50-100",
                company_description="Griekse leverancier van scheepsbenodigdheden en maritieme apparatuur. Exporteert naar rederijen in 20+ landen. Complexe multi-currency betalingen in USD, NOK, SGD.",
                contact_name="Nikos Papadopoulos",
                contact_email="n.papadopoulos@hellasmarine.gr",
                contact_phone="+30 210 123 4567",
                contact_mobile="+30 697 123 4567",
                contact_position="Financial Director",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.PROSPECT.value,
                priority="warm",
                manual_score=7,
                ai_score=7.5,
                ai_score_reasons={"factors": ["Multi-currency complexity (USD, NOK, SGD)", "Maritime sector", "High transaction volume"]},
                assigned_user_id=lisa.id,
                call_count=3,
                is_called=True,
                last_called_at=NOW - timedelta(days=1),
                source="manual",
            ),
        ]
        db.add_all(prospect_companies)
        db.flush()
        print(f"  Created {len(prospect_companies)} prospects")

        # ProspectData for each prospect
        prospect_data_list = [
            ProspectData(
                lead_id=prospect_companies[0].id,  # Meridian
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=5000000,
                fx_estimated_margin_pct=0.35,
                fx_estimated_revenue=17500,
                tf_estimated_volume=2000000,
                tf_estimated_margin_pct=1.5,
                tf_estimated_revenue=30000,
                strategy_notes="Meridian wil Fixed Forwards voor hun kwartaalinkopen in soft commodities. Ook interesse in debtor finance voor hun Afrikaanse afnemers.",
                tf_debtor_finance=True,
                tf_portfolio_finance=False,
                tf_voorraad_finance=True,
                tf_total_financing_need=2000000,
                tf_additional_info="Bestaande relatie met HSBC voor L/C's, maar zoekt aanvullende financiering.",
                selected_broker="ibanfirst",
                broker_feedback="IBANFirst kan hun GBP/USD corridor goed afhandelen. Onboarding loopt.",
            ),
            ProspectData(
                lead_id=prospect_companies[1].id,  # Amara Coffee
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=15000000,
                fx_estimated_margin_pct=0.25,
                fx_estimated_revenue=37500,
                tf_estimated_volume=8000000,
                tf_estimated_margin_pct=2.0,
                tf_estimated_revenue=160000,
                strategy_notes="Amara koopt koffie in USD en verkoopt in EUR. Window Forward aanbevolen voor seizoensgebonden inkoop. Debtor finance voor grote retail afnemers (Albert Heijn, Jumbo).",
                tf_debtor_finance=True,
                tf_portfolio_finance=True,
                tf_voorraad_finance=False,
                tf_total_financing_need=8000000,
                tf_additional_info="ERP systeem is Exact Online. Read-only koppeling mogelijk.",
                selected_broker="corpay",
            ),
            ProspectData(
                lead_id=prospect_companies[2].id,  # Hellas Marine
                taperpay_active=True,
                tapertrade_active=False,
                fx_estimated_volume=3000000,
                fx_estimated_margin_pct=0.40,
                fx_estimated_revenue=12000,
                strategy_notes="Focus op TaperPay FX eerst. Dynamic Forward voor hun USD exposure. NOK en SGD als spot. Later mogelijk interesse in trade finance.",
                selected_broker="ebury",
                broker_feedback="Ebury heeft ervaring met Griekse bedrijven en kan snel onboarden.",
            ),
        ]
        db.add_all(prospect_data_list)
        db.flush()

        # Currencies for prospects
        currencies = [
            # Meridian
            ProspectCurrency(prospect_data_id=prospect_data_list[0].id, currency_type="buying_currency", value="GBP", volume=2000000, notes="Primaire munt"),
            ProspectCurrency(prospect_data_id=prospect_data_list[0].id, currency_type="selling_currency", value="USD", volume=3000000, notes="Commodity aankopen"),
            ProspectCurrency(prospect_data_id=prospect_data_list[0].id, currency_type="incoming_country", value="GB", volume=None),
            ProspectCurrency(prospect_data_id=prospect_data_list[0].id, currency_type="outgoing_country", value="ZA", volume=500000, notes="Zuid-Afrika exports"),
            # Amara Coffee
            ProspectCurrency(prospect_data_id=prospect_data_list[1].id, currency_type="buying_currency", value="EUR", volume=15000000),
            ProspectCurrency(prospect_data_id=prospect_data_list[1].id, currency_type="selling_currency", value="USD", volume=12000000, notes="Koffie-inkoop Colombia, Ethiopië"),
            ProspectCurrency(prospect_data_id=prospect_data_list[1].id, currency_type="incoming_country", value="NL"),
            ProspectCurrency(prospect_data_id=prospect_data_list[1].id, currency_type="outgoing_country", value="ET", notes="Ethiopië"),
            ProspectCurrency(prospect_data_id=prospect_data_list[1].id, currency_type="outgoing_country", value="CO", notes="Colombia"),
            # Hellas Marine
            ProspectCurrency(prospect_data_id=prospect_data_list[2].id, currency_type="buying_currency", value="EUR", volume=3000000),
            ProspectCurrency(prospect_data_id=prospect_data_list[2].id, currency_type="selling_currency", value="USD", volume=2000000),
            ProspectCurrency(prospect_data_id=prospect_data_list[2].id, currency_type="selling_currency", value="NOK", volume=500000),
            ProspectCurrency(prospect_data_id=prospect_data_list[2].id, currency_type="selling_currency", value="SGD", volume=500000),
        ]
        db.add_all(currencies)
        db.flush()
        print("  Created prospect data with currencies")

        # ═══════════════════════════════════════
        # ONBOARDING SALES — pipeline_stage = "onboarding_sales"
        # ═══════════════════════════════════════
        onb_sales_companies = [
            Lead(
                company_name="Atlas Metals & Mining AG",
                company_website="https://atlasmetals.ch",
                company_country="Switzerland",
                company_industry="Metals Trading & Mining",
                company_size="100-250",
                company_description="Zwitsers handelshuis voor non-ferro metalen. Jaaromzet CHF 120M. Opereert via Singapore, Londen en Zürich. Complexe FX en trade finance behoeften.",
                kvk_number="CH-0601234567",
                contact_name="Thomas Keller",
                contact_email="t.keller@atlasmetals.ch",
                contact_phone="+41 44 567 8901",
                contact_mobile="+41 79 234 5678",
                contact_position="Group Treasurer",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.ONBOARDING_SALES.value,
                priority="hot",
                manual_score=9,
                ai_score=9.1,
                ai_score_reasons={"factors": ["Very high volume", "Complex FX needs", "Trade finance candidate"]},
                assigned_user_id=mark.id,
                call_count=7,
                is_called=True,
                last_called_at=NOW - timedelta(hours=2),
                source="manual",
                onboarding_checklist={
                    "contract_signed": True,
                    "kyc_docs_received": True,
                    "iban_requested": True,
                    "compliance_approved": False,
                    "welcome_call_done": False,
                },
            ),
            Lead(
                company_name="Öztürk Textiles Ticaret A.Ş.",
                company_website="https://ozturktextiles.com.tr",
                company_country="Turkey",
                company_industry="Textile Manufacturing & Export",
                company_size="250-500",
                company_description="Turkse textielfabrikant die exporteert naar heel Europa. Jaaromzet €35M. Sterke behoefte aan EUR/TRY hedging en debtor finance.",
                contact_name="Elif Öztürk",
                contact_email="elif@ozturktextiles.com.tr",
                contact_phone="+90 212 345 6789",
                contact_mobile="+90 532 123 4567",
                contact_position="CFO",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.ONBOARDING_SALES.value,
                priority="hot",
                manual_score=8,
                ai_score=8.5,
                ai_score_reasons={"factors": ["High EUR/TRY exposure", "Trade finance need", "Large company"]},
                assigned_user_id=lisa.id,
                call_count=5,
                is_called=True,
                last_called_at=NOW - timedelta(days=1),
                source="manual",
                onboarding_checklist={
                    "contract_signed": True,
                    "kyc_docs_received": False,
                    "iban_requested": False,
                    "compliance_approved": False,
                    "welcome_call_done": True,
                },
            ),
        ]
        db.add_all(onb_sales_companies)
        db.flush()
        print(f"  Created {len(onb_sales_companies)} onboarding_sales leads")

        # ProspectData for onboarding_sales
        onb_sales_pd = [
            ProspectData(
                lead_id=onb_sales_companies[0].id,  # Atlas Metals
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=20000000,
                fx_estimated_margin_pct=0.20,
                fx_estimated_revenue=40000,
                tf_estimated_volume=10000000,
                tf_estimated_margin_pct=1.8,
                tf_estimated_revenue=180000,
                strategy_notes="Atlas wil Fixed Forward en Dynamic Forward voor CHF/USD en CHF/EUR. Trade finance voor goods in transit uit Afrika.",
                tf_debtor_finance=False,
                tf_portfolio_finance=True,
                tf_voorraad_finance=True,
                tf_total_financing_need=10000000,
                selected_broker="ibanfirst",
            ),
            ProspectData(
                lead_id=onb_sales_companies[1].id,  # Öztürk
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=8000000,
                fx_estimated_margin_pct=0.45,
                fx_estimated_revenue=36000,
                tf_estimated_volume=5000000,
                tf_estimated_margin_pct=2.2,
                tf_estimated_revenue=110000,
                strategy_notes="Window Forward voor EUR/TRY exposure. Debtor finance voor Europese retailers. Grote orders met H&M en Primark.",
                tf_debtor_finance=True,
                tf_portfolio_finance=False,
                tf_voorraad_finance=False,
                tf_total_financing_need=5000000,
                selected_broker="corpay",
            ),
        ]
        db.add_all(onb_sales_pd)
        db.flush()

        # ═══════════════════════════════════════
        # ONBOARDING BACKOFFICE — pipeline_stage = "onboarding_backoffice"
        # ═══════════════════════════════════════
        onb_bo_companies = [
            Lead(
                company_name="Durban Fruit Exporters (Pty) Ltd",
                company_website="https://durbanfruit.co.za",
                company_country="South Africa",
                company_industry="Fresh Fruit Export",
                company_size="50-100",
                company_description="Zuid-Afrikaanse exporteur van citrusvruchten en avocado's naar Europa en het Midden-Oosten. Jaaromzet ZAR 250M. FX spot en voorraadfinanciering.",
                kvk_number="ZA-2019/123456",
                contact_name="Sipho Nkosi",
                contact_email="s.nkosi@durbanfruit.co.za",
                contact_phone="+27 31 265 4321",
                contact_mobile="+27 82 345 6789",
                contact_position="Managing Director",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.ONBOARDING_BACKOFFICE.value,
                priority="hot",
                manual_score=8,
                ai_score=8.0,
                ai_score_reasons={"factors": ["High ZAR/EUR volume", "Trade finance need", "Seasonal patterns"]},
                assigned_user_id=mark.id,
                call_count=8,
                is_called=True,
                last_called_at=NOW - timedelta(hours=6),
                source="manual",
                onboarding_checklist={
                    "contract_signed": True,
                    "kyc_docs_received": True,
                    "iban_requested": True,
                    "compliance_approved": True,
                    "welcome_call_done": True,
                    "account_created": True,
                    "iban_active": True,
                    "payment_test": False,
                    "erp_integration": False,
                    "handover_complete": False,
                },
            ),
        ]
        db.add_all(onb_bo_companies)
        db.flush()
        print(f"  Created {len(onb_bo_companies)} onboarding_backoffice leads")

        onb_bo_pd = [
            ProspectData(
                lead_id=onb_bo_companies[0].id,
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=4000000,
                fx_estimated_margin_pct=0.50,
                fx_estimated_revenue=20000,
                tf_estimated_volume=3000000,
                tf_estimated_margin_pct=2.5,
                tf_estimated_revenue=75000,
                strategy_notes="FX Spot voor ZAR/EUR conversies. Voorraadfinanciering voor seizoensgebonden containers (citrus dec-mei). IBANFirst account bijna actief.",
                tf_debtor_finance=False,
                tf_portfolio_finance=False,
                tf_voorraad_finance=True,
                tf_total_financing_need=3000000,
                selected_broker="ibanfirst",
                broker_feedback="Account bij IBANFirst is aangemaakt. IBAN wacht op activatie.",
            ),
        ]
        db.add_all(onb_bo_pd)
        db.flush()

        # ═══════════════════════════════════════
        # CLIENTS — pipeline_stage = "client"
        # ═══════════════════════════════════════
        client_companies = [
            Lead(
                company_name="Rotterdam Port Services BV",
                company_website="https://rotterdamportservices.nl",
                company_country="Netherlands",
                company_industry="Port & Maritime Services",
                company_size="100-250",
                company_description="Full-service havenbedrijf in de Rotterdamse haven. Biedt overslagdiensten, warehousing en logistieke oplossingen. Klant sinds 2024. Actief gebruiker TaperPay.",
                kvk_number="11223344",
                contact_name="Willem de Jong",
                contact_email="w.dejong@rps.nl",
                contact_phone="+31 10 567 8901",
                contact_mobile="+31 6 5678 9012",
                contact_position="CFO",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.CLIENT.value,
                priority="hot",
                manual_score=10,
                ai_score=9.5,
                ai_score_reasons={"factors": ["Active client", "High volume", "Multi-product user"]},
                assigned_user_id=mark.id,
                call_count=15,
                is_called=True,
                last_called_at=NOW - timedelta(days=7),
                source="manual",
                onboarding_checklist={
                    "contract_signed": True,
                    "kyc_docs_received": True,
                    "iban_requested": True,
                    "compliance_approved": True,
                    "welcome_call_done": True,
                    "account_created": True,
                    "iban_active": True,
                    "payment_test": True,
                    "erp_integration": True,
                    "handover_complete": True,
                },
            ),
            Lead(
                company_name="Scandinavia Timber Export AB",
                company_website="https://scandtimber.se",
                company_country="Sweden",
                company_industry="Timber & Wood Products Export",
                company_size="50-100",
                company_description="Zweedse houtexporteur met klanten in heel Europa en Azië. Jaaromzet SEK 200M. Klant sinds 2023. Gebruikt TaperPay voor FX en TaperTrade voor debtor finance.",
                kvk_number="SE-5591234567",
                contact_name="Anna Lindqvist",
                contact_email="a.lindqvist@scandtimber.se",
                contact_phone="+46 8 123 4567",
                contact_mobile="+46 70 234 5678",
                contact_position="Treasury Manager",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.CLIENT.value,
                priority="hot",
                manual_score=9,
                ai_score=9.2,
                ai_score_reasons={"factors": ["Active client", "Multi-product user", "Growing portfolio"]},
                assigned_user_id=lisa.id,
                call_count=12,
                is_called=True,
                last_called_at=NOW - timedelta(days=3),
                source="manual",
                onboarding_checklist={
                    "contract_signed": True,
                    "kyc_docs_received": True,
                    "iban_requested": True,
                    "compliance_approved": True,
                    "welcome_call_done": True,
                    "account_created": True,
                    "iban_active": True,
                    "payment_test": True,
                    "erp_integration": True,
                    "handover_complete": True,
                },
            ),
            Lead(
                company_name="Benelux Pharma Distribution NV",
                company_website="https://beneluxpharma.be",
                company_country="Belgium",
                company_industry="Pharmaceutical Distribution",
                company_size="250-500",
                company_description="Belgische farmaceutische distributeur met leveranciers in India, China en de VS. Jaaromzet €90M. Klant sinds 2024. Intensief gebruik van FX Forward producten.",
                kvk_number="BE-0456789012",
                contact_name="Marc Dupont",
                contact_email="m.dupont@beneluxpharma.be",
                contact_phone="+32 2 345 6789",
                contact_mobile="+32 478 123 456",
                contact_position="Head of Treasury",
                status=LeadStatus.CONVERTED.value,
                pipeline_stage=PipelineStage.CLIENT.value,
                priority="hot",
                manual_score=9,
                ai_score=9.0,
                ai_score_reasons={"factors": ["High volume", "Complex FX needs (USD, INR, CNY)", "Active user"]},
                assigned_user_id=mark.id,
                call_count=10,
                is_called=True,
                last_called_at=NOW - timedelta(days=5),
                source="manual",
                onboarding_checklist={
                    "contract_signed": True,
                    "kyc_docs_received": True,
                    "iban_requested": True,
                    "compliance_approved": True,
                    "welcome_call_done": True,
                    "account_created": True,
                    "iban_active": True,
                    "payment_test": True,
                    "erp_integration": False,
                    "handover_complete": True,
                },
            ),
        ]
        db.add_all(client_companies)
        db.flush()
        print(f"  Created {len(client_companies)} clients")

        # ProspectData for clients
        client_pd = [
            ProspectData(
                lead_id=client_companies[0].id,  # Rotterdam Port Services
                taperpay_active=True,
                tapertrade_active=False,
                fx_estimated_volume=12000000,
                fx_estimated_margin_pct=0.30,
                fx_estimated_revenue=36000,
                strategy_notes="Actieve klant. Gebruikt Fixed Forward voor USD/EUR kwartaalbetalingen. Maandelijks review gesprek. Upsell mogelijkheid: trade finance voor hun expeditie-klanten.",
                selected_broker="ibanfirst",
            ),
            ProspectData(
                lead_id=client_companies[1].id,  # Scandinavia Timber
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=6000000,
                fx_estimated_margin_pct=0.35,
                fx_estimated_revenue=21000,
                tf_estimated_volume=4000000,
                tf_estimated_margin_pct=1.8,
                tf_estimated_revenue=72000,
                strategy_notes="Actieve klant op beide producten. Dynamic Forward voor SEK/EUR. Debtor finance voor hun Aziatische afnemers. Zeer tevreden over service.",
                tf_debtor_finance=True,
                tf_portfolio_finance=False,
                tf_voorraad_finance=True,
                tf_total_financing_need=4000000,
                selected_broker="corpay",
            ),
            ProspectData(
                lead_id=client_companies[2].id,  # Benelux Pharma
                taperpay_active=True,
                tapertrade_active=True,
                fx_estimated_volume=25000000,
                fx_estimated_margin_pct=0.22,
                fx_estimated_revenue=55000,
                tf_estimated_volume=15000000,
                tf_estimated_margin_pct=1.5,
                tf_estimated_revenue=225000,
                strategy_notes="Grootste klant qua volume. Fixed Forward en Window Forward voor USD, INR en CNY. Portfolio-based lending voor hun volledige debiteurenportfolio. Kwartaal review met CFO.",
                tf_debtor_finance=True,
                tf_portfolio_finance=True,
                tf_voorraad_finance=False,
                tf_total_financing_need=15000000,
                selected_broker="ebury",
            ),
        ]
        db.add_all(client_pd)
        db.flush()

        # Currencies for clients
        client_currencies = [
            # Rotterdam Port
            ProspectCurrency(prospect_data_id=client_pd[0].id, currency_type="buying_currency", value="EUR", volume=12000000),
            ProspectCurrency(prospect_data_id=client_pd[0].id, currency_type="selling_currency", value="USD", volume=8000000),
            ProspectCurrency(prospect_data_id=client_pd[0].id, currency_type="selling_currency", value="GBP", volume=2000000),
            # Scandinavia Timber
            ProspectCurrency(prospect_data_id=client_pd[1].id, currency_type="buying_currency", value="SEK", volume=6000000),
            ProspectCurrency(prospect_data_id=client_pd[1].id, currency_type="selling_currency", value="EUR", volume=4000000),
            ProspectCurrency(prospect_data_id=client_pd[1].id, currency_type="selling_currency", value="JPY", volume=1500000),
            # Benelux Pharma
            ProspectCurrency(prospect_data_id=client_pd[2].id, currency_type="buying_currency", value="EUR", volume=25000000),
            ProspectCurrency(prospect_data_id=client_pd[2].id, currency_type="selling_currency", value="USD", volume=15000000),
            ProspectCurrency(prospect_data_id=client_pd[2].id, currency_type="selling_currency", value="INR", volume=5000000),
            ProspectCurrency(prospect_data_id=client_pd[2].id, currency_type="selling_currency", value="CNY", volume=3000000),
        ]
        db.add_all(client_currencies)
        db.flush()

        # ═══════════════════════════════════════
        # CALLBACKS — spread across today and coming days
        # ═══════════════════════════════════════
        all_leads = lead_companies + prospect_companies + onb_sales_companies + onb_bo_companies + client_companies
        today = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time()).replace(tzinfo=timezone.utc)

        callbacks = [
            # Today's callbacks
            Callback(
                lead_id=lead_companies[2].id,  # Grupo Exportador
                created_by_id=lisa.id,
                scheduled_at=today.replace(hour=10, minute=30),
                callback_type="call",
                internal_note="Terugbellen over FX forward mogelijkheden voor USD/EUR",
            ),
            Callback(
                lead_id=prospect_companies[1].id,  # Amara Coffee
                created_by_id=mark.id,
                scheduled_at=today.replace(hour=14, minute=0),
                callback_type="meeting",
                internal_attendees=[joost.id, mark.id],
                internal_note="Pipeline review met Joost. Bespreken trade finance structuur voor Amara.",
                external_attendees=["y.abdi@amaracoffee.nl"],
                external_note="Presentatie trade finance mogelijkheden.",
            ),
            Callback(
                lead_id=onb_sales_companies[0].id,  # Atlas Metals
                created_by_id=mark.id,
                scheduled_at=today.replace(hour=16, minute=0),
                callback_type="call",
                internal_note="Compliance check status navragen bij Sophie. KYC docs bijna compleet.",
            ),
            # Tomorrow
            Callback(
                lead_id=prospect_companies[0].id,  # Meridian
                created_by_id=mark.id,
                scheduled_at=today + timedelta(days=1, hours=11),
                callback_type="meeting",
                internal_attendees=[jan.id, mark.id],
                internal_note="Review FX hedging strategy met Jan van Leeuwen",
                external_attendees=["j.whitfield@meridiancomm.co.uk"],
                external_note="Quarterly FX review meeting",
            ),
            # Day after tomorrow
            Callback(
                lead_id=client_companies[2].id,  # Benelux Pharma
                created_by_id=mark.id,
                scheduled_at=today + timedelta(days=2, hours=9, minutes=30),
                callback_type="meeting",
                internal_attendees=[joost.id, mark.id, sophie.id],
                internal_note="Kwartaal review meeting met grootste klant. Sophie aanwezig voor backoffice vragen.",
                external_attendees=["m.dupont@beneluxpharma.be"],
                external_note="Q2 review: portfolio performance & upcoming currency needs",
            ),
            Callback(
                lead_id=lead_companies[4].id,  # Balkanic Fresh
                created_by_id=mark.id,
                scheduled_at=today + timedelta(days=2, hours=15),
                callback_type="call",
                internal_note="Follow-up op interesse in FX hedging. EUR/BGN forward opties bespreken.",
            ),
        ]
        db.add_all(callbacks)
        db.flush()
        print(f"  Created {len(callbacks)} callbacks")

        # ═══════════════════════════════════════
        # CALL LOGS — recent calls
        # ═══════════════════════════════════════
        call_logs = [
            CallLog(lead_id=lead_companies[0].id, user_id=mark.id, phone_number="+31 6 1234 5678", duration_seconds=420, outcome="answered", notes="Goed gesprek. Pieter is geïnteresseerd in FX forward opties. Volgende stap: offerte sturen.", created_at=NOW - timedelta(days=1)),
            CallLog(lead_id=lead_companies[0].id, user_id=mark.id, phone_number="+31 6 1234 5678", duration_seconds=180, outcome="answered", notes="Eerste kennismaking. Bedrijf heeft grote USD en CNY exposure.", created_at=NOW - timedelta(days=5)),
            CallLog(lead_id=prospect_companies[0].id, user_id=mark.id, phone_number="+44 7700 900123", duration_seconds=600, outcome="answered", notes="James wil concrete offerte voor Fixed Forward GBP/USD Q3. Stuur proposal.", created_at=NOW - timedelta(hours=4)),
            CallLog(lead_id=prospect_companies[1].id, user_id=mark.id, phone_number="+31 6 9876 5432", duration_seconds=900, outcome="answered", notes="Uitgebreid gesprek over trade finance. Yusuf stuurt debiteurenlijst op. ERP koppeling besproken.", created_at=NOW - timedelta(days=2)),
            CallLog(lead_id=onb_sales_companies[0].id, user_id=mark.id, phone_number="+41 79 234 5678", duration_seconds=300, outcome="answered", notes="Thomas bevestigt ontvangst contract. KYC docs volgen deze week. Compliance check loopt.", created_at=NOW - timedelta(hours=2)),
            CallLog(lead_id=onb_sales_companies[1].id, user_id=lisa.id, phone_number="+90 532 123 4567", duration_seconds=480, outcome="answered", notes="Elif stuurt ID en KvK-equivalent volgende week. Welkomstgesprek afgerond.", created_at=NOW - timedelta(days=1)),
            CallLog(lead_id=lead_companies[2].id, user_id=lisa.id, phone_number="+34 612 345 678", duration_seconds=240, outcome="answered", notes="Carlos wil teruggebeld worden over FX forward mogelijkheden. Callback gepland.", created_at=NOW - timedelta(days=3)),
            CallLog(lead_id=lead_companies[4].id, user_id=mark.id, phone_number="+359 88 765 4321", duration_seconds=360, outcome="answered", notes="Ivana heeft interesse. EUR/BGN exposure ~€2M/jaar. Wil info over forward contracts.", created_at=NOW - timedelta(hours=6)),
            CallLog(lead_id=client_companies[0].id, user_id=mark.id, phone_number="+31 6 5678 9012", duration_seconds=180, outcome="answered", notes="Routine check-in. Alles loopt goed. Nieuwe USD forward nodig voor Q3.", created_at=NOW - timedelta(days=7)),
        ]
        db.add_all(call_logs)
        db.flush()
        print(f"  Created {len(call_logs)} call logs")

        # ═══════════════════════════════════════
        # NOTES
        # ═══════════════════════════════════════
        notes = [
            Note(lead_id=prospect_companies[0].id, user_id=mark.id, content="Meridian heeft bestaande relatie met HSBC voor L/C's. Zoekt aanvullende FX en trade finance partner. James (CFO) is de beslisser.", created_at=NOW - timedelta(days=5)),
            Note(lead_id=prospect_companies[0].id, user_id=joost.id, content="Interessante prospect. Hoge volumes. Jan van Leeuwen betrekken bij trade finance gesprek.", created_at=NOW - timedelta(days=3)),
            Note(lead_id=prospect_companies[1].id, user_id=mark.id, content="Amara is een sterke candidate voor zowel TaperPay als TaperTrade. Koffie-import in USD, verkoop in EUR. Seizoensgebonden patronen — window forward ideaal.", created_at=NOW - timedelta(days=4)),
            Note(lead_id=onb_sales_companies[0].id, user_id=mark.id, content="Atlas Metals — contract getekend. KYC docs gedeeltelijk binnen (passport Thomas + UBO declaration). Wachten op bank statement en jaarrekening.", created_at=NOW - timedelta(days=1)),
            Note(lead_id=onb_sales_companies[0].id, user_id=sophie.id, content="IBANFirst account request ingediend. Verwachte activatie: 5-7 werkdagen.", created_at=NOW - timedelta(hours=8)),
            Note(lead_id=onb_bo_companies[0].id, user_id=sophie.id, content="IBAN is actief bij IBANFirst. Testbetaling €1 ingepland voor morgen. ERP koppeling nog in bespreking.", created_at=NOW - timedelta(hours=12)),
            Note(lead_id=client_companies[0].id, user_id=mark.id, content="Willem tevreden over service. Vraagt of we ook trade finance kunnen bieden voor hun expeditie-klanten. Upsell mogelijkheid!", created_at=NOW - timedelta(days=7)),
            Note(lead_id=client_companies[1].id, user_id=lisa.id, content="Anna wil SEK/JPY corridor toevoegen. Nieuwe houtexport contract met Japanse klant.", created_at=NOW - timedelta(days=3)),
            Note(lead_id=client_companies[2].id, user_id=mark.id, content="Q2 review meeting gepland. Marc wil INR hedging strategy bespreken — nieuwe leverancier in India.", created_at=NOW - timedelta(days=5)),
            Note(lead_id=lead_companies[0].id, user_id=mark.id, content="Pieter overweegt om van ING over te stappen naar Taper voor hun FX. Heeft offerte gevraagd voor USD/EUR forward.", created_at=NOW - timedelta(days=1)),
        ]
        db.add_all(notes)
        db.flush()
        print(f"  Created {len(notes)} notes")

        # ═══════════════════════════════════════
        # ACTIVITY LOGS
        # ═══════════════════════════════════════
        activity_logs = [
            ActivityLog(user_id=mark.id, lead_id=prospect_companies[0].id, action="moved", entity_type="lead", entity_id=prospect_companies[0].id, details={"from_stage": "lead", "to_stage": "prospect"}, created_at=NOW - timedelta(days=10)),
            ActivityLog(user_id=mark.id, lead_id=prospect_companies[1].id, action="moved", entity_type="lead", entity_id=prospect_companies[1].id, details={"from_stage": "lead", "to_stage": "prospect"}, created_at=NOW - timedelta(days=8)),
            ActivityLog(user_id=lisa.id, lead_id=prospect_companies[2].id, action="moved", entity_type="lead", entity_id=prospect_companies[2].id, details={"from_stage": "lead", "to_stage": "prospect"}, created_at=NOW - timedelta(days=6)),
            ActivityLog(user_id=mark.id, lead_id=onb_sales_companies[0].id, action="moved", entity_type="lead", entity_id=onb_sales_companies[0].id, details={"from_stage": "prospect", "to_stage": "onboarding_sales"}, created_at=NOW - timedelta(days=3)),
            ActivityLog(user_id=lisa.id, lead_id=onb_sales_companies[1].id, action="moved", entity_type="lead", entity_id=onb_sales_companies[1].id, details={"from_stage": "prospect", "to_stage": "onboarding_sales"}, created_at=NOW - timedelta(days=2)),
            ActivityLog(user_id=mark.id, lead_id=onb_bo_companies[0].id, action="moved", entity_type="lead", entity_id=onb_bo_companies[0].id, details={"from_stage": "onboarding_sales", "to_stage": "onboarding_backoffice"}, created_at=NOW - timedelta(days=1)),
            ActivityLog(user_id=mark.id, lead_id=client_companies[0].id, action="moved", entity_type="lead", entity_id=client_companies[0].id, details={"from_stage": "onboarding_backoffice", "to_stage": "client"}, created_at=NOW - timedelta(days=30)),
            ActivityLog(user_id=lisa.id, lead_id=client_companies[1].id, action="moved", entity_type="lead", entity_id=client_companies[1].id, details={"from_stage": "onboarding_backoffice", "to_stage": "client"}, created_at=NOW - timedelta(days=60)),
            ActivityLog(user_id=mark.id, lead_id=client_companies[2].id, action="moved", entity_type="lead", entity_id=client_companies[2].id, details={"from_stage": "onboarding_backoffice", "to_stage": "client"}, created_at=NOW - timedelta(days=45)),
            # Recent call activities
            ActivityLog(user_id=mark.id, lead_id=lead_companies[0].id, action="called", entity_type="lead", entity_id=lead_companies[0].id, details={"outcome": "answered", "duration": 420}, created_at=NOW - timedelta(days=1)),
            ActivityLog(user_id=mark.id, lead_id=prospect_companies[0].id, action="called", entity_type="lead", entity_id=prospect_companies[0].id, details={"outcome": "answered", "duration": 600}, created_at=NOW - timedelta(hours=4)),
            ActivityLog(user_id=mark.id, lead_id=onb_sales_companies[0].id, action="called", entity_type="lead", entity_id=onb_sales_companies[0].id, details={"outcome": "answered", "duration": 300}, created_at=NOW - timedelta(hours=2)),
            # Note activities
            ActivityLog(user_id=mark.id, lead_id=prospect_companies[0].id, action="created", entity_type="note", entity_id=1, details={"preview": "Meridian heeft bestaande relatie met HSBC..."}, created_at=NOW - timedelta(days=5)),
            ActivityLog(user_id=joost.id, lead_id=prospect_companies[0].id, action="created", entity_type="note", entity_id=2, details={"preview": "Interessante prospect. Hoge volumes..."}, created_at=NOW - timedelta(days=3)),
        ]
        db.add_all(activity_logs)
        db.flush()
        print(f"  Created {len(activity_logs)} activity logs")

        # ═══════════════════════════════════════
        # NOTIFICATIONS
        # ═══════════════════════════════════════
        notifications = [
            Notification(user_id=joost.id, title="Nieuwe prospect", message="Meridian Commodities Ltd is omgezet naar prospect door Mark de Vries", notification_type="status_change", entity_type="lead", entity_id=prospect_companies[0].id, created_at=NOW - timedelta(days=10)),
            Notification(user_id=joost.id, title="Onboarding gestart", message="Atlas Metals & Mining AG is in onboarding geplaatst door Mark de Vries", notification_type="status_change", entity_type="lead", entity_id=onb_sales_companies[0].id, created_at=NOW - timedelta(days=3)),
            Notification(user_id=mark.id, title="Callback vandaag", message="Terugbelafspraak met Amara Coffee Trading BV om 14:00", notification_type="callback", entity_type="callback", entity_id=1, created_at=NOW - timedelta(hours=2)),
            Notification(user_id=sophie.id, title="Document upload", message="KYC documenten ontvangen voor Atlas Metals & Mining AG", notification_type="document", entity_type="lead", entity_id=onb_sales_companies[0].id, created_at=NOW - timedelta(days=1)),
            Notification(user_id=lisa.id, title="Nieuwe lead", message="Balkanic Fresh Produce EOOD is toegevoegd als nieuwe lead", notification_type="status_change", entity_type="lead", entity_id=lead_companies[4].id, created_at=NOW - timedelta(days=2)),
        ]
        db.add_all(notifications)
        db.flush()
        print(f"  Created {len(notifications)} notifications")

        # ═══════════════════════════════════════
        # ADMIN SETTINGS
        # ═══════════════════════════════════════
        admin_settings = [
            AdminSetting(key="inactivity_alert_days", value={"days": 7}, category="alerts", description="Days of inactivity before alert"),
            AdminSetting(key="session_timeout_minutes", value={"minutes": 30}, category="general", description="Session timeout in minutes"),
            AdminSetting(key="max_upload_size_mb", value={"mb": 50}, category="general", description="Max file upload size"),
        ]
        db.add_all(admin_settings)

        # ═══════════════════════════════════════
        # ONBOARDING REQUIREMENTS
        # ═══════════════════════════════════════
        pay_requirements = [
            OnboardingRequirement(name="KvK Uittreksel / Certificate of Incorporation", description="Officieel uittreksel van de Kamer van Koophandel of equivalent", product_type="taperpay", sort_order=1, created_by_id=joost.id),
            OnboardingRequirement(name="UBO Register / Beneficial Ownership", description="Ultimate Beneficial Owner verklaring", product_type="taperpay", sort_order=2, created_by_id=joost.id),
            OnboardingRequirement(name="ID Directie / Directors ID", description="Geldig paspoort of ID van alle directieleden", product_type="taperpay", sort_order=3, created_by_id=joost.id),
            OnboardingRequirement(name="Bankafschrift / Bank Statement", description="Recent bankafschrift (niet ouder dan 3 maanden)", product_type="taperpay", sort_order=4, created_by_id=joost.id),
            OnboardingRequirement(name="Bewijs van Adres / Proof of Address", description="Utiliteitsrekening of officieel document met bedrijfsadres", product_type="taperpay", sort_order=5, created_by_id=joost.id),
            OnboardingRequirement(name="Jaarrekening / Annual Report", description="Meest recente jaarrekening of financieel overzicht", product_type="taperpay", sort_order=6, created_by_id=joost.id),
        ]
        db.add_all(pay_requirements)

        trade_requirements = [
            OnboardingRequirement(name="Handelsovereenkomst / Trade Agreement", description="Kopie van handelsovereenkomsten met leveranciers of afnemers", product_type="tapertrade", sort_order=1, created_by_id=jan.id),
            OnboardingRequirement(name="Debiteurenlijst / Debtor Overview", description="Overzicht van debiteuren met uitstaande bedragen", product_type="tapertrade", sort_order=2, created_by_id=jan.id),
            OnboardingRequirement(name="Kredietverzekering / Credit Insurance", description="Bewijs van kredietverzekering indien aanwezig", product_type="tapertrade", sort_order=3, created_by_id=jan.id),
            OnboardingRequirement(name="Financiële Prognose / Financial Forecast", description="Financiële prognose voor komende 12 maanden", product_type="tapertrade", sort_order=4, created_by_id=jan.id),
            OnboardingRequirement(name="ERP Toegang / ERP Access", description="Read-only toegang tot ERP systeem voor portfolio monitoring", product_type="tapertrade", sort_order=5, created_by_id=jan.id),
        ]
        db.add_all(trade_requirements)

        # ═══════════════════════════════════════
        # TEAM TARGETS
        # ═══════════════════════════════════════
        targets = [
            TeamTarget(target_type="calls_per_week", target_value=40, period="weekly", created_by_id=joost.id, user_id=mark.id),
            TeamTarget(target_type="calls_per_week", target_value=40, period="weekly", created_by_id=joost.id, user_id=lisa.id),
            TeamTarget(target_type="pipeline_value", target_value=500000, period="monthly", created_by_id=joost.id),
            TeamTarget(target_type="conversions", target_value=5, period="monthly", created_by_id=joost.id),
        ]
        db.add_all(targets)

        # ═══════════════════════════════════════
        # CHAT CHANNELS + MESSAGES
        # ═══════════════════════════════════════
        channels = [
            ChatChannel(name="#algemeen", description="Algemeen kanaal voor het hele team", channel_type="channel", created_by_id=joost.id),
            ChatChannel(name="#sales", description="Sales team discussies en updates", channel_type="channel", created_by_id=joost.id),
            ChatChannel(name="#backoffice", description="Backoffice operaties en vragen", channel_type="channel", created_by_id=joost.id),
            ChatChannel(name="#trade-finance", description="Trade finance deals en pipeline", channel_type="channel", created_by_id=jan.id),
        ]
        db.add_all(channels)
        db.flush()

        # Members
        for user in users:
            db.add(ChatMember(channel_id=channels[0].id, user_id=user.id))  # #algemeen: everyone
        for user in [joost, jan, mark, lisa]:
            db.add(ChatMember(channel_id=channels[1].id, user_id=user.id))  # #sales
        for user in [joost, jan, sophie]:
            db.add(ChatMember(channel_id=channels[2].id, user_id=user.id))  # #backoffice
        for user in [joost, jan, mark, lisa, sophie]:
            db.add(ChatMember(channel_id=channels[3].id, user_id=user.id))  # #trade-finance

        db.flush()

        # Sample messages
        messages = [
            ChatMessage(channel_id=channels[0].id, user_id=joost.id, content="Goedemorgen team! Reminder: wekelijkse pipeline review is woensdag om 10:00.", created_at=NOW - timedelta(hours=5)),
            ChatMessage(channel_id=channels[0].id, user_id=mark.id, content="Goedemorgen! Ik heb net een goed gesprek gehad met Atlas Metals. Onboarding loopt voorspoedig.", created_at=NOW - timedelta(hours=4)),
            ChatMessage(channel_id=channels[0].id, user_id=lisa.id, content="Top Mark! Ik heb ook positief nieuws — Öztürk Textiles stuurt volgende week alle KYC docs.", created_at=NOW - timedelta(hours=3, minutes=30)),
            ChatMessage(channel_id=channels[1].id, user_id=mark.id, content="Heads up: Meridian Commodities wil een concrete offerte voor Fixed Forward GBP/USD. Ik stuur vandaag een proposal.", created_at=NOW - timedelta(hours=6)),
            ChatMessage(channel_id=channels[1].id, user_id=joost.id, content="Mooi Mark. Laat me meekijken voor je het stuurt? Wil zeker weten dat de pricing klopt voor deze volumes.", created_at=NOW - timedelta(hours=5, minutes=30)),
            ChatMessage(channel_id=channels[1].id, user_id=mark.id, content="Doe ik! Ik plan vanmiddag een call met James (Meridian CFO) voor de Q3 forward.", created_at=NOW - timedelta(hours=5)),
            ChatMessage(channel_id=channels[2].id, user_id=sophie.id, content="IBANFirst account voor Durban Fruit is actief. Ik plan morgen de testbetaling in.", created_at=NOW - timedelta(hours=8)),
            ChatMessage(channel_id=channels[2].id, user_id=joost.id, content="Perfect Sophie. Houd me op de hoogte van de testresultaten.", created_at=NOW - timedelta(hours=7)),
            ChatMessage(channel_id=channels[3].id, user_id=jan.id, content="Amara Coffee is een interessante case voor structured commodity finance. €8M financing need voor koffie-imports.", created_at=NOW - timedelta(hours=4)),
            ChatMessage(channel_id=channels[3].id, user_id=mark.id, content="Klopt Jan, ik heb vanmiddag een meeting met Yusuf (CEO). Wil je aansluiten?", created_at=NOW - timedelta(hours=3)),
            ChatMessage(channel_id=channels[3].id, user_id=jan.id, content="Ja graag! Stuur me een invite. Ik bereid een voorstel voor.", created_at=NOW - timedelta(hours=2, minutes=45)),
        ]
        db.add_all(messages)

        # ═══════════════════════════════════════
        # DAILY CALL LIST — a few leads on today's list
        # ═══════════════════════════════════════
        today_date = datetime.now(timezone.utc).date()
        lead_companies[0].on_daily_list = True
        lead_companies[0].daily_list_position = 1
        lead_companies[0].daily_list_date = today_date
        lead_companies[0].daily_list_user_id = mark.id

        lead_companies[4].on_daily_list = True
        lead_companies[4].daily_list_position = 2
        lead_companies[4].daily_list_date = today_date
        lead_companies[4].daily_list_user_id = mark.id

        lead_companies[2].on_daily_list = True
        lead_companies[2].daily_list_position = 1
        lead_companies[2].daily_list_date = today_date
        lead_companies[2].daily_list_user_id = lisa.id

        # ═══════════════════════════════════════
        # PINNED LEADS for Joost
        # ═══════════════════════════════════════
        from app.models.user import PinnedLead
        pinned = [
            PinnedLead(user_id=joost.id, lead_id=prospect_companies[0].id, position=1),  # Meridian
            PinnedLead(user_id=joost.id, lead_id=onb_sales_companies[0].id, position=2),  # Atlas Metals
            PinnedLead(user_id=joost.id, lead_id=client_companies[2].id, position=3),  # Benelux Pharma
        ]
        db.add_all(pinned)

        # ═══════════════════════════════════════
        # COMMIT
        # ═══════════════════════════════════════
        db.commit()
        print("\n✅ Database seeded successfully!")
        print(f"  Users:              {len(users)}")
        print(f"  Leads:              {len(lead_companies)}")
        print(f"  Prospects:          {len(prospect_companies)}")
        print(f"  Onboarding Sales:   {len(onb_sales_companies)}")
        print(f"  Onboarding BO:      {len(onb_bo_companies)}")
        print(f"  Clients:            {len(client_companies)}")
        print(f"  Callbacks:          {len(callbacks)}")
        print(f"  Call logs:          {len(call_logs)}")
        print(f"  Notes:              {len(notes)}")
        print(f"  Activity logs:      {len(activity_logs)}")
        print(f"  Notifications:      {len(notifications)}")
        print(f"  Chat channels:      {len(channels)}")
        print(f"  Chat messages:      {len(messages)}")
        print(f"  Onboarding reqs:    {len(pay_requirements) + len(trade_requirements)}")
        print(f"  Team targets:       {len(targets)}")
        print(f"  TOTAL RECORDS:      {sum([len(x) for x in [users, lead_companies, prospect_companies, onb_sales_companies, onb_bo_companies, client_companies, callbacks, call_logs, notes, activity_logs, notifications, channels, messages, pay_requirements, trade_requirements, targets, prospect_data_list, onb_sales_pd, onb_bo_pd, client_pd, currencies, client_currencies, pinned]])}")

    except Exception as e:
        db.rollback()
        print(f"❌ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv or "-f" in sys.argv
    seed_database(force=force)
