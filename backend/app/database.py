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
    Base.metadata.create_all(bind=engine)

def run_migrations():
    """Idempotent column additions. Safe to run on every startup —
    Postgres ADD COLUMN IF NOT EXISTS is a no-op if the column exists."""
    from sqlalchemy import text
    statements = [
        "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pills_dispensed INTEGER;",
        "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS med_form TEXT DEFAULT 'tablet';",
        "ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergy_flags TEXT;",
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

