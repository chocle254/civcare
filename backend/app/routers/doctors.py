from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.doctor import Doctor, DoctorStatus
from app.models.appointment import Appointment, AppointmentStatus

router = APIRouter()


class StatusUpdate(BaseModel):
    doctor_id: str
    status:    str   # available / on_break / offline


class RedirectPatients(BaseModel):
    doctor_id:    str
    hospital_id:  str
    reason:       str   # break / shift_end / offline


# ── GET AVAILABLE DOCTORS FOR CONSULTATION ──
@router.get("/available")
async def get_available_doctors(hospital_id: str = None, db: Session = Depends(get_db)):
    """
    Returns doctors who are currently available.
    Used by consultation section to show patient who they can call.
    If hospital_id is passed, filters to that hospital only.
    """
    query = db.query(Doctor).filter(
        Doctor.status    == DoctorStatus.AVAILABLE,
        Doctor.is_active == True,
    )
    if hospital_id:
        query = query.filter(Doctor.hospital_id == hospital_id)

    doctors = query.all()

    return [
        {
            "id":               d.id,
            "name":             d.full_name,
            "specialisation":   d.specialisation,
            "consultation_fee": d.consultation_fee,
            "hospital_id":      d.hospital_id,
            "status":           d.status,
        }
        for d in doctors
    ]


# ── UPDATE DOCTOR STATUS ──
@router.patch("/status")
async def update_status(data: StatusUpdate, db: Session = Depends(get_db)):
    """
    Doctor manually updates their availability status.
    Also called automatically by the system when they open/close patient profiles.
    """
    doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    doctor.status         = DoctorStatus(data.status)
    doctor.last_active_at = datetime.utcnow()
    db.commit()

    from app.websocket.queue import broadcast_queue_update
    await broadcast_queue_update(doctor.hospital_id)

    return {"message": f"Status updated to {data.status}", "status": data.status}


# ── REDIRECT ALL PATIENTS (doctor going on break or ending shift) ──
@router.post("/redirect-patients")
async def redirect_patients(data: RedirectPatients, db: Session = Depends(get_db)):
    """
    Called when doctor goes on break or ends shift.
    Silently reassigns all their pending patients to next available doctor.
    Patient never knows their doctor changed — they just get called by whoever is now assigned.
    """
    # Get all pending appointments for this doctor
    pending = db.query(Appointment).filter(
        Appointment.doctor_id == data.doctor_id,
        Appointment.status.in_([
            AppointmentStatus.PENDING,
            AppointmentStatus.ARRIVED,
        ])
    ).all()

    if not pending:
        return {"message": "No pending patients to redirect.", "redirected": 0}

    # Find next available doctor in the same hospital
    next_doctor = db.query(Doctor).filter(
        Doctor.hospital_id == data.hospital_id,
        Doctor.status       == DoctorStatus.AVAILABLE,
        Doctor.id           != data.doctor_id,
        Doctor.is_active    == True,
    ).first()

    if not next_doctor:
        return {
            "message":    "No available doctors found. Patients remain in queue.",
            "redirected": 0,
        }

    # Silently reassign all pending patients
    redirected_count = 0
    for appt in pending:
        appt.original_doctor_id = appt.doctor_id   # Track who was originally assigned
        appt.doctor_id          = next_doctor.id
        appt.redirect_reason    = data.reason
        appt.redirect_count     = str(int(appt.redirect_count or "0") + 1)
        appt.status             = AppointmentStatus.ARRIVED  # Keep them in queue
        redirected_count += 1

    # Update doctor status
    doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id).first()
    if data.reason == "break":
        doctor.status = DoctorStatus.ON_BREAK
    else:
        doctor.status = DoctorStatus.OFFLINE

    db.commit()

    from app.websocket.queue import broadcast_queue_update
    await broadcast_queue_update(data.hospital_id)

    return {
        "message":      f"{redirected_count} patient(s) silently redirected to Dr. {next_doctor.full_name}.",
        "redirected":   redirected_count,
        "new_doctor":   next_doctor.full_name,
    }


# ── DOCTOR PING (inactivity check) ──
@router.post("/ping")
async def ping_doctor(doctor_id: str, db: Session = Depends(get_db)):
    """
    Called every 10 minutes by the system to check if doctor is still active.
    If no response comes back within 5 minutes, status auto-switches to offline.
    """
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    doctor.last_active_at = datetime.utcnow()
    db.commit()

    return {"status": "active", "last_seen": doctor.last_active_at}

# ── DOCTOR SETTINGS ──
from pydantic import BaseModel
from typing import Optional

class DoctorSettingsUpdate(BaseModel):
    doctor_id: str
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    breaks: Optional[str] = None

@router.patch("/settings")
async def update_settings(data: DoctorSettingsUpdate, db: Session = Depends(get_db)):
    """
    Update doctor shift timings and breaks.
    """
    doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    if data.shift_start is not None:
        doctor.shift_start = data.shift_start
    if data.shift_end is not None:
        doctor.shift_end = data.shift_end
    if data.breaks is not None:
        doctor.breaks = data.breaks

    db.commit()

    from app.websocket.queue import broadcast_queue_update
    await broadcast_queue_update(doctor.hospital_id)

    return {"message": "Settings updated successfully."}
