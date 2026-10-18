import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class IdentityType(str, enum.Enum):
    NATIONAL_ID    = "national_id"
    BIRTH_CERT     = "birth_cert"
    CHF_NUMBER     = "chf_number"


class Patient(Base):
    __tablename__ = "patients"

    # ── PRIMARY KEY ──
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # ── IDENTITY ──
    # The actual ID number — national ID, birth cert, or CHF number
    identity_number  = Column(String, unique=True, nullable=False, index=True)
    identity_type    = Column(Enum(IdentityType), nullable=False)

    # ── PERSONAL INFO ──
    full_name        = Column(String, nullable=False)
    phone_number     = Column(String, unique=True, nullable=False, index=True)
    date_of_birth    = Column(String, nullable=True)
    sex              = Column(String, nullable=True)   # "female" / "male"; shapes which conditions are possible
    age              = Column(String, nullable=True)
    allergies        = Column(String, nullable=True)
    allergy_flags    = Column(Text, nullable=True)   # AI-detected allergy/med conflicts for doctor + AI
    location         = Column(String, nullable=True)   # General area e.g Kisumu, Turkana

    # ── ENCRYPTION KEYS ──
    # Key 1 — permanent, held by patient, stored as hash never plain text
    key_one_hash     = Column(String, nullable=False)

    # ── AUTH ──
    otp_code         = Column(String, nullable=True)
    otp_expires_at   = Column(DateTime, nullable=True)
    is_verified      = Column(Boolean, default=False)
    pin_hash         = Column(String, nullable=True)   # 4-digit PIN, salted hash; None on accounts made before PINs

    # ── CONSENT (Data Protection Act 2019, ss. 30, 32, 33, 49) ──
    consent_version  = Column(String, nullable=True)   # privacy notice version the patient agreed to
    consent_at       = Column(DateTime, nullable=True)
    guardian_name    = Column(String, nullable=True)   # parent/guardian who consented for a child under 18
    guardian_relationship = Column(String, nullable=True)
    deleted_at       = Column(DateTime, nullable=True) # set when the patient erased their account

    # ── TIMESTAMPS ──
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── RELATIONSHIPS ──
    appointments     = relationship("Appointment",    back_populates="patient")
    consultations    = relationship("Consultation",   back_populates="patient")
    prescriptions    = relationship("Prescription",   back_populates="patient")
    sessions         = relationship("ChatSession",    back_populates="patient")
    record_accesses  = relationship("RecordAccess",   back_populates="patient")

    def __repr__(self):
        return f"<Patient {self.id}>"
