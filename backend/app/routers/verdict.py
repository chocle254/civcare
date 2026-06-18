from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.verdict import Verdict
from app.models.appointment import Appointment, AppointmentStatus
from app.models.prescription import Prescription
from app.models.doctor import Doctor, DoctorStatus
from app.services.rlhf import submit_ai_rating

router = APIRouter()


class PrescriptionItem(BaseModel):
    name: str
    form:            str | None = "tablet"   # tablet/capsule/liquid/injection/drops
    notes:           str | None = None


class VerdictSubmit(BaseModel):
    doctor_id:        str
    patient_id:       str
    appointment_id:   str
    diagnosis:        str
    severity:         str
    notes:            str | None = None
    prescriptions:    list[PrescriptionItem]
    ai_accuracy_rating: int       # 1 to 5
    ai_rating_comment:  str | None = None


# ── DOCTOR SUBMITS VERDICT ──
@router.post("/submit")
async def submit_verdict(data: VerdictSubmit, db: Session = Depends(get_db)):
    """
    Doctor submits their diagnosis and prescriptions.
    - Prescriptions saved to patient profile (feeds MedScan)
    - AI rating sent to retraining pipeline (RLHF)
    - Doctor status switches back to Available automatically
    - Appointment marked as complete
    """

    # Save verdict
    verdict = Verdict(
        doctor_id=data.doctor_id,
        patient_id=data.patient_id,
        appointment_id=data.appointment_id,
        diagnosis=data.diagnosis,
        severity_confirmed=data.severity,
        notes=data.notes,
        ai_accuracy_rating=data.ai_accuracy_rating,
        ai_rating_comment=data.ai_rating_comment,
        rating_submitted="true",
        submitted_at=datetime.utcnow(),
    )
    db.add(verdict)
    db.flush()

    # Save prescriptions (doctor writes medication name only)
    # Patient will input dosage from pharmacy guidance later
    for rx in data.prescriptions:
        prescription = Prescription(
            patient_id=data.patient_id,
            doctor_id=data.doctor_id,
            verdict_id=verdict.id,
            medication_name=rx.name,
            med_form=rx.form or "tablet",
            notes=rx.notes,
            is_active=True,
        )
        db.add(prescription)

    # Mark appointment complete
    appointment = db.query(Appointment).filter(
        Appointment.id == data.appointment_id
    ).first()
    if appointment:
        appointment.status       = AppointmentStatus.COMPLETED
        appointment.completed_at = datetime.utcnow()

    # Doctor status back to available
    doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id).first()
    if doctor:
        doctor.status = DoctorStatus.AVAILABLE

    db.commit()

    # Send AI rating to retraining pipeline.
    # We also pass the doctor's clinical notes — these often contain vitals
    # (temperature, blood pressure) that CivCare cannot measure, which the
    # self-training loop uses to understand why its prediction may differ.
    await submit_ai_rating(
        rating=data.ai_accuracy_rating,
        comment=data.ai_rating_comment or "",
        diagnosis=data.diagnosis,
        appointment_id=data.appointment_id,
        notes=data.notes or "",
    )

    return {
        "message":    "Verdict submitted successfully.",
        "verdict_id": verdict.id,
    }

# ── PATIENT VIEWS DIAGNOSIS HISTORY ──
@router.get("/history/{patient_id}")
async def get_patient_history(patient_id: str, db: Session = Depends(get_db)):
    """
    Patient views their past diagnoses and verdicts.
    Returns verdicts newest first, with doctor info and severity.
    """
    from app.models.doctor import Doctor
    from app.models.prescription import Prescription
    
    verdicts = db.query(Verdict).filter(
        Verdict.patient_id == patient_id
    ).order_by(Verdict.submitted_at.desc()).all()
    
    result = []
    for v in verdicts:
        doctor = db.query(Doctor).filter(Doctor.id == v.doctor_id).first()
        prescriptions = db.query(Prescription).filter(
            Prescription.verdict_id == v.id
        ).all()
        
        result.append({
            "id": v.id,
            "date": v.submitted_at.isoformat() if v.submitted_at else None,
            "diagnosis": v.diagnosis,
            "severity": v.severity_confirmed,
            "notes": v.notes,
            "doctor_name": doctor.full_name if doctor else "Unknown Doctor",
            "prescriptions": [
                {"name": p.medication_name, "notes": p.notes}
                for p in prescriptions
            ],
            "ai_rating": v.ai_accuracy_rating,
        })
    
    return {"verdicts": result}
