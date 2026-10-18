"""
The patient's data protection rights, Data Protection Act 2019:

- consent and its withdrawal (ss. 30, 32), including for a child (s. 33)
- access to and a portable copy of everything held (ss. 26, 38)
- who has opened their record (s. 26, plus the s. 41 audit trail)
- erasure (s. 40)
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient import Patient
from app.services.authz import Principal, current_patient, log_access
from app.services.consent import PRIVACY_VERSION, has_consent

router = APIRouter()


def _iso(dt):
    return dt.isoformat() if dt else None


def _me(db: Session, user: Principal) -> Patient:
    patient = db.query(Patient).filter(Patient.id == user.id, Patient.deleted_at.is_(None)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Account not found.")
    return patient


@router.get("/notice")
async def notice_version():
    return {"version": PRIVACY_VERSION}


class ConsentIn(BaseModel):
    version: str
    agree:   bool
    guardian_name: str | None = None
    guardian_relationship: str | None = None


@router.post("/consent")
async def give_consent(data: ConsentIn, user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    patient = _me(db, user)
    if not data.agree:
        raise HTTPException(status_code=400, detail="Tick the box to agree, or sign out.")
    if data.version != PRIVACY_VERSION:
        raise HTTPException(status_code=409, detail="The privacy notice has changed. Reload the page and read the new version.")
    if data.guardian_name and data.guardian_name.strip():
        patient.guardian_name = data.guardian_name.strip()[:120]
        patient.guardian_relationship = (data.guardian_relationship or "").strip()[:60] or None
    patient.consent_version = PRIVACY_VERSION
    patient.consent_at = datetime.utcnow()
    db.commit()
    log_access(db, user, patient.id, "agreed to privacy notice", PRIVACY_VERSION)
    return {"message": "Thank you. Your choice is saved.", "consent_version": PRIVACY_VERSION, "needs_consent": False}


@router.post("/withdraw-consent")
async def withdraw_consent(user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    """Stops all further processing by the health assistant. Records already
    made by doctors stay (they're clinical records), but nothing new is
    collected until the patient agrees again."""
    patient = _me(db, user)
    patient.consent_at = None
    patient.consent_version = None
    db.commit()
    log_access(db, user, patient.id, "withdrew consent")
    return {"message": "Consent withdrawn. The health assistant is switched off for your account.", "needs_consent": True}


@router.get("/my-data")
async def export_my_data(user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    """Everything CivCare holds about the patient, as one JSON file."""
    from app.models.session import ChatSession
    from app.models.appointment import Appointment
    from app.models.consultation import Consultation
    from app.models.verdict import Verdict
    from app.models.prescription import Prescription, Reminder
    from app.models.medication_outcome import DoseCheckin, CourseOutcome
    from app.models.doctor import Doctor
    from app.models.data_access import DataAccessLog

    p = _me(db, user)
    doctors = {d.id: d.full_name for d in db.query(Doctor).all()}

    def sessions():
        out = []
        for s in db.query(ChatSession).filter(ChatSession.patient_id == p.id).order_by(ChatSession.started_at).all():
            try:
                msgs = json.loads(s.messages or "[]")
            except ValueError:
                msgs = []
            out.append({
                "id": s.id, "started_at": _iso(s.started_at),
                "status": getattr(s.status, "value", s.status),
                "messages": [{"from": m.get("role"), "text": m.get("content")} for m in msgs
                             if m.get("role") in ("patient", "ai")],
            })
        return out

    prescriptions = db.query(Prescription).filter(Prescription.patient_id == p.id).all()
    rx_ids = [x.id for x in prescriptions]
    data = {
        "exported_at": _iso(datetime.utcnow()),
        "privacy_notice_version_agreed": p.consent_version,
        "consent_given_at": _iso(p.consent_at),
        "profile": {
            "name": p.full_name, "phone": p.phone_number,
            "identity_type": getattr(p.identity_type, "value", p.identity_type),
            "identity_number": p.identity_number,
            "date_of_birth": p.date_of_birth, "sex": p.sex, "location": p.location,
            "allergies": p.allergies, "medication_alerts": p.allergy_flags,
            "guardian": p.guardian_name, "guardian_relationship": p.guardian_relationship,
            "created_at": _iso(p.created_at),
        },
        "health_assistant_conversations": sessions(),
        "hospital_visits": [{
            "id": a.id, "status": getattr(a.status, "value", a.status),
            "doctor": doctors.get(a.doctor_id), "arrived_at": _iso(a.arrived_at),
            "transfer_reason": a.transfer_reason,
        } for a in db.query(Appointment).filter(Appointment.patient_id == p.id).all()],
        "online_consultations": [{
            "id": c.id, "doctor": doctors.get(c.doctor_id),
            "status": getattr(c.status, "value", c.status), "fee": c.fee_amount,
            "created_at": _iso(c.created_at), "your_rating": c.patient_rating,
        } for c in db.query(Consultation).filter(Consultation.patient_id == p.id).all()],
        "diagnoses": [{
            "date": _iso(v.submitted_at), "doctor": doctors.get(v.doctor_id),
            "diagnosis": v.diagnosis, "notes": v.notes,
        } for v in db.query(Verdict).filter(Verdict.patient_id == p.id).all()],
        "prescriptions": [{
            "medicine": x.medication_name, "dosage": x.dosage_notation,
            "prescribed_at": _iso(x.prescribed_at), "active": x.is_active, "notes": x.notes,
        } for x in prescriptions],
        "dose_reminders": [{
            "scheduled_at": _iso(r.scheduled_at), "response": r.response, "skip_reason": r.skip_reason,
        } for r in (db.query(Reminder).filter(Reminder.prescription_id.in_(rx_ids)).all() if rx_ids else [])],
        "check_ins": [{
            "date": _iso(c.created_at), "question": c.checkin_question,
            "answer": c.patient_answer, "taken": c.taken,
        } for c in db.query(DoseCheckin).filter(DoseCheckin.patient_id == p.id).all()],
        "treatment_outcomes": [{
            "date": _iso(o.created_at), "medicines": o.medications,
            "still_unwell": o.still_unwell,
        } for o in db.query(CourseOutcome).filter(CourseOutcome.patient_id == p.id).all()],
        "who_opened_your_record": [{
            "when": _iso(l.created_at), "who": l.actor_name or l.actor_role, "what": l.action,
        } for l in db.query(DataAccessLog).filter(DataAccessLog.patient_id == p.id)
            .order_by(DataAccessLog.created_at.desc()).all()],
    }
    log_access(db, user, p.id, "downloaded a copy of their data")
    return data


@router.get("/access-log")
async def access_log(user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    from app.models.data_access import DataAccessLog
    p = _me(db, user)
    rows = db.query(DataAccessLog).filter(DataAccessLog.patient_id == p.id) \
        .order_by(DataAccessLog.created_at.desc()).limit(100).all()
    return {
        "consent_version": p.consent_version,
        "consent_at": _iso(p.consent_at),
        "needs_consent": not has_consent(p),
        "entries": [{
            "when": _iso(r.created_at),
            "who": r.actor_name or ("You" if r.actor_role == "patient" else "CivCare"),
            "role": r.actor_role,
            "what": r.action,
        } for r in rows],
    }


class DeleteIn(BaseModel):
    confirm: str   # the patient types DELETE


@router.post("/delete-account")
async def delete_account(data: DeleteIn, user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    """
    Erases the patient's identity and everything they told the assistant.
    Diagnoses and prescriptions written by doctors are kept, unlinked from
    any name, phone or ID, because health records must be retained by the
    facility; they can no longer be tied back to the person through CivCare.
    """
    from app.models.session import ChatSession
    from app.models.medication_outcome import DoseCheckin
    from app.models.prescription import Prescription

    if (data.confirm or "").strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Type DELETE to confirm.")
    p = _me(db, user)
    stub = f"deleted-{p.id[:8]}"

    for s in db.query(ChatSession).filter(ChatSession.patient_id == p.id).all():
        s.messages = "[]"
        s.triage_summary = None
        s.case_file_cache = None
        s.clash_details = None
        s.ai_assessment = None
    for c in db.query(DoseCheckin).filter(DoseCheckin.patient_id == p.id).all():
        c.patient_answer = None
        c.improved_areas = None
        c.persisting_areas = None
    for rx in db.query(Prescription).filter(Prescription.patient_id == p.id).all():
        rx.reminders_active = False
        rx.is_active = False

    p.full_name = "Deleted patient"
    p.phone_number = stub
    p.identity_number = stub
    p.date_of_birth = None
    p.location = None
    p.allergies = None
    p.allergy_flags = None
    p.guardian_name = None
    p.guardian_relationship = None
    p.pin_hash = None
    p.otp_code = None
    p.consent_at = None
    p.consent_version = None
    p.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Your account and personal details have been erased."}
