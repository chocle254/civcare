from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt
from pydantic import BaseModel
from app.database import get_db
from app.models.patient import Patient, IdentityType
from app.models.doctor import Doctor, DoctorStatus
from app.models.hospital import Hospital
from app.services.i18n import clean_lang
from app.services.encryption import generate_key_one
from app.services.security import hash_secret, verify_secret, needs_rehash, is_locked, record_failure, clear_failures
from app.services.authz import Principal, current_patient, current_doctor, log_access
from app.services.consent import PRIVACY_VERSION, has_consent
from app.services.phone import normalize_ke_phone, phone_variants
from app.services.patient_info import patient_age
from app.config import settings
import re

router = APIRouter()

PATIENT_TOKEN_MINUTES = 7 * 24 * 60   # a week; patients come back for reminders
DOCTOR_TOKEN_MINUTES  = 12 * 60       # one shift
LOCKED = "Too many wrong attempts. Wait 15 minutes, then try again."


def _valid_pin(pin: str | None) -> bool:
    return bool(pin) and bool(re.fullmatch(r"\d{4}", pin)) and pin not in ("0000", "1234", "1111")


def _age_from(dob: str | None) -> int | None:
    try:
        d = datetime.strptime(dob or "", "%Y-%m-%d")
    except ValueError:
        return None
    t = datetime.now()
    return t.year - d.year - ((t.month, t.day) < (d.month, d.day))


def _patient_out(patient) -> dict:
    return {
        "id":       patient.id,
        "name":     patient.full_name,
        "phone":    patient.phone_number,
        "location": patient.location,
        "allergies": patient.allergies,
        "sex":      patient.sex,
        "age":      patient_age(patient),
        "date_of_birth": patient.date_of_birth,
        "consent_version": patient.consent_version,
        "needs_consent":   not has_consent(patient),
        "needs_pin":       not patient.pin_hash,
        "language":        patient.language or "en",
    }


def _clean_sex(value: str | None) -> str | None:
    v = (value or "").strip().lower()
    return v if v in ("female", "male") else None


# ── TOKEN HELPER ──
def create_token(data: dict, minutes: int | None = None) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(
        minutes=minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ════════════════════════════════
# PATIENT ENDPOINTS
# ════════════════════════════════

class PatientRegister(BaseModel):
    full_name:       str
    phone_number:    str
    identity_number: str
    identity_type:   str   # national_id / birth_cert / chf_number
    date_of_birth:   str | None = None
    sex:             str | None = None   # female / male
    location:        str | None = None
    allergies:       str | None = None
    pin:             str | None = None   # 4 digits, chosen by the patient
    # Consent to the privacy notice (DPA ss. 30, 32, 49). Required.
    consent:         bool = False
    consent_version: str | None = None
    # A child under 18 needs a parent or guardian to consent (DPA s. 33).
    guardian_name:   str | None = None
    guardian_relationship: str | None = None
    language:        str | None = None   # en / sw / sheng


class PatientLogin(BaseModel):
    phone_number:    str
    identity_number: str
    pin:             str | None = None


# ── PATIENT REGISTER ──
@router.post("/patient/register")
async def register_patient(data: PatientRegister, db: Session = Depends(get_db)):
    """
    Registers a new patient using phone number + identity number.
    No OTP — returns token immediately.
    If patient already exists, returns an error telling them to login instead.
    """
    canonical_phone = normalize_ke_phone(data.phone_number)
    if not canonical_phone:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid Kenyan mobile number, such as 0712 345 678.",
        )
    variants = phone_variants(data.phone_number)
    data.phone_number = canonical_phone

    if not data.consent:
        raise HTTPException(status_code=400, detail="Read and agree to the privacy notice to create an account.")
    if not _valid_pin(data.pin):
        raise HTTPException(status_code=400, detail="Choose a 4-digit PIN. Avoid easy ones like 1234 or 0000, and don't reuse your M-Pesa PIN.")
    age = _age_from(data.date_of_birth)
    is_child = (age is not None and age < 18) or data.identity_type == "birth_cert"
    if is_child and not (data.guardian_name or "").strip():
        raise HTTPException(status_code=400, detail="Patients under 18 need a parent or guardian to agree. Enter their name.")

    # Check phone already registered (in any stored format)
    existing_phone = db.query(Patient).filter(
        Patient.phone_number.in_(variants)
    ).first()
    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered. Please login instead."
        )

    # Check identity number already registered
    existing_id = db.query(Patient).filter(
        Patient.identity_number == data.identity_number
    ).first()
    if existing_id:
        raise HTTPException(
            status_code=400,
            detail="This ID number is already registered. Please login instead."
        )

    # Generate Key 1 — permanent encryption key for this patient
    key_one_hash = generate_key_one(data.identity_number, data.phone_number)

    patient = Patient(
        full_name=data.full_name,
        phone_number=data.phone_number,
        identity_number=data.identity_number,
        identity_type=IdentityType(data.identity_type),
        date_of_birth=data.date_of_birth,
        sex=_clean_sex(data.sex),
        location=data.location,
        allergies=data.allergies,
        language=clean_lang(data.language),
        key_one_hash=key_one_hash,
        is_verified=True,   # No OTP for now — verified on registration
        pin_hash=hash_secret(data.pin),
        consent_version=PRIVACY_VERSION,
        consent_at=datetime.utcnow(),
        guardian_name=(data.guardian_name or "").strip() or None if is_child else None,
        guardian_relationship=(data.guardian_relationship or "").strip() or None if is_child else None,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    token = create_token({"sub": patient.id, "role": "patient"}, PATIENT_TOKEN_MINUTES)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "patient":      _patient_out(patient),
    }


# ── PATIENT LOGIN ──
@router.post("/patient/login")
async def login_patient(data: PatientLogin, db: Session = Depends(get_db)):
    """
    Patient logs in using phone number + identity number.
    Both must match the same account.
    """
    key = "p:" + (normalize_ke_phone(data.phone_number) or data.phone_number)
    if is_locked(key):
        raise HTTPException(status_code=429, detail=LOCKED)

    patient = db.query(Patient).filter(
        Patient.phone_number.in_(phone_variants(data.phone_number)),
        Patient.identity_number == data.identity_number,
        Patient.deleted_at.is_(None),
    ).first()

    # Accounts with a PIN must give it. Accounts made before PINs sign in
    # with phone + ID once, then are asked to set one (needs_pin).
    if not patient or (patient.pin_hash and not verify_secret(data.pin or "", patient.pin_hash)):
        record_failure(key)
        raise HTTPException(
            status_code=401,
            detail="Those details don't match an account. Check your phone number, ID number and PIN."
        )
    clear_failures(key)

    token = create_token({"sub": patient.id, "role": "patient"}, PATIENT_TOKEN_MINUTES)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "patient":      _patient_out(patient),
    }


# ════════════════════════════════
# DOCTOR ENDPOINTS
# ════════════════════════════════

class DoctorRegister(BaseModel):
    full_name:         str
    phone_number:      str
    national_id:       str | None = None   # no longer needed; ignored
    kmpdb_license:     str        # Kenya Medical Practitioners Board license number
    password:          str | None = None   # at least 8 characters
    specialisation:    str | None = None
    hospital_name:     str        # Name of an approved hospital on CivCare
    consultation_fee:  float = 0.0
    shift_start:       str | None = "08:00"
    shift_end:         str | None = "17:00"


class DoctorLogin(BaseModel):
    kmpdb_license: str
    password:      str | None = None
    national_id:   str | None = None   # older app versions sent the password in this field


def _valid_password(pw: str | None) -> bool:
    return bool(pw) and len(pw) >= 8 and not pw.isdigit()


def _doctor_out(doctor, hospital_name: str) -> dict:
    return {
        "id":               doctor.id,
        "name":             doctor.full_name,
        "specialisation":   doctor.specialisation,
        "hospital_id":      doctor.hospital_id,
        "hospital_name":    hospital_name,
        "consultation_fee": doctor.consultation_fee,
        "status":           doctor.status,
        "shift_start":      doctor.shift_start,
        "shift_end":        doctor.shift_end,
        "breaks":           doctor.breaks,
        "must_set_password": doctor.password_set_at is None,
    }


# ── DOCTOR REGISTER ──
@router.post("/doctor/register")
async def register_doctor(data: DoctorRegister, db: Session = Depends(get_db)):
    """
    Doctor registers using their KMPDB license number + National ID.
    The hospital must already be on CivCare (approved by the team).
    No email or password needed for now.
    """
    if not _valid_password(data.password):
        raise HTTPException(status_code=400, detail="Choose a password of at least 8 characters that isn't only numbers.")

    # Check license already registered
    existing = db.query(Doctor).filter(
        Doctor.kmpdb_license == data.kmpdb_license
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This KMPDB license is already registered. Please login instead."
        )

    # The hospital must have joined CivCare and been approved
    from sqlalchemy import or_
    hospital = db.query(Hospital).filter(
        Hospital.name == (data.hospital_name or "").strip(),
        Hospital.is_active == True,  # noqa: E712
        or_(Hospital.status == "approved", Hospital.status.is_(None)),
    ).first()
    if not hospital:
        raise HTTPException(
            status_code=400,
            detail="Your hospital isn't on CivCare yet. Ask your hospital's administrator to register it at /hospital/register.",
        )

    password_hash = hash_secret(data.password)

    doctor = Doctor(
        full_name=re.sub(r"^\s*(dr\.?\s+)+", "", data.full_name.strip(), flags=re.I),
        phone_number=data.phone_number,
        email=f"{data.kmpdb_license}@civtech.local",  # Placeholder email
        kmpdb_license=data.kmpdb_license,
        specialisation=data.specialisation,
        hospital_id=hospital.id,
        consultation_fee=data.consultation_fee,
        password_hash=password_hash,
        password_set_at=datetime.utcnow(),
        is_verified=True,
        is_active=True,
        status=DoctorStatus.OFFLINE,
        shift_start=data.shift_start,
        shift_end=data.shift_end,
        last_active_at=datetime.utcnow(),
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    token = create_token({
        "sub":         doctor.id,
        "role":        "doctor",
        "hospital_id": doctor.hospital_id,
    }, DOCTOR_TOKEN_MINUTES)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "doctor":       _doctor_out(doctor, hospital.name),
    }


# ── DOCTOR LOGIN ──
@router.post("/doctor/login")
async def login_doctor(data: DoctorLogin, db: Session = Depends(get_db)):
    """
    Doctor logs in using KMPDB license number + National ID.
    """
    key = "d:" + data.kmpdb_license.strip().upper()
    if is_locked(key):
        raise HTTPException(status_code=429, detail=LOCKED)

    doctor = db.query(Doctor).filter(
        Doctor.kmpdb_license == data.kmpdb_license
    ).first()

    secret = data.password or data.national_id or ""
    if not doctor or not verify_secret(secret, doctor.password_hash):
        record_failure(key)
        raise HTTPException(
            status_code=401,
            detail="Licence number and password don't match. First time since the update? Use your National ID as the password."
        )
    clear_failures(key)
    if needs_rehash(doctor.password_hash):
        doctor.password_hash = hash_secret(secret)
        db.commit()

    if not doctor.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account is not active. Please contact your hospital administrator."
        )

    # Get hospital name
    hospital = db.query(Hospital).filter(Hospital.id == doctor.hospital_id).first()

    token = create_token({
        "sub":         doctor.id,
        "role":        "doctor",
        "hospital_id": doctor.hospital_id,
    }, DOCTOR_TOKEN_MINUTES)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "doctor":       _doctor_out(doctor, hospital.name if hospital else "Unknown"),
    }


# ════════════════════════════════
# PATIENT PROFILE UPDATE
# ════════════════════════════════

class UpdateProfile(BaseModel):
    patient_id:    str | None = None   # ignored; the signed-in patient is updated
    full_name:     str | None = None
    date_of_birth: str | None = None
    allergies:     str | None = None
    location:      str | None = None
    sex:           str | None = None
    language:      str | None = None   # en / sw / sheng


@router.patch("/patient/profile/update")
async def update_profile(data: UpdateProfile, user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    """The patient corrects their own details (DPA s. 40, right to rectification)."""
    patient = db.query(Patient).filter(Patient.id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    changed = []
    if data.full_name is not None and data.full_name.strip():
        patient.full_name = data.full_name.strip()[:120]; changed.append("name")
    if data.date_of_birth is not None and _age_from(data.date_of_birth) is not None:
        patient.date_of_birth = data.date_of_birth; changed.append("date of birth")
    if data.allergies is not None:
        patient.allergies = data.allergies; changed.append("allergies")
    if data.location is not None:
        patient.location = data.location; changed.append("location")
    if data.sex is not None and _clean_sex(data.sex):
        patient.sex = _clean_sex(data.sex); changed.append("sex")
    if data.language is not None:
        from app.services.i18n import clean_lang
        patient.language = clean_lang(data.language); changed.append("language")
    db.commit()
    if changed:
        log_access(db, user, patient.id, "updated profile", ", ".join(changed))
    return {
        "message":   "Profile updated successfully",
        "allergies": patient.allergies,
        "location":  patient.location,
        "sex":       patient.sex,
        "patient":   _patient_out(patient),
    }


class SetPin(BaseModel):
    pin:         str
    current_pin: str | None = None


@router.post("/patient/set-pin")
async def set_pin(data: SetPin, user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.pin_hash and not verify_secret(data.current_pin or "", patient.pin_hash):
        raise HTTPException(status_code=401, detail="Your current PIN is wrong.")
    if not _valid_pin(data.pin):
        raise HTTPException(status_code=400, detail="Choose a 4-digit PIN. Avoid easy ones like 1234 or 0000, and don't reuse your M-Pesa PIN.")
    patient.pin_hash = hash_secret(data.pin)
    db.commit()
    log_access(db, user, patient.id, "changed PIN")
    return {"message": "PIN saved.", "patient": _patient_out(patient)}


class SetPassword(BaseModel):
    password:         str
    current_password: str


@router.post("/doctor/set-password")
async def set_password(data: SetPassword, user: Principal = Depends(current_doctor), db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == user.id).first()
    if not doctor or not verify_secret(data.current_password, doctor.password_hash):
        raise HTTPException(status_code=401, detail="Your current password is wrong.")
    if not _valid_password(data.password):
        raise HTTPException(status_code=400, detail="Choose a password of at least 8 characters that isn't only numbers.")
    if data.password == data.current_password:
        raise HTTPException(status_code=400, detail="Choose a password different from your current one (and not your National ID).")
    doctor.password_hash = hash_secret(data.password)
    doctor.password_set_at = datetime.utcnow()
    db.commit()
    return {"message": "Password saved.", "must_set_password": False}
