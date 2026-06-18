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

        # ── Build possible diagnosis comparison ──
        # ── Deep AI clinical reasoning for possible diagnosis ──
        possible_diagnosis = None
        diagnosis_reasoning = None
        if session and session.ai_assessment:
            from app.services.ai_client import ask_gemini

            past_dx_lines = "\n".join([
                f"- {v.diagnosis} (severity: {v.severity_confirmed or 'unknown'}, date: {v.submitted_at.strftime('%B %Y') if v.submitted_at else 'unknown'})"
                for v in past_verdicts if v.diagnosis
            ]) or "None on record"

            diagnosis_prompt = f"""
You are a brilliant senior consultant physician with 20+ years of clinical experience across East Africa. You trained at top institutions and have seen thousands of patients. You think like a doctor, not like a search engine.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PATIENT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Age: {patient.age or "Unknown"}
Location: {patient.location or "Kenya"}
Current Medications: {", ".join(medications) if medications else "None"}
Allergies: {patient.allergies or "None on record"}
Past Confirmed Diagnoses: {past_dx_lines}

What the triage nurse gathered today:
{session.ai_assessment}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW A GREAT DOCTOR THINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
When an experienced doctor listens to a patient, they do not run through a checklist.
They build a mental picture. They feel the weight of each symptom. They know that certain combinations of symptoms, when they appear together, almost always mean one thing — and that knowledge comes from deep clinical experience, not rules.

Think through this patient the same way:

Read the symptoms carefully. What is the patient actually experiencing right now, today?
Feel the severity — is this mild discomfort or a body in crisis?
Notice what symptoms appear together — combinations tell the real story, not individual symptoms in isolation.
Ask yourself: if a colleague described this patient to you in a hallway, what would you immediately think?
Consider the whole person — age, location, history — but only let those factors influence you if they genuinely explain what you are seeing today. A past diagnosis is just history. The current symptoms are the truth.
When considering geography, always ask: is this the MOST COMMON disease in this region that matches these symptoms, or am I reaching for a rare dramatic diagnosis? Common diseases are common everywhere. Dengue is far more prevalent across Kenya than Viral Hemorrhagic Fever. Typhoid is far more common than Brucellosis. Malaria is far more common than Trypanosomiasis. Always default to the most probable, not the most exotic.
Trust your clinical instinct. The most elegant diagnosis is usually the correct one — the one that explains everything naturally without forcing it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONE IMPORTANT PRINCIPLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
When symptoms have a clear, unmistakable pattern that any experienced clinician would recognize immediately — trust that pattern completely. Do not let a patient's medical history distract you from what their body is telling you right now. The current presentation is always more important than the past.

Return ONLY this JSON with no extra text or markdown:
{{
    "possible_diagnosis": "<single diagnosis name, 3-8 words>",
    "reasoning": "<two sentences max — explain your thinking the way you would tell a colleague in a corridor, naturally and confidently>"
}}
"""
            try:
                raw = (await ask_gemini(diagnosis_prompt)).strip()
                clean = raw.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean)
                possible_diagnosis  = parsed.get("possible_diagnosis", "").strip()
                diagnosis_reasoning = parsed.get("reasoning", "").strip()
            except Exception:
                possible_diagnosis  = session.ai_assessment.split(".")[0].strip()
                diagnosis_reasoning = None

        # ── Structured symptom summary for doctor ──
        symptom_summary = None
        if messages:
            from app.services.ai_client import ask_gemini

            convo_lines = []
            for msg in messages:
                if msg.get("role") in ("patient", "ai"):
                    role = "Nurse" if msg.get("role") == "ai" else "Patient"
                    convo_lines.append(f"{role}: {msg['content']}")
            full_convo = "\n".join(convo_lines)

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
- Associated Symptoms: <any other symptoms mentioned, or None>
- Medication Taken: <what they took, or None>
- Response to Medication: <did it help — yes/no/partial>
- Aggravating Factors: <what makes it worse, or None>
- Relieving Factors: <what makes it better, or None>
- Recent Travel or Exposure: <any travel or sick contacts mentioned, or None>

Rules:
- Read the nurse question AND the patient answer together to understand context
- "Forehead" after "where is the headache?" means Location: Forehead
- "Sharp" after "is it sharp or dull?" means Character: Sharp
- Only skip a line if the patient genuinely gave no information for it
- Return plain text only, no JSON, no markdown
"""
            try:
                symptom_summary = (await ask_gemini(summary_prompt)).strip()
            except Exception:
                symptom_summary = None

        return {
            "appointment_id":    appt.id,
            "patient_id":        appt.patient_id,
            "patient_name":      patient.full_name if patient else "Unknown",
            "patient_phone":     patient.phone_number if patient else "—",
            "patient_age":       calc_age if patient else "—",
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
        }
    finally:
        db.close()


