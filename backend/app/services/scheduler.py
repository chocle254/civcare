from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.prescription import Reminder, Prescription
from app.models.consultation import Consultation, PaymentStatus, ConsultationStatus
from app.models.doctor import Doctor, DoctorStatus
from app.models.consultation import RecordAccess
from app.services.africastalking import send_medication_reminder, send_sms

scheduler = AsyncIOScheduler()


async def send_due_reminders():
    """
    Runs every minute.
    Checks for medication reminders that are due and sends them via SMS.
    """
    db: Session = SessionLocal()
    try:
        now  = datetime.utcnow()
        # 15 minutes, so a dose isn't lost if the server restarted at that minute
        window_start = now - timedelta(minutes=15)

        due_reminders = db.query(Reminder).filter(
            Reminder.scheduled_at >= window_start,
            Reminder.scheduled_at <= now,
            Reminder.is_sent      == False,
        ).all()

        for reminder in due_reminders:
            prescription = db.query(Prescription).filter(
                Prescription.id == reminder.prescription_id
            ).first()

            if not prescription or not prescription.is_active:
                continue

            from app.models.patient import Patient
            patient = db.query(Patient).filter(
                Patient.id == prescription.patient_id
            ).first()

            if not patient:
                continue

            # Phone notification (works with the app closed). The lock screen
            # never names the medicine.
            from app.services.push import notify
            local = (reminder.scheduled_at + timedelta(hours=3)).strftime("%-I:%M %p")
            pushed = await notify(
                patient.id, "Time for your medicine",
                f"Your {local} dose is due. Tap to log it.",
                url="/medications", tag=f"dose-{reminder.id}",
            )

            # SMS too, for phones without data
            sent = await send_medication_reminder(
                phone_number=patient.phone_number,
                medication=prescription.medication_name,
                dosage=prescription.dosage_notation or "",
            ) or pushed > 0

            if sent:
                reminder.is_sent = True
                reminder.sent_at = now
                db.commit()
                print(f"Reminder sent for prescription {prescription.id[:8]}")

    except Exception as e:
        print(f"Reminder scheduler error: {e}")
    finally:
        db.close()


async def auto_release_payments():
    """
    Runs every 5 minutes.
    Releases consultation payments that have been in escrow
    for more than 30 minutes and neither party marked complete.
    Protects the doctor if the patient forgets to rate.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()

        overdue = db.query(Consultation).filter(
            Consultation.payment_status  == PaymentStatus.PAID,
            Consultation.auto_release_at <= now,
            Consultation.auto_released   == False,
        ).all()

        for consult in overdue:
            consult.payment_status  = PaymentStatus.RELEASED
            consult.auto_released   = True
            consult.released_at     = now
            consult.status          = ConsultationStatus.COMPLETED
            consult.completed_at    = now

            # Doctor back to available
            doctor = db.query(Doctor).filter(Doctor.id == consult.doctor_id).first()
            if doctor and doctor.status == DoctorStatus.WITH_PATIENT:
                doctor.status = DoctorStatus.AVAILABLE

            db.commit()
            print(f"Auto-released payment for consultation {consult.id}")

    except Exception as e:
        print(f"Payment auto-release error: {e}")
    finally:
        db.close()


async def expire_record_keys():
    """
    Runs every 10 minutes.
    Marks expired doctor record access keys as expired.
    Keys expire 24 hours after being issued.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()

        expired = db.query(RecordAccess).filter(
            RecordAccess.expires_at  <= now,
            RecordAccess.is_expired  == False,
        ).all()

        for access in expired:
            access.is_expired = True

        if expired:
            db.commit()
            print(f"Expired {len(expired)} record access key(s)")

    except Exception as e:
        print(f"Record key expiry error: {e}")
    finally:
        db.close()


async def check_doctor_inactivity():
    """
    Runs every 5 minutes.
    If a doctor has not pinged in more than 15 minutes,
    marks them as offline and redirects their patients.
    """
    db: Session = SessionLocal()
    try:
        now      = datetime.utcnow()
        cutoff   = now - timedelta(minutes=15)

        inactive = db.query(Doctor).filter(
            Doctor.status.in_([DoctorStatus.AVAILABLE, DoctorStatus.WITH_PATIENT]),
            Doctor.last_active_at <= cutoff,
            Doctor.is_active      == True,
        ).all()

        for doctor in inactive:
            print(f"Doctor {doctor.id[:8]} marked offline due to inactivity")
            doctor.status = DoctorStatus.OFFLINE

            # Notify doctor via SMS
            await send_sms(
                doctor.phone_number,
                "CivTech: You have been marked offline due to inactivity. "
                "Please log back in to receive patients."
            )

        if inactive:
            db.commit()

    except Exception as e:
        print(f"Inactivity check error: {e}")
    finally:
        db.close()


# How long a health-assistant conversation that never led to a visit or a
# consultation is kept (DPA s. 39: no longer than needed). Conversations that
# led to care are part of the clinical record and are kept.
UNUSED_CHAT_RETENTION_DAYS = 365


async def purge_unused_chats():
    """Runs daily. Empties old conversations that never led to care."""
    from app.models.session import ChatSession
    from app.models.appointment import Appointment
    db: Session = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=UNUSED_CHAT_RETENTION_DAYS)
        used = db.query(Appointment.session_id).filter(Appointment.session_id.isnot(None))
        used_consult = db.query(Consultation.session_id).filter(Consultation.session_id.isnot(None))
        old = db.query(ChatSession).filter(
            ChatSession.started_at < cutoff,
            ChatSession.messages != "[]",
            ~ChatSession.id.in_(used),
            ~ChatSession.id.in_(used_consult),
        ).all()
        for s in old:
            s.messages = "[]"
            s.triage_summary = None
            s.case_file_cache = None
            s.ai_assessment = None
            s.clash_details = None
        if old:
            db.commit()
            print(f"Retention: emptied {len(old)} unused conversation(s)")
    except Exception as e:
        db.rollback()
        print(f"Retention job error: {type(e).__name__}")
    finally:
        db.close()


async def send_missed_dose_nudges():
    """
    Runs every 5 minutes. One gentle notification per dose that is an
    hour past due and still not logged. Push only; no extra SMS.
    """
    from app.services.push import notify
    from app.models.patient import Patient  # noqa: F401
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        rows = db.query(Reminder, Prescription).join(Prescription, Reminder.prescription_id == Prescription.id).filter(
            Prescription.is_active == True,                      # noqa: E712
            Reminder.is_responded == False,                      # noqa: E712
            Reminder.missed_nudged_at.is_(None),
            Reminder.scheduled_at <= now - timedelta(hours=1),
            Reminder.scheduled_at >= now - timedelta(hours=3),   # don't nag about old doses
        ).all()
        nudged = set()
        for reminder, rx in rows:
            reminder.missed_nudged_at = now
            if rx.patient_id in nudged:
                continue                                         # one message per patient per run
            nudged.add(rx.patient_id)
            local = (reminder.scheduled_at + timedelta(hours=3)).strftime("%-I:%M %p")
            await notify(rx.patient_id, "Did you take your medicine?",
                         f"You haven't logged your {local} dose yet. Tap to log it, or tell us why you skipped it.",
                         url="/medications", tag=f"dose-{reminder.id}")
        db.commit()
    except Exception as e:
        print(f"Missed-dose nudge error: {e}")
    finally:
        db.close()


async def send_course_followups():
    """
    Runs every 30 minutes. About 12 hours after a treatment's last dose,
    asks once how the patient feels, unless they already did the
    end-of-treatment review.
    """
    from app.services.push import notify
    from app.models.medication_outcome import CourseOutcome
    from sqlalchemy import func
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        last = dict(db.query(Reminder.prescription_id, func.max(Reminder.scheduled_at))
                    .group_by(Reminder.prescription_id).all())
        rx = db.query(Prescription).filter(
            Prescription.followup_nudged_at.is_(None),
            Prescription.reminders_active == True,               # noqa: E712
        ).all()
        groups: dict = {}
        for p in rx:
            groups.setdefault((p.patient_id, p.verdict_id or p.id), []).append(p)
        for (patient_id, _), meds in groups.items():
            ends = [last.get(p.id) for p in meds]
            if not all(ends):
                continue
            end = max(ends)
            if not (now - timedelta(days=3) <= end <= now - timedelta(hours=12)):
                if end < now - timedelta(days=3):
                    for p in meds:
                        p.followup_nudged_at = now               # too old to ask; never ask
                continue
            reviewed = db.query(CourseOutcome).filter(
                CourseOutcome.patient_id == patient_id,
                CourseOutcome.prescription_id.in_([p.id for p in meds]),
            ).first()
            for p in meds:
                p.followup_nudged_at = now
            if reviewed:
                continue
            await notify(patient_id, "How are you feeling now?",
                         "Your treatment has finished. Tell us how you feel, and we'll help if you're still unwell.",
                         url="/medications", tag=f"followup-{meds[0].id}")
        db.commit()
    except Exception as e:
        print(f"Course follow-up error: {e}")
    finally:
        db.close()


def start_scheduler():
    """
    Starts all background jobs.
    Called once on app startup in main.py
    """
    scheduler.add_job(
        send_due_reminders,
        trigger=IntervalTrigger(minutes=1),
        id="medication_reminders",
        replace_existing=True,
    )
    scheduler.add_job(
        auto_release_payments,
        trigger=IntervalTrigger(minutes=5),
        id="payment_auto_release",
        replace_existing=True,
    )
    scheduler.add_job(
        expire_record_keys,
        trigger=IntervalTrigger(minutes=10),
        id="record_key_expiry",
        replace_existing=True,
    )
    scheduler.add_job(
        check_doctor_inactivity,
        trigger=IntervalTrigger(minutes=5),
        id="doctor_inactivity",
        replace_existing=True,
    )

    scheduler.add_job(
        send_missed_dose_nudges,
        trigger=IntervalTrigger(minutes=5),
        id="missed_dose_nudges",
        replace_existing=True,
    )
    scheduler.add_job(
        send_course_followups,
        trigger=IntervalTrigger(minutes=30),
        id="course_followups",
        replace_existing=True,
    )
    scheduler.add_job(
        purge_unused_chats,
        trigger=IntervalTrigger(hours=24),
        id="retention_unused_chats",
        replace_existing=True,
    )

    scheduler.start()
    print("[OK] Background scheduler started")
    print("   → Medication reminders: every 1 min")
    print("   → Payment auto-release: every 5 min")
    print("   → Record key expiry:    every 10 min")
    print("   → Doctor inactivity:    every 5 min")
