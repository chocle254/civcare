"""
The CivCare team's own dashboard: sign-in, platform totals, hospital
applications and the doctor list.

Admins see counts, money and ratings. They never see a patient's name,
phone, ID or record; everything here is either a total or about doctors
and hospitals (Data Protection Act 2019, s. 41: data minimisation).

The first admin is created on startup from ADMIN_EMAIL, ADMIN_PASSWORD and
ADMIN_NAME in Railway's variables. That admin can add the rest of the team.
"""
import os
from collections import Counter
from datetime import datetime, timedelta
from statistics import median

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
from app.models.admin import Admin
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation, ConsultationStatus, PaymentStatus
from app.models.data_access import DataAccessLog
from app.models.doctor import Doctor, DoctorStatus
from app.models.document import MedicalDocument
from app.models.hospital import Hospital
from app.models.medication_outcome import DoseCheckin, CourseOutcome
from app.models.patient import Patient
from app.models.rlhf import AIFeedback
from app.models.session import ChatSession, SessionStatus
from app.models.verdict import Verdict
from app.services.authz import Principal, current_admin
from app.services.security import hash_secret, verify_secret, is_locked, record_failure, clear_failures

router = APIRouter()

ADMIN_TOKEN_MINUTES = 8 * 60
NAIROBI = timedelta(hours=3)
PAID = (PaymentStatus.PAID, PaymentStatus.RELEASED)


def _valid_password(pw: str | None) -> bool:
    return bool(pw) and len(pw) >= 10 and not pw.isdigit()


def ensure_bootstrap_admin() -> None:
    """Create the first admin from Railway variables, once. Never overwrites."""
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or ""
    if not email or not password:
        return
    if not _valid_password(password):
        print("ADMIN_PASSWORD is too weak (10+ characters, not only numbers); no admin created.")
        return
    db = SessionLocal()
    try:
        if not db.query(Admin).filter(Admin.email == email).first():
            db.add(Admin(email=email, full_name=os.environ.get("ADMIN_NAME") or "CivCare admin",
                         password_hash=hash_secret(password)))
            db.commit()
            print("Admin account created from ADMIN_EMAIL.")
    finally:
        db.close()


# ── Sign-in ──

class AdminLogin(BaseModel):
    email: str
    password: str


@router.post("/login")
async def admin_login(data: AdminLogin, db: Session = Depends(get_db)):
    from app.routers.auth import create_token
    email = (data.email or "").strip().lower()
    key = f"admin:{email}"
    if is_locked(key):
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Try again in 15 minutes.")
    admin = db.query(Admin).filter(Admin.email == email).first()
    if not admin or not admin.is_active or not verify_secret(data.password, admin.password_hash):
        record_failure(key)
        raise HTTPException(status_code=401, detail="Email or password is wrong.")
    clear_failures(key)
    admin.last_login_at = datetime.utcnow()
    db.commit()
    token = create_token({"sub": admin.id, "role": "admin"}, ADMIN_TOKEN_MINUTES)
    return {"access_token": token, "admin": {"id": admin.id, "email": admin.email, "full_name": admin.full_name}}


class NewAdmin(BaseModel):
    email: str
    full_name: str
    password: str


@router.get("/team")
async def list_team(user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    return [
        {"id": a.id, "email": a.email, "full_name": a.full_name, "is_active": a.is_active,
         "last_login_at": _iso(a.last_login_at)}
        for a in db.query(Admin).order_by(Admin.created_at).all()
    ]


@router.post("/team")
async def add_admin(data: NewAdmin, user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    email = (data.email or "").strip().lower()
    if "@" not in email or not data.full_name.strip():
        raise HTTPException(status_code=400, detail="Enter a name and a valid email.")
    if not _valid_password(data.password):
        raise HTTPException(status_code=400, detail="Use a password of at least 10 characters that isn't only numbers.")
    if db.query(Admin).filter(Admin.email == email).first():
        raise HTTPException(status_code=400, detail="That email already has an admin account.")
    db.add(Admin(email=email, full_name=data.full_name.strip(), password_hash=hash_secret(data.password)))
    db.commit()
    return {"message": f"{data.full_name.strip()} can now sign in."}


# ── Helpers ──

def _iso(dt):
    return dt.isoformat() + "Z" if dt else None


def _since(days: int):
    return datetime.utcnow() - timedelta(days=days) if days > 0 else None


def _in(q, col, start):
    return q.filter(col >= start) if start is not None else q


def _day(dt) -> str:
    return (dt + NAIROBI).strftime("%Y-%m-%d")


def _series(dates, days: int) -> list:
    """Daily counts (Nairobi days) for the period; all-time shows the last 90 days."""
    span = days if 0 < days <= 90 else 90
    counts = Counter(_day(d) for d in dates if d)
    today = datetime.utcnow() + NAIROBI
    out = []
    for i in range(span - 1, -1, -1):
        k = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        out.append({"date": k, "count": counts.get(k, 0)})
    return out


def _stars(values) -> dict:
    nums = []
    for v in values:
        try:
            n = int(float(v))
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 5:
            nums.append(n)
    dist = Counter(nums)
    return {
        "count": len(nums),
        "average": round(sum(nums) / len(nums), 2) if nums else None,
        "distribution": {str(k): dist.get(k, 0) for k in range(1, 6)},
    }


def _minutes(pairs) -> dict:
    mins = [(b - a).total_seconds() / 60 for a, b in pairs if a and b and b >= a]
    mins.sort()
    if not mins:
        return {"count": 0, "median": None, "p90": None}
    return {"count": len(mins), "median": round(median(mins)), "p90": round(mins[int(0.9 * (len(mins) - 1))])}


def _status_counts(rows) -> dict:
    return {getattr(k, "value", k) or "unknown": n for k, n in rows}


# ── Overview ──

@router.get("/overview")
async def overview(days: int = 30, user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    """Everything the team should watch, for the last `days` days (0 = all time)."""
    days = max(0, min(days, 3650))
    start = _since(days)

    # Patients (erased accounts are counted separately and never as active)
    live = db.query(Patient).filter(Patient.deleted_at.is_(None))
    new_dates = [r[0] for r in _in(db.query(Patient.created_at), Patient.created_at, start).all()]
    active_ids = {r[0] for r in _in(db.query(ChatSession.patient_id), ChatSession.started_at, start).all()}
    patients = {
        "total": live.count(),
        "new": len(new_dates),
        "active": len(active_ids),
        "deleted": _in(db.query(Patient).filter(Patient.deleted_at.isnot(None)), Patient.deleted_at, start).count(),
        "without_consent": live.filter(Patient.consent_at.is_(None)).count(),
        "series": _series(new_dates, days),
    }

    # Assistant conversations
    sq = _in(db.query(ChatSession), ChatSession.started_at, start)
    session_dates = [r[0] for r in _in(db.query(ChatSession.started_at), ChatSession.started_at, start).all()]
    triage = {
        "conversations": sq.count(),
        "completed": sq.filter(ChatSession.status == SessionStatus.COMPLETED).count(),
        "abandoned": sq.filter(ChatSession.status == SessionStatus.ABANDONED).count(),
        "sent_to_hospital": sq.filter(ChatSession.routed_to_hospital_id.isnot(None)).count(),
        "sent_online": sq.filter(ChatSession.routed_to_consultation == True).count(),  # noqa: E712
        "series": _series(session_dates, days),
    }

    # Hospital visits (referrals from the assistant to a hospital)
    aq = _in(db.query(Appointment), Appointment.created_at, start)
    times = _in(db.query(Appointment.arrived_at, Appointment.called_at, Appointment.completed_at),
                Appointment.created_at, start).all()
    visits = {
        "total": aq.count(),
        "by_status": _status_counts(_in(db.query(Appointment.status, func.count(Appointment.id)),
                                        Appointment.created_at, start).group_by(Appointment.status).all()),
        "transferred": aq.filter(Appointment.redirect_reason.in_(("transfer_doctor", "transfer_hospital"))).count(),
        "reassigned": aq.filter(Appointment.redirect_reason.in_(("break", "shift_end", "offline"))).count(),
        "no_doctor": aq.filter(Appointment.doctor_id.is_(None)).count(),
        "wait_to_call": _minutes((a, c) for a, c, _ in times),
        "call_to_done": _minutes((c, d) for _, c, d in times),
    }

    # Online consultations and money (KES)
    cq = _in(db.query(Consultation), Consultation.created_at, start)
    paid = cq.filter(Consultation.payment_status.in_(PAID))
    money_row = paid.with_entities(
        func.coalesce(func.sum(Consultation.fee_amount), 0),
        func.coalesce(func.sum(Consultation.platform_commission), 0),
        func.coalesce(func.sum(Consultation.doctor_payout), 0),
    ).first()
    refunded = cq.filter(Consultation.payment_status == PaymentStatus.REFUNDED)
    refund_sum = refunded.with_entities(func.coalesce(func.sum(Consultation.fee_amount), 0)).scalar()
    paid_dates = [r[0] for r in _in(db.query(Consultation.paid_at).filter(Consultation.payment_status.in_(PAID)),
                                    Consultation.paid_at, start).all()]
    consultations = {
        "total": cq.count(),
        "by_status": _status_counts(_in(db.query(Consultation.status, func.count(Consultation.id)),
                                        Consultation.created_at, start).group_by(Consultation.status).all()),
    }
    money = {
        "currency": "KES",
        "mode": "test" if (settings.MPESA_ENVIRONMENT or "").lower() == "sandbox" else "live",
        "paid_count": paid.count(),
        "collected": round(float(money_row[0]), 2),
        "commission": round(float(money_row[1]), 2),
        "doctor_payouts": round(float(money_row[2]), 2),
        "held_in_escrow": round(float(cq.filter(Consultation.payment_status == PaymentStatus.PAID)
                                      .with_entities(func.coalesce(func.sum(Consultation.fee_amount), 0)).scalar()), 2),
        "refunded_count": refunded.count(),
        "refunded": round(float(refund_sum), 2),
        "awaiting_payment": cq.filter(Consultation.payment_status == PaymentStatus.PENDING).count(),
        "by_method": _status_counts(paid.with_entities(Consultation.payment_method, func.count(Consultation.id))
                                    .group_by(Consultation.payment_method).all()),
        "series": _series(paid_dates, days),
    }

    # Ratings
    patient_ratings = [r[0] for r in _in(db.query(Consultation.patient_rating)
                                         .filter(Consultation.patient_rating.isnot(None)), Consultation.created_at, start).all()]
    ai_ratings = [r[0] for r in _in(db.query(Verdict.ai_accuracy_rating)
                                    .filter(Verdict.ai_accuracy_rating.isnot(None)), Verdict.submitted_at, start).all()]
    fq = _in(db.query(AIFeedback), AIFeedback.created_at, start)
    fb_total = fq.count()
    ratings = {
        "patients": _stars(patient_ratings),
        "ai_accuracy": _stars(ai_ratings),
        "ai_disagreements": fq.filter(AIFeedback.mismatch == True).count(),  # noqa: E712
        "ai_reviews": fb_total,
    }

    # Follow-up after the visit
    dq = _in(db.query(DoseCheckin), DoseCheckin.created_at, start)
    oq = _in(db.query(CourseOutcome), CourseOutcome.created_at, start)
    checkins = dq.count()
    follow_up = {
        "dose_checkins": checkins,
        "doses_taken": dq.filter(DoseCheckin.taken == True).count(),  # noqa: E712
        "feeling_worse": dq.filter(DoseCheckin.sentiment.in_(("worse", "side_effect"))).count(),
        "courses_finished": oq.count(),
        "still_unwell": oq.filter(CourseOutcome.still_unwell == True).count(),  # noqa: E712
        "came_back": oq.filter(CourseOutcome.rerouted == True).count(),  # noqa: E712
    }

    # Clinicians and hospitals
    doctors_q = db.query(Doctor)
    doctors = {
        "total": doctors_q.count(),
        "active": doctors_q.filter(Doctor.is_active == True).count(),  # noqa: E712
        "available_now": doctors_q.filter(Doctor.is_active == True, Doctor.status == DoctorStatus.AVAILABLE).count(),  # noqa: E712
        "on_id_password": doctors_q.filter(Doctor.is_active == True, Doctor.password_set_at.is_(None)).count(),  # noqa: E712
        "new": _in(doctors_q, Doctor.created_at, start).count(),
    }
    hospitals = _status_counts(db.query(Hospital.status, func.count(Hospital.id)).group_by(Hospital.status).all())

    # Records and privacy
    records = {
        "uploaded": _in(db.query(MedicalDocument), MedicalDocument.uploaded_at, start).count(),
        "patients_with_records": db.query(func.count(func.distinct(MedicalDocument.patient_id))).scalar() or 0,
        "storage_mb": round((db.query(func.coalesce(func.sum(MedicalDocument.size_bytes), 0)).scalar() or 0) / 1_048_576, 1),
    }
    privacy = {
        "record_opens": _in(db.query(DataAccessLog), DataAccessLog.created_at, start).count(),
    }

    # Things that need someone to act
    alerts = []
    pending = hospitals.get("pending", 0)
    if pending:
        alerts.append({"level": "action", "text": f"{pending} hospital application{'s' if pending != 1 else ''} waiting for review", "tab": "hospitals"})
    if doctors["on_id_password"]:
        alerts.append({"level": "warning", "text": (f"{doctors['on_id_password']} doctors still sign in with their National ID" if doctors["on_id_password"] != 1 else "1 doctor still signs in with their National ID"), "tab": "doctors"})
    if visits["no_doctor"]:
        alerts.append({"level": "warning", "text": f"{visits['no_doctor']} hospital visit{'s' if visits['no_doctor'] != 1 else ''} had no doctor available", "tab": "overview"})
    low = sum(ratings["patients"]["distribution"][k] for k in ("1", "2"))
    if low:
        alerts.append({"level": "warning", "text": f"{low} patient rating{'s' if low != 1 else ''} of 1 or 2 stars", "tab": "feedback"})
    if follow_up["feeling_worse"]:
        alerts.append({"level": "warning", "text": f"{follow_up['feeling_worse']} check-in{'s' if follow_up['feeling_worse'] != 1 else ''} where the patient felt worse or had side effects", "tab": "overview"})
    if money["mode"] == "test":
        alerts.append({"level": "info", "text": "Payments are in test mode (M-Pesa sandbox); no real money moves", "tab": "overview"})
    if not settings.sms_live:
        alerts.append({"level": "info", "text": "SMS isn't connected: PIN and password reset codes are shown on screen, and no SMS reminders go out", "tab": "overview"})
    if os.environ.get("KNH_TEST_ROUTING", "1") != "0":
        alerts.append({"level": "info", "text": "Test routing is on: every Kenyatta National Hospital visit goes to the test doctor", "tab": "overview"})

    return {
        "period_days": days,
        "generated_at": _iso(datetime.utcnow()),
        "patients": patients, "triage": triage, "visits": visits,
        "consultations": consultations, "money": money, "ratings": ratings,
        "follow_up": follow_up, "doctors": doctors, "hospitals": hospitals,
        "records": records, "privacy": privacy, "alerts": alerts,
    }


# ── Hospitals ──

def _hospital_out(h: Hospital, doctors: int, visits: int) -> dict:
    return {
        "id": h.id, "name": h.name, "facility_code": h.facility_code,
        "county": h.county, "town": h.town, "address": h.address,
        "latitude": h.latitude, "longitude": h.longitude,
        "phone_number": h.phone_number, "email": h.email,
        "ownership": h.ownership, "level": h.level,
        "status": h.status or "approved", "is_active": h.is_active,
        "contact_name": h.contact_name, "contact_role": h.contact_role,
        "contact_phone": h.contact_phone, "contact_email": h.contact_email,
        "applied_at": _iso(h.applied_at), "reviewed_at": _iso(h.reviewed_at),
        "reviewed_by": h.reviewed_by, "review_note": h.review_note,
        "created_at": _iso(h.created_at),
        "doctors": doctors, "visits": visits,
    }


@router.get("/hospitals")
async def list_hospitals(user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    docs = dict(db.query(Doctor.hospital_id, func.count(Doctor.id)).group_by(Doctor.hospital_id).all())
    visits = dict(db.query(Appointment.hospital_id, func.count(Appointment.id)).group_by(Appointment.hospital_id).all())
    rows = db.query(Hospital).order_by(Hospital.created_at.desc()).all()
    order = {"pending": 0, "approved": 1, "rejected": 2}
    rows.sort(key=lambda h: order.get(h.status or "approved", 3))
    return [_hospital_out(h, docs.get(h.id, 0), visits.get(h.id, 0)) for h in rows]


class Review(BaseModel):
    decision: str           # approve / reject / suspend / reactivate
    note: str | None = None


@router.post("/hospitals/{hospital_id}/review")
async def review_hospital(hospital_id: str, data: Review, user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found.")
    admin = db.query(Admin).filter(Admin.id == user.id).first()
    if data.decision in ("approve", "reactivate"):
        h.status, h.is_active = "approved", True
    elif data.decision == "reject":
        if not (data.note or "").strip():
            raise HTTPException(status_code=400, detail="Say why, so the hospital knows what to fix.")
        h.status, h.is_active = "rejected", False
    elif data.decision == "suspend":
        h.is_active = False
    else:
        raise HTTPException(status_code=400, detail="Unknown decision.")
    h.reviewed_at = datetime.utcnow()
    h.reviewed_by = admin.email if admin else user.id
    h.review_note = (data.note or "").strip()[:500] or None
    db.commit()
    return {"message": "Saved.", "status": h.status, "is_active": h.is_active}


# ── Doctors ──

@router.get("/doctors")
async def list_doctors(user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    names = dict(db.query(Hospital.id, Hospital.name).all())
    ratings: dict[str, list] = {}
    for doc_id, r in db.query(Consultation.doctor_id, Consultation.patient_rating).filter(Consultation.patient_rating.isnot(None)).all():
        ratings.setdefault(doc_id, []).append(r)
    consults = dict(db.query(Consultation.doctor_id, func.count(Consultation.id)).group_by(Consultation.doctor_id).all())
    seen = dict(db.query(Verdict.doctor_id, func.count(Verdict.id)).group_by(Verdict.doctor_id).all())
    out = []
    for d in db.query(Doctor).order_by(Doctor.created_at.desc()).all():
        st = _stars(ratings.get(d.id, []))
        out.append({
            "id": d.id, "full_name": d.full_name, "kmpdb_license": d.kmpdb_license,
            "specialisation": d.specialisation, "hospital": names.get(d.hospital_id, "—"),
            "is_active": d.is_active, "status": getattr(d.status, "value", d.status),
            "on_id_password": d.password_set_at is None,
            "last_active_at": _iso(d.last_active_at), "created_at": _iso(d.created_at),
            "consultation_fee": d.consultation_fee,
            "patients_seen": seen.get(d.id, 0), "consultations": consults.get(d.id, 0),
            "patient_rating": st["average"], "patient_ratings": st["count"],
        })
    return out


class Active(BaseModel):
    active: bool


@router.post("/doctors/{doctor_id}/active")
async def set_doctor_active(doctor_id: str, data: Active, user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    d = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    d.is_active = data.active
    if not data.active:
        d.status = DoctorStatus.OFFLINE
    db.commit()
    return {"message": "Saved.", "is_active": d.is_active}


# ── Feedback ──

@router.get("/feedback")
async def feedback(days: int = 90, user: Principal = Depends(current_admin), db: Session = Depends(get_db)):
    """Recent ratings with their comments. No patient names; patients are not identified here."""
    start = _since(max(0, days))
    doctors = {d.id: (d.full_name, d.hospital_id) for d in db.query(Doctor).all()}
    hospitals = dict(db.query(Hospital.id, Hospital.name).all())

    def who(doctor_id):
        name, hid = doctors.get(doctor_id, ("—", None))
        return name, hospitals.get(hid, "—")

    patients = []
    for c in _in(db.query(Consultation).filter(Consultation.patient_rating.isnot(None)), Consultation.created_at, start) \
            .order_by(Consultation.created_at.desc()).limit(100).all():
        name, hosp = who(c.doctor_id)
        patients.append({"stars": c.patient_rating, "comment": c.patient_feedback, "doctor": name,
                         "hospital": hosp, "date": _iso(c.completed_at or c.created_at)})

    doctors_on_ai = []
    for v in _in(db.query(Verdict).filter(Verdict.ai_accuracy_rating.isnot(None)), Verdict.submitted_at, start) \
            .order_by(Verdict.submitted_at.desc()).limit(100).all():
        name, hosp = who(v.doctor_id)
        doctors_on_ai.append({"stars": v.ai_accuracy_rating, "comment": v.ai_rating_comment, "doctor": name,
                              "hospital": hosp, "date": _iso(v.submitted_at)})
    return {"patients": patients, "doctors_on_ai": doctors_on_ai}
