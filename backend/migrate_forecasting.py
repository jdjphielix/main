"""
Migration: Add hedging fields to client_forecasting + create client_deals table.
Run once: python migrate_forecasting.py
"""
import psycopg2, os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://taper_user:taper_secure_2024@db:5432/taperpay_db"
)

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print("Running forecasting migration...")

# Add new columns to client_forecasting (safe: IF NOT EXISTS via try/except per col)
columns = [
    ("spot_margin_pct", "DOUBLE PRECISION DEFAULT 0"),
    ("hedging_pct",     "DOUBLE PRECISION DEFAULT 0"),
    ("hedging_margin_pct", "DOUBLE PRECISION DEFAULT 0"),
]
for col, typ in columns:
    try:
        cur.execute(f"ALTER TABLE client_forecasting ADD COLUMN {col} {typ};")
        print(f"  Added column: {col}")
    except psycopg2.errors.DuplicateColumn:
        print(f"  Column already exists: {col}")

# Create client_deals table
cur.execute("""
CREATE TABLE IF NOT EXISTS client_deals (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    forecasting_item_id INTEGER REFERENCES client_forecasting(id) ON DELETE SET NULL,
    buy_currency VARCHAR(10) NOT NULL,
    sell_currency VARCHAR(10) NOT NULL,
    deal_date DATE NOT NULL,
    volume DOUBLE PRECISION NOT NULL,
    deal_type VARCHAR(50) DEFAULT 'spot',
    margin_pct DOUBLE PRECISION DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER REFERENCES users(id)
);
""")
print("  client_deals table ready.")

cur.close()
conn.close()
print("Migration complete!")
