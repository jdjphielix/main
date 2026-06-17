"""
Migration: Add invited_user_ids (JSON) and google_event_id (VARCHAR) columns to callbacks table.
Run once: python migrate_callbacks_calendar.py
"""
import psycopg2, os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://taper_user:taper_secure_2024@db:5432/taperpay_db"
)

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print("Running callbacks calendar migration...")

columns = [
    ("invited_user_ids", "JSON"),
    ("google_event_id",  "VARCHAR(255)"),
]

for col, typ in columns:
    try:
        cur.execute(f"ALTER TABLE callbacks ADD COLUMN {col} {typ};")
        print(f"  Added column: {col}")
    except psycopg2.errors.DuplicateColumn:
        print(f"  Column already exists: {col}")

cur.close()
conn.close()
print("Migration complete!")
