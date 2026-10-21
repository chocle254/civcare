from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Supabase uses PostgreSQL — SQLAlchemy connects directly
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    import app.models  # noqa: F401  (registers every table, including new ones)
    Base.metadata.create_all(bind=engine)

def run_migrations():
    """Idempotent column additions. Safe to run on every startup —
    Postgres ADD COLUMN IF NOT EXISTS is a no-op if the column exists."""
    from sqlalchemy import text
    statements = [
        "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pills_dispensed INTEGER;",
        "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS med_form TEXT DEFAULT 'tablet';",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergy_flags TEXT;",
        "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS transfer_reason TEXT;",
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS triage_summary TEXT;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex TEXT;",
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS case_file_cache TEXT;",
        # Data protection: PINs, consent, erasure, real doctor passwords
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS pin_hash TEXT;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_version TEXT;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_name TEXT;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS guardian_relationship TEXT;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;",
        "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP;",
        # Hospital applications (hospitals that join through the website)
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ownership TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS level TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_name TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_role TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_phone TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_email TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS reviewed_by TEXT;",
        "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS review_note TEXT;",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS language TEXT;",
        # Names were saved as "Dr. Jane"; the app adds "Dr." itself
        "UPDATE doctors SET full_name = regexp_replace(full_name, '^\\s*(dr\\.?\\s+)+', '', 'i') WHERE full_name ~* '^\\s*dr\\.?\\s';",
        # Notification bookkeeping (each nudge is sent once)
        "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS missed_nudged_at TIMESTAMP;",
        "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS followup_nudged_at TIMESTAMP;",
        # RLHF self-training columns
        "ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS ai_risk_score TEXT;",
        "ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS doctor_notes TEXT;",
        "ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS mismatch BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS mismatch_analysis TEXT;",
        "ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS learned_lesson TEXT;",
        "ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"Migration skipped/failed: {stmt} -> {e}")

