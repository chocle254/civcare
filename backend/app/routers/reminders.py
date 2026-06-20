from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.prescription import Prescription, Reminder
from app.models.medication_outcome import DoseCheckin, CourseOutcome
from app.services.africastalking import send_medication_reminder
from app.services.carer import (
    generate_checkin_question,
    analyze_checkin,
    build_course_outcome,
    _diagnosis_for_prescription,
)
from app.services.rlhf import (
    record_medication_outcome_lesson,
    record_evening_checkin_lesson,
)
import math

router = APIRouter()

DOSAGE_MAP = {
    "1x1": {"times": 1, "interval_hours": 24},
    "1x2": {"times": 2, "interval_hours": 12},
    "1x3": {"times": 3, "interval_hours": 8},
    "2x2": {"times": 2, "interval_hours": 12},
    "2x3": {"times": 3, "interval_hours": 8},
    "1x4": {"times": 4, "interval_hours": 6},
}


class ReminderSetup(BaseModel):
    prescription_id: str
    dosage_notation: str          # e.g "1x3", "2x2"
    first_dose_time: str          # e.g "14:00"
    patient_id:      str
    pills_dispensed: int | None = None   # how many tablets the patient was given


class ReminderResponse(BaseModel):
    reminder_id: str
    response:    str   # taken / skip
    skip_reason: str | None = None


@router.get("/my-meds")
async def my_medications(patient_id: str, db: Session = Depends(get_db)):
    """Returns all active prescriptions for a patient."""
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id,
        Prescription.is_active  == True,
    ).all()

    return [
        {
            "id":                    p.id,
            "medication_name":       p.medication_name,
            "med_form":              p.med_form or "tablet",
            "doctor_name":           None,
            "dosage_notation":       p.dosage_notation,
            "first_dose_time":       p.first_dose_time,
            "reminder_interval_hours": p.reminder_interval_hours,
            "reminders_active":      p.reminders_active,
            "pills_dispensed":       p.pills_dispensed,
            "duration_days":         p.duration_days,
            "reminders_end_at":      p.reminders_end_at.isoformat() if p.reminders_end_at else None,
            "notes":                 p.notes,
        }
        for p in prescriptions
    ]

@router.get("/courses")
async def my_courses(patient_id: str, db: Session = Depends(get_db)):
    """
    Returns the patient's treatments GROUPED by diagnosis (one card per
    illness, e.g. "Malaria"), each bundling every medication the doctor
    prescribed for it, plus an overall completion percentage across the
    whole set — so the patient sees one clear treatment plan instead of a
    flat list of loose pills.
    """
    from app.models.verdict import Verdict

    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id,
        Prescription.is_active  == True,        # noqa: E712
    ).all()

    # Group by the verdict that created them (falls back to ungrouped)
    groups: dict[str, dict] = {}
    for p in prescriptions:
        key = p.verdict_id or f"solo-{p.id}"
        if key not in groups:
            diagnosis = "Prescribed medication"
            if p.verdict_id:
                v = db.query(Verdict).filter(Verdict.id == p.verdict_id).first()
                if v and v.diagnosis:
                    diagnosis = v.diagnosis
            groups[key] = {"verdict_id": p.verdict_id, "diagnosis": diagnosis, "meds": []}

        # Per-med completion from its reminders
        total = db.query(Reminder).filter(Reminder.prescription_id == p.id).count()
        done  = db.query(Reminder).filter(
            Reminder.prescription_id == p.id,
            Reminder.is_responded == True,         # noqa: E712
        ).count()

        # Next upcoming dose — drives the live countdown timer on the card
        next_reminder = (
            db.query(Reminder)
            .filter(
                Reminder.prescription_id == p.id,
                Reminder.is_responded == False,    # noqa: E712
            )
            .order_by(Reminder.scheduled_at.asc())
            .first()
        )

        groups[key]["meds"].append({
            "id":               p.id,
            "medication_name":  p.medication_name,
            "med_form":         p.med_form or "tablet",
            "dosage_notation":  p.dosage_notation,
            "first_dose_time":  p.first_dose_time,
            "reminder_interval_hours": p.reminder_interval_hours,
            "reminders_active": p.reminders_active,
            "pills_dispensed":  p.pills_dispensed,
            "duration_days":    p.duration_days,
            "reminders_end_at": p.reminders_end_at.isoformat() if p.reminders_end_at else None,
            "next_dose_at":     next_reminder.scheduled_at.isoformat() if next_reminder else None,
            "notes":            p.notes,
            "doses_total":      total,
            "doses_done":       done,
        })

    # Build response with an overall progress bar per diagnosis
    courses = []
    for g in groups.values():
        total = sum(m["doses_total"] for m in g["meds"])
        done  = sum(m["doses_done"]  for m in g["meds"])
        all_active = all(m["reminders_active"] for m in g["meds"]) if g["meds"] else False
        courses.append({
            "verdict_id": g["verdict_id"],
            "diagnosis":  g["diagnosis"],
            "meds":       g["meds"],
            "progress":   round((done / total) * 100) if total else 0,
            "doses_total": total,
            "doses_done":  done,
            "all_scheduled": all_active,
        })

    return courses


@router.post("/set")
async def set_reminders(data: ReminderSetup, db: Session = Depends(get_db)):
    """
    Patient enters how many pills they were given + frequency.
    Reminders are scheduled to deplete exactly when the supply runs out.
    """
    prescription = db.query(Prescription).filter(
        Prescription.id         == data.prescription_id,
        Prescription.patient_id == data.patient_id,
    ).first()

    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found.")

    dosage = DOSAGE_MAP.get(data.dosage_notation)
    if not dosage:
        raise HTTPException(status_code=400, detail="Invalid dosage notation.")

    interval_hours   = dosage["interval_hours"]
    times_per_day    = dosage["times"]
    tablets_per_dose = int(data.dosage_notation.split("x")[0])  # "2x3" -> 2

    # How many doses the supply allows
    pills = data.pills_dispensed
    if pills and pills > 0:
        total_doses = max(1, pills // tablets_per_dose)
    else:
        total_doses = times_per_day * 7   # fallback: 7-day course if pills unknown

    # Parse first dose time
    hour, minute = map(int, data.first_dose_time.split(":"))
    now          = datetime.utcnow()
    first_dose   = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if first_dose < now:
        first_dose += timedelta(days=1)

    # Schedule exactly total_doses reminders — depletes when pills run out
    reminders_created = 0
    current_time      = first_dose
    last_dose_time    = first_dose
    for _ in range(total_doses):
        db.add(Reminder(prescription_id=data.prescription_id, scheduled_at=current_time))
        last_dose_time = current_time
        current_time  += timedelta(hours=interval_hours)
        reminders_created += 1

    duration_days = math.ceil(total_doses / times_per_day)

    prescription.dosage_notation         = data.dosage_notation
    prescription.first_dose_time         = data.first_dose_time
    prescription.reminder_interval_hours = interval_hours
    prescription.pills_dispensed         = pills
    prescription.duration_days           = duration_days
    prescription.reminders_active        = True
    prescription.reminders_start_at      = first_dose
    prescription.reminders_end_at        = last_dose_time

    db.commit()

    return {
        "message":           f"Reminders set — {total_doses} doses over ~{duration_days} day(s).",
        "reminders_created": reminders_created,
        "first_reminder":    first_dose,
        "runs_out_on":       last_dose_time,
        "duration_days":     duration_days,
    }


@router.post("/respond")
async def respond_to_reminder(data: ReminderResponse, db: Session = Depends(get_db)):
    """
    Patient replies TAKEN or SKIP to a reminder SMS or in-app notification.
    """
    reminder = db.query(Reminder).filter(Reminder.id == data.reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found.")

    reminder.response     = data.response
    reminder.skip_reason  = data.skip_reason
    reminder.responded_at = datetime.utcnow()
    reminder.is_responded = True

    db.commit()

    if data.response == "taken":
        return {"message": "Great! Dose marked as taken. Keep it up."}

    if data.response == "skip" and data.skip_reason == "no_meds":
        return {"message": "Please visit a pharmacy to refill your prescription."}

    if data.response == "skip" and data.skip_reason == "side_effects":
        return {"message": "Please describe your side effects in the chat so we can help."}

    return {"message": "Response recorded."}


# ──────────────────────────────────────────────────────────────────────────
#  CARER LOOP — dose check-ins, recovery review, and follow-up re-routing
# ──────────────────────────────────────────────────────────────────────────

class CheckinSubmit(BaseModel):
    prescription_id: str
    patient_id:      str
    reminder_id:     str | None = None
    taken:           bool = True
    pills_taken:     int | None = None
    skip_reason:     str | None = None
    checkin_question: str | None = None   # echoed back from /due so we store what we asked
    answer:          str | None = None    # patient's free-text "how do you feel" reply


@router.get("/due")
async def due_dose(patient_id: str, db: Session = Depends(get_db)):
    """
    Returns the next dose that is due and not yet checked in, plus a warm,
    diagnosis-aware check-in question to show in the pop-up.
    The frontend polls this so the timer can raise the pop-up in-app.
    """
    now = datetime.utcnow()

    # Find a fired-but-unanswered reminder for one of this patient's active courses
    due = (
        db.query(Reminder)
        .join(Prescription, Reminder.prescription_id == Prescription.id)
        .filter(
            Prescription.patient_id == patient_id,
            Prescription.is_active == True,        # noqa: E712
            Reminder.scheduled_at <= now,
            Reminder.is_responded == False,        # noqa: E712
        )
        .order_by(Reminder.scheduled_at.asc())
        .first()
    )

    if not due:
        return {"due": False}

    prescription = db.query(Prescription).filter(Prescription.id == due.prescription_id).first()
    diagnosis = _diagnosis_for_prescription(db, prescription)
    units_per_dose = 1
    if prescription.dosage_notation and "x" in prescription.dosage_notation:
        try:
            units_per_dose = int(prescription.dosage_notation.split("x")[0])
        except ValueError:
            units_per_dose = 1

    # ── Evening-only check-in ──
    # We only ask "how do you feel" ONCE a day, on the patient's LAST dose of
    # the day (their evening pills, before sleep) — so they aren't overwhelmed
    # with questions at every dose. Earlier doses just confirm intake.
    is_evening = _is_last_dose_of_day(db, patient_id, due.scheduled_at)

    question = None
    if is_evening:
        question = await generate_checkin_question(prescription.medication_name, diagnosis)

    return {
        "due": True,
        "reminder_id":      due.id,
        "prescription_id":  prescription.id,
        "medication_name":  prescription.medication_name,
        "med_form":         prescription.med_form or "tablet",
        "units_per_dose":   units_per_dose,
        "ask_checkin":      is_evening,
        "checkin_question": question,
    }


def _is_last_dose_of_day(db: Session, patient_id: str, scheduled_at: datetime) -> bool:
    """
    True if `scheduled_at` is the patient's last scheduled dose on that calendar
    day across all their active courses — i.e. the evening/before-sleep dose.
    """
    day_start = scheduled_at.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end   = day_start + timedelta(days=1)

    later_same_day = (
        db.query(Reminder)
        .join(Prescription, Reminder.prescription_id == Prescription.id)
        .filter(
            Prescription.patient_id == patient_id,
            Prescription.is_active == True,        # noqa: E712
            Reminder.scheduled_at > scheduled_at,
            Reminder.scheduled_at < day_end,
        )
        .count()
    )
    return later_same_day == 0


@router.post("/checkin")
async def submit_checkin(data: CheckinSubmit, db: Session = Depends(get_db)):
    """
    Patient confirms a dose from the in-app pop-up and answers the check-in.
    We record it, read their reply observationally, and — if this was the last
    dose — run the recovery review and decide whether to re-offer a doctor.
    """
    prescription = db.query(Prescription).filter(
        Prescription.id == data.prescription_id,
        Prescription.patient_id == data.patient_id,
    ).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found.")

    diagnosis = _diagnosis_for_prescription(db, prescription)

    # Read the patient's answer (observational only)
    reading = {"sentiment": "same", "improved_areas": "", "persisting_areas": ""}
    if data.taken and data.answer:
        reading = await analyze_checkin(data.answer, diagnosis, prescription.medication_name)

    checkin = DoseCheckin(
        prescription_id=prescription.id,
        reminder_id=data.reminder_id,
        patient_id=data.patient_id,
        taken=data.taken,
        pills_taken=data.pills_taken,
        skip_reason=data.skip_reason,
        checkin_question=data.checkin_question,
        patient_answer=data.answer,
        sentiment=reading["sentiment"],
        improved_areas=reading["improved_areas"],
        persisting_areas=reading["persisting_areas"],
    )
    db.add(checkin)

    # Mark the reminder answered
    if data.reminder_id:
        reminder = db.query(Reminder).filter(Reminder.id == data.reminder_id).first()
        if reminder:
            reminder.response     = "taken" if data.taken else "skip"
            reminder.skip_reason  = data.skip_reason
            reminder.responded_at = datetime.utcnow()
            reminder.is_responded = True

    db.commit()

    # An evening check-in (the once-a-day "how do you feel" reply) is a real
    # mid-treatment observation — feed every one into the RLHF learning loop.
    is_evening_answer = bool(data.taken and data.answer)
    if is_evening_answer:
        await record_evening_checkin_lesson(
            diagnosis=diagnosis,
            medication=prescription.medication_name,
            sentiment=reading["sentiment"],
            improved_areas=reading["improved_areas"],
            persisting_areas=reading["persisting_areas"],
        )

    # Side-effect report escalates immediately — never wait for course end
    if reading["sentiment"] == "side_effect" or data.skip_reason == "side_effects":
        return {
            "message": "Thank you for telling me. A side effect can matter — let's get you a doctor.",
            "course_complete": False,
            "still_unwell": True,
            "offer_followup": True,
        }

    # Is the whole course finished? (every scheduled dose now answered)
    remaining = db.query(Reminder).filter(
        Reminder.prescription_id == prescription.id,
        Reminder.is_responded == False,   # noqa: E712
    ).count()

    if remaining > 0:
        msg = "Dose logged — thank you for checking in. Keep going, you're doing great."
        if reading["sentiment"] == "worse":
            msg = "Thank you for letting me know. I'll keep a close eye — finish your doses and we'll review."
        return {
            "message": msg,
            "course_complete": False,
            "still_unwell": False,
            "offer_followup": False,
        }

    # ── Course complete: run the recovery review ──
    outcome = await build_course_outcome(db, prescription)

    course = CourseOutcome(
        prescription_id=prescription.id,
        patient_id=data.patient_id,
        verdict_id=prescription.verdict_id,
        medications=outcome["medications"],
        resolved_areas=outcome["resolved_areas"],
        persisting_areas=outcome["persisting_areas"],
        adherence_note=outcome["adherence_note"],
        still_unwell=outcome["still_unwell"],
        followup_note=outcome["followup_note"],
    )
    db.add(course)

    # Mark the course done
    prescription.is_active    = False
    prescription.is_completed = True
    prescription.completed_at = datetime.utcnow()
    db.commit()

    # Feed the medication outcome into the AI's second training stream
    await record_medication_outcome_lesson(
        diagnosis=diagnosis,
        medication=prescription.medication_name,
        resolved_areas=outcome["resolved_areas"],
        persisting_areas=outcome["persisting_areas"],
        still_unwell=outcome["still_unwell"],
    )

    if outcome["still_unwell"]:
        return {
            "message": "You've finished this course but you're still not feeling right. "
                       "Let's get a doctor to take another look.",
            "course_complete": True,
            "still_unwell": True,
            "offer_followup": True,
            "course_outcome_id": course.id,
        }

    return {
        "message": "You've completed your full course and you're feeling better. Wonderful — take care!",
        "course_complete": True,
        "still_unwell": False,
        "offer_followup": False,
    }


@router.get("/followup/{course_outcome_id}")
async def followup_case_file(course_outcome_id: str, db: Session = Depends(get_db)):
    """
    Builds the follow-up case file handed to the next doctor when a patient
    re-routes after finishing a course while still unwell. It bundles the
    previous diagnosis, the medications prescribed, and the observational
    recovery note (what resolved / what persists).
    """
    course = db.query(CourseOutcome).filter(CourseOutcome.id == course_outcome_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course outcome not found.")

    prev_diagnosis = None
    prev_notes = None
    prescribed = []
    if course.verdict_id:
        from app.models.verdict import Verdict
        verdict = db.query(Verdict).filter(Verdict.id == course.verdict_id).first()
        if verdict:
            prev_diagnosis = verdict.diagnosis
            prev_notes = verdict.notes
        prescribed = [
            p.medication_name
            for p in db.query(Prescription).filter(Prescription.verdict_id == course.verdict_id).all()
        ]

    return {
        "headline":          "Follow-up review — patient unwell after completing treatment",
        "previous_diagnosis": prev_diagnosis or "On record",
        "previous_doctor_notes": prev_notes,
        "medications_taken":  prescribed or [course.medications],
        "resolved_areas":     course.resolved_areas,
        "persisting_areas":   course.persisting_areas,
        "adherence":          course.adherence_note,
        "followup_note":      course.followup_note,
    }
