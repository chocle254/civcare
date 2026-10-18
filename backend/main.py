from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import create_tables, run_migrations, SessionLocal
from app.config import settings
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.routers import analytics
from app.websocket.queue import connect, disconnect, broadcast_queue_update
from app.services.scheduler import start_scheduler
import json


# ── ROUTERS ──
from app.routers import (
    auth, triage, hospitals, doctors,
    records, medscan, consultation,
    payment, reminders, verdict,
    ussd, sms, prescriptions, video
)

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered healthcare platform for Africa",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── PREFLIGHT HANDLER ──
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str, request: Request):
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        }
    )

# ── REGISTER ROUTERS ──
app.include_router(auth.router,          prefix="/auth",         tags=["Authentication"])
app.include_router(triage.router,        prefix="/triage",       tags=["Triage"])
app.include_router(hospitals.router,     prefix="/hospitals",    tags=["Hospitals"])
app.include_router(doctors.router,       prefix="/doctors",      tags=["Doctors"])
app.include_router(records.router,       prefix="/records",      tags=["Records"])
app.include_router(medscan.router,       prefix="/medscan",      tags=["MedScan"])
app.include_router(consultation.router,  prefix="/consultation", tags=["Consultation"])
app.include_router(payment.router,       prefix="/payment",      tags=["Payment"])
app.include_router(reminders.router,     prefix="/reminders",    tags=["Reminders"])
app.include_router(verdict.router,       prefix="/verdict",      tags=["Verdict"])
app.include_router(ussd.router,          prefix="/ussd",         tags=["USSD"])
app.include_router(sms.router,           prefix="/sms",          tags=["SMS"])
app.include_router(prescriptions.router, prefix="/prescriptions",tags=["Prescriptions"])
app.include_router(video.router,         prefix="/video",        tags=["Video"])
app.include_router(analytics.router,     prefix="/analytics",    tags=["analytics"])

# ── STARTUP ──
@app.on_event("startup")
async def startup():
    create_tables()
    run_migrations()          # ← add this line
    start_scheduler()
    print(f"✅ {settings.APP_NAME} started")
    print(f"📦 Database connected")
    print(f"🌐 Docs at /docs")


# ── HEALTH CHECK ──
@app.get("/")
async def root():
    return {"status": "CivTech Care System is running 🚀"}

@app.get("/health")
async def health():
    return {"status": "healthy"}


# ── LIVE QUEUE WebSocket ──
@app.websocket("/ws/queue/{hospital_id}")
async def websocket_queue(websocket: WebSocket, hospital_id: str):
    """
    Doctors connect here to receive live queue updates.
    When a patient confirms arrival, all connected doctors at that hospital
    receive the updated queue instantly — no page refresh needed.
    """
    await connect(websocket, hospital_id)
    try:
        while True:
            # Keep connection alive — actual updates pushed via broadcast_queue_update()
            await websocket.receive_text()
    except Exception:
        disconnect(websocket, hospital_id)


# ── QUEUE ENDPOINT (initial load + broadcast helper) ──
@app.get("/triage/queue")
async def get_queue(hospital_id: str, doctor_id: str):
    """
    Returns current patient queue for a doctor's dashboard.
    Also used internally after each arrival to broadcast updates.
    """
    db = SessionLocal()
    try:
        appointments = db.query(Appointment).filter(
            Appointment.hospital_id == hospital_id,
            Appointment.doctor_id   == doctor_id,
            Appointment.status.in_([
                AppointmentStatus.ARRIVED,
                AppointmentStatus.CALLED,
                AppointmentStatus.IN_PROGRESS,
            ])
        ).all()

        queue_data = []
        for appt in appointments:
            patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
            queue_data.append({
                "id":              appt.id,
                "patient_name":    patient.full_name if patient else "Unknown",
                "patient_phone":   patient.phone_number if patient else "—",
                "risk_score":      appt.risk_score or "moderate",
                "risk_numeric":    appt.risk_numeric or "50",
                "symptoms_summary":appt.symptoms_summary or "—",
                "status":          appt.status,
                "arrived_at":      appt.arrived_at.isoformat() if appt.arrived_at else None,
            })

        return queue_data
    finally:
        db.close()


def _transfer_info(db, appt):
    """Who handed this case over and why, for the receiving doctor."""
    if appt.redirect_reason not in ("transfer_doctor", "transfer_hospital"):
        return None
    from app.models.doctor import Doctor
    from_doc = db.query(Doctor).filter(Doctor.id == appt.original_doctor_id).first() if appt.original_doctor_id else None
    return {
        "from_doctor": from_doc.full_name if from_doc else None,
        "reason":      getattr(appt, "transfer_reason", None),
    }


# ── APPOINTMENT PROFILE ENDPOINT ──
@app.get("/triage/appointment/{appointment_id}")
async def get_appointment(appointment_id: str, doctor_id: str):
    """Full patient profile for doctor view."""
    db = SessionLocal()
    try:
        appt = db.query(Appointment).filter(
            Appointment.id        == appointment_id,
            Appointment.doctor_id == doctor_id,
        ).first()

        if not appt:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Appointment not found.")

        patient  = db.query(Patient).filter(Patient.id == appt.patient_id).first()

        # Load conversation from session
        from app.models.session import ChatSession
        session  = db.query(ChatSession).filter(
            ChatSession.id == appt.session_id
        ).first() if appt.session_id else None

        messages = json.loads(session.messages or "[]") if session else []

        # Fetch medical history
        from app.models.verdict import Verdict
        from app.models.prescription import Prescription
        
        past_verdicts = db.query(Verdict).filter(Verdict.patient_id == patient.id).all()
        diagnoses = list(set([v.diagnosis for v in past_verdicts if v.diagnosis]))
        conditions_str = ", ".join(diagnoses) if diagnoses else "None on record"
        
        active_prescriptions = db.query(Prescription).filter(
            Prescription.patient_id == patient.id,
            Prescription.is_active == True
        ).all()
        medications = [p.medication_name for p in active_prescriptions]

        # Calculate dynamic patient age
        calc_age = patient.age if patient and patient.age else "—"
        if patient and patient.date_of_birth:
            try:
                from datetime import datetime
                dob = datetime.strptime(patient.date_of_birth, "%Y-%m-%d")
                today = datetime.now()
                age_val = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                calc_age = str(age_val)
            except Exception:
                pass

        convo_lines = []
        for msg in messages:
            if msg.get("role") in ("patient", "ai"):
                role = "Nurse" if msg.get("role") == "ai" else "Patient"
                convo_lines.append(f"{role}: {msg['content']}")
        full_convo = "\n".join(convo_lines)

        # ── Case statement + symptom summary (generated once, then cached) ──
        # Both are AI-written; regenerating on every open made the case file
        # slow and could show the doctor a different answer each time.
        from app.services.ai_client import ask_gemini
        from app.services.case_statement import build_dossier, generate_case_statement, cache_key, read_cache
        key = cache_key(appt)
        cached = read_cache(session, key)
        case_statement = cached.get("case_statement") if cached else None
        symptom_summary = cached.get("symptom_summary") if cached else None
        if not cached and session and messages:
            case_statement = await generate_case_statement(build_dossier(db, patient, appt, session), full_convo)
            summary_prompt = f"""
A patient just completed a medical triage conversation with an AI nurse.
Read the full conversation below and extract a structured clinical summary a doctor can read in seconds.

CONVERSATION:
{full_convo}

Extract and structure into this format:
- Chief Complaint: <main symptom>
- Location: <where on body>
- Character: <how it feels — sharp, dull, burning, throbbing etc>
- Duration: <how long they've had it>
- Severity: <X/10 if patient rated it>
- Associated Symptoms: <any other symptoms mentioned>
- Medication Taken: <what they took>
- Response to Medication: <did it help — yes/no/partial>
- Aggravating Factors: <what makes it worse>
- Relieving Factors: <what makes it better>
- Recent Travel or Exposure: <travel, mosquito-net use or sick contacts mentioned>

Rules:
- Read the nurse question AND the patient answer together to understand context
- "Forehead" after "where is the headache?" means Location: Forehead
- "Sharp" after "is it sharp or dull?" means Character: Sharp
- Write "None" only when the patient said so (e.g. "no cough"). If it was never asked or mentioned, write "Not asked". Never turn silence into a negative.
- Return plain text only, no JSON, no markdown
"""
            try:
                symptom_summary = (await ask_gemini(summary_prompt)).strip()
            except Exception:
                symptom_summary = None
            if case_statement:
                session.case_file_cache = json.dumps({
                    "key": key, "case_statement": case_statement, "symptom_summary": symptom_summary,
                })
                db.commit()

        most_likely = (case_statement or {}).get("most_likely") or {}
        possible_diagnosis = most_likely.get("diagnosis")
        diagnosis_reasoning = most_likely.get("reasoning")

        return {
            "appointment_id":    appt.id,
            "patient_id":        appt.patient_id,
            "patient_name":      patient.full_name if patient else "Unknown",
            "patient_phone":     patient.phone_number if patient else "—",
            "patient_age":       calc_age if patient else "—",
            "patient_sex":       (patient.sex or "").capitalize() if patient else "",
            "patient_location":  patient.location if patient else "—",
            "identity_type":     patient.identity_type if patient else "—",
            "identity_number":   patient.identity_number if patient else "—",
            "risk_score":        appt.risk_score or "moderate",
            "risk_numeric":      session.risk_score_numeric if session and session.risk_score_numeric else appt.risk_numeric or "50",
            "ai_assessment":     session.ai_assessment if session else "",
            "ai_confidence":     session.ai_confidence if session else "—",
            "conversation":      messages,
            "conditions":        conditions_str,
            "allergies":         patient.allergies if patient and patient.allergies else "None on record",
            "allergy_flags":     patient.allergy_flags if patient and patient.allergy_flags else None,
            "current_medications": medications,
            "symptoms_summary":  appt.symptoms_summary or "—",
            "possible_diagnosis": possible_diagnosis,
            "diagnosis_reasoning": diagnosis_reasoning,
            "symptom_summary":     symptom_summary,
            "case_statement":      case_statement,
            "transfer":            _transfer_info(db, appt),
        }
    finally:
        db.close()


