import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from app.database import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    # ── PRIMARY KEY ──
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # ── IDENTITY ──
    name             = Column(String, nullable=False)
    facility_code    = Column(String, unique=True, nullable=False)  # Kenya MoH facility code

    # ── LOCATION ──
    county           = Column(String, nullable=False)
    town             = Column(String, nullable=False)
    address          = Column(String, nullable=True)
    latitude         = Column(Float, nullable=True)   # For patient distance calculation
    longitude        = Column(Float, nullable=True)

    # ── CONTACT ──
    phone_number     = Column(String, nullable=True)
    email            = Column(String, nullable=True)

    # ── STATUS ──
    is_active        = Column(Boolean, default=True)  # CivTech admin can deactivate
    # Hospitals that apply through /hospitals/apply start "pending" and are
    # hidden until the CivCare team approves them; older rows are "approved".
    status           = Column(String, default="approved")   # pending / approved / rejected
    ownership        = Column(String, nullable=True)        # public / private / faith-based / NGO
    level            = Column(String, nullable=True)        # KEPH level, e.g. "Level 4"

    # ── APPLICATION ──
    contact_name     = Column(String, nullable=True)        # person who applied for the hospital
    contact_role     = Column(String, nullable=True)
    contact_phone    = Column(String, nullable=True)
    contact_email    = Column(String, nullable=True)
    applied_at       = Column(DateTime, nullable=True)
    reviewed_at      = Column(DateTime, nullable=True)
    reviewed_by      = Column(String, nullable=True)        # admin email
    review_note      = Column(String, nullable=True)

    # ── TIMESTAMPS ──
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── RELATIONSHIPS ──
    doctors          = relationship("Doctor",       back_populates="hospital")
    appointments     = relationship("Appointment",  back_populates="hospital")

    def __repr__(self):
        return f"<Hospital {self.name} — {self.county}>"
