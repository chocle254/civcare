"""
Who is calling, and may they touch this record?

Every endpoint that reads or changes personal data depends on
`current_user`, then calls one of the `can_*` checks below. The rules:

- A patient may only reach their own records.
- A doctor may reach a patient's records only while they have a care
  relationship: an appointment with them or at their hospital, or an online
  consultation booked with them.
- Requests that name a doctor (doctor_id in the body or query) must come
  from that doctor.

Data Protection Act 2019, s. 41 (data protection by design and by default).
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, WebSocket
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings

_bearer = HTTPBearer(auto_error=False)

SIGN_IN_AGAIN = "Your session has ended. Please sign in again."
NOT_YOURS = "You don't have access to this record."


@dataclass
class Principal:
    id: str
    role: str                 # "patient" or "doctor"
    hospital_id: str | None = None

    @property
    def is_doctor(self) -> bool:
        return self.role == "doctor"

    @property
    def is_patient(self) -> bool:
        return self.role == "patient"


def decode_token(token: str | None) -> Principal | None:
    if not token:
        return None
    try:
        data = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if not data.get("sub") or data.get("role") not in ("patient", "doctor"):
        return None
    return Principal(id=data["sub"], role=data["role"], hospital_id=data.get("hospital_id"))


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Principal:
    user = decode_token(creds.credentials if creds else None)
    if not user:
        raise HTTPException(status_code=401, detail=SIGN_IN_AGAIN)
    return user


def current_doctor(user: Principal = Depends(current_user)) -> Principal:
    if not user.is_doctor:
        raise HTTPException(status_code=403, detail="Only clinicians can do this.")
    return user


def current_patient(user: Principal = Depends(current_user)) -> Principal:
    if not user.is_patient:
        raise HTTPException(status_code=403, detail="Only the patient can do this.")
    return user


def websocket_user(websocket: WebSocket) -> Principal | None:
    return decode_token(websocket.query_params.get("token"))


# ── Checks ──

def must_be_doctor(user: Principal, doctor_id: str | None) -> None:
    """The request names a doctor; it must be the signed-in doctor."""
    if not user.is_doctor or (doctor_id and doctor_id != user.id):
        raise HTTPException(status_code=403, detail="You can only act as yourself.")


def doctor_cares_for(db: Session, doctor_id: str, patient_id: str) -> bool:
    from app.models.appointment import Appointment
    from app.models.consultation import Consultation
    from app.models.doctor import Doctor

    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == True).first()  # noqa: E712
    if not doctor:
        return False
    appt = db.query(Appointment.id).filter(
        Appointment.patient_id == patient_id,
        or_(
            Appointment.doctor_id == doctor_id,
            Appointment.original_doctor_id == doctor_id,
            Appointment.hospital_id == doctor.hospital_id,
        ),
    ).first()
    if appt:
        return True
    consult = db.query(Consultation.id).filter(
        Consultation.patient_id == patient_id, Consultation.doctor_id == doctor_id,
    ).first()
    return bool(consult)


def can_patient(db: Session, user: Principal, patient_id: str | None) -> None:
    """The patient themselves, or a doctor caring for them."""
    if not patient_id:
        raise HTTPException(status_code=400, detail="Patient is missing.")
    if user.is_patient and user.id == patient_id:
        return
    if user.is_doctor and doctor_cares_for(db, user.id, patient_id):
        return
    raise HTTPException(status_code=403, detail=NOT_YOURS)


def only_patient(user: Principal, patient_id: str | None) -> None:
    """Strictly the patient (e.g. their own chat, reminders, erasure)."""
    if not (user.is_patient and user.id == patient_id):
        raise HTTPException(status_code=403, detail=NOT_YOURS)


def can_session(db: Session, user: Principal, session_id: str):
    from app.models.session import ChatSession
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    can_patient(db, user, session.patient_id)
    return session


def can_appointment(db: Session, user: Principal, appointment_id: str):
    from app.models.appointment import Appointment
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    if user.is_patient and appt.patient_id == user.id:
        return appt
    if user.is_doctor and doctor_cares_for(db, user.id, appt.patient_id):
        return appt
    raise HTTPException(status_code=403, detail=NOT_YOURS)


def can_consultation(db: Session, user: Principal, consultation_id: str):
    from app.models.consultation import Consultation
    consult = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    if (user.is_patient and consult.patient_id == user.id) or (user.is_doctor and consult.doctor_id == user.id):
        return consult
    raise HTTPException(status_code=403, detail=NOT_YOURS)


# ── Audit trail ──

def log_access(db: Session, user: Principal | None, patient_id: str, action: str, detail: str | None = None) -> None:
    """Record that someone opened or changed a patient's record. Never fails the request."""
    from app.models.data_access import DataAccessLog
    try:
        name = None
        if user and user.is_doctor:
            from app.models.doctor import Doctor
            d = db.query(Doctor).filter(Doctor.id == user.id).first()
            name = d.full_name if d else None
        db.add(DataAccessLog(
            patient_id=patient_id,
            actor_id=user.id if user else "system",
            actor_role=user.role if user else "system",
            actor_name=name,
            action=action,
            detail=(detail or "")[:500] or None,
        ))
        db.commit()
    except Exception as e:  # logging must not break care
        db.rollback()
        print(f"Access log failed: {type(e).__name__}")
