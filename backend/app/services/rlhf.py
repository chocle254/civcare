import json

from app.database import SessionLocal
from app.models.rlhf import AIFeedback
from app.models.appointment import Appointment
from app.services.ai_client import ask_gemini


async def _cross_reference_prediction(
    ai_assessment: str,
    ai_risk_score: str,
    actual_diagnosis: str,
    doctor_notes: str,
    comment: str,
    rating: int,
) -> dict:
    """
    The core self-training step.

    The AI is shown its OWN original triage prediction next to the doctor's
    ground-truth diagnosis and notes. It then critiques itself: did it agree
    with the doctor? If not, what did it miss, and why? Finally it distils a
    short, generalised clinical lesson that can be reused on future patients.

    Doctor notes matter because CivCare cannot yet measure vitals (temperature,
    blood pressure, oxygen saturation). A doctor who physically checks those may
    legitimately reach a different conclusion — so the lesson must teach the AI
    to reason about that missing data, not blindly copy the final diagnosis.
    """
    prompt = f"""
You are the quality-assurance brain of a clinical triage AI. You are reviewing one of your
own past triage predictions against the verified outcome from a licensed doctor.

YOUR ORIGINAL AI PREDICTION:
- Risk assessment: {ai_risk_score or 'Unknown'}
- Reasoning: {ai_assessment or 'Not recorded'}

DOCTOR'S GROUND TRUTH (final authority):
- Confirmed diagnosis: {actual_diagnosis or 'Not recorded'}
- Doctor's clinical notes: {doctor_notes or 'None'}
- Doctor's feedback on the AI: {comment or 'None'}
- Doctor's accuracy rating of the AI: {rating}/5

IMPORTANT CONTEXT:
CivCare collects symptoms through conversation only. It CANNOT currently measure vital signs
such as temperature, blood pressure, or oxygen saturation. The doctor can. If the doctor's
notes mention vitals or a physical exam finding the AI had no way of knowing, treat that as a
data-access limitation, not a reasoning error.

TASK:
1. Decide whether your prediction broadly MATCHED or MISMATCHED the doctor's diagnosis/severity.
2. Explain the gap in 1-2 sentences (what was missed and why).
3. Write ONE short, generalised, reusable triage lesson (max 25 words). It must generalise to
   future patients, never reference this specific patient, and stay clinically safe.

Respond ONLY in this exact JSON format with no extra text:
{{
    "mismatch": true | false,
    "mismatch_analysis": "<1-2 sentence explanation>",
    "learned_lesson": "<one short generalised rule>"
}}
"""

    response = await ask_gemini(prompt, model="llama-3.1-8b-instant")
    try:
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(clean)
        return {
            "mismatch": bool(data.get("mismatch", False)),
            "mismatch_analysis": data.get("mismatch_analysis", "")[:1000],
            "learned_lesson": data.get("learned_lesson", "")[:500],
        }
    except Exception as e:
        print(f"RLHF cross-reference parse failed: {e}")
        # Low-data / unparsable edge case: fall back to the star rating only.
        return {
            "mismatch": rating <= 3,
            "mismatch_analysis": comment or "Could not auto-analyse; retained for manual review.",
            "learned_lesson": "",
        }


async def submit_ai_rating(
    rating: int,
    comment: str,
    diagnosis: str,
    appointment_id: str,
    notes: str = "",
):
    """
    Reinforcement Learning from Human Feedback (RLHF) entry point.

    Called when a doctor submits a verdict. It:
      1. Pulls the AI's original triage prediction for this appointment.
      2. Cross-references that prediction against the doctor's real diagnosis + notes.
      3. Distils a reusable clinical lesson from any gap.
      4. Stores everything so the lesson is fed into future triage prompts.
    """
    db = SessionLocal()
    try:
        # ── 1. Recover the AI's original prediction for this case ──
        ai_assessment = "Unknown"
        ai_risk_score = "Unknown"
        if appointment_id:
            appointment = (
                db.query(Appointment)
                .filter(Appointment.id == appointment_id)
                .first()
            )
            if appointment:
                if appointment.symptoms_summary:
                    ai_assessment = appointment.symptoms_summary
                if appointment.risk_score or appointment.risk_numeric:
                    ai_risk_score = f"{appointment.risk_score or 'n/a'} ({appointment.risk_numeric or 'n/a'})"

        # ── 2 + 3. Self-critique and distil a lesson ──
        learning = await _cross_reference_prediction(
            ai_assessment=ai_assessment,
            ai_risk_score=ai_risk_score,
            actual_diagnosis=diagnosis,
            doctor_notes=notes,
            comment=comment,
            rating=rating,
        )

        print(f"""
    ── RLHF Cross-Reference Complete ──
    Appointment:   {appointment_id}
    Rating:        {rating}/5
    AI predicted:  {ai_risk_score}
    Doctor said:   {diagnosis}
    Mismatch:      {learning['mismatch']}
    Lesson:        {learning['learned_lesson']}
    """)

        # ── 4. Persist as a training example ──
        feedback = AIFeedback(
            appointment_id=appointment_id,
            rating=rating,
            ai_assessment=ai_assessment,
            ai_risk_score=ai_risk_score,
            actual_diagnosis=diagnosis,
            doctor_notes=notes,
            comment=comment,
            mismatch=learning["mismatch"],
            mismatch_analysis=learning["mismatch_analysis"],
            learned_lesson=learning["learned_lesson"],
            is_active=True,
        )
        db.add(feedback)
        db.commit()
    except Exception as e:
        print(f"Error saving AI feedback: {e}")
    finally:
        db.close()


async def record_medication_outcome_lesson(
    diagnosis: str,
    medication: str,
    resolved_areas: str,
    persisting_areas: str,
    still_unwell: bool,
):
    """
    The SECOND RLHF stream: learning from real medication outcomes.

    After the doctor-verdict loop, CivCare keeps watching. When a course
    finishes, what the patient reports (resolved vs. persisting) is distilled
    into a generalised, OBSERVATIONAL triage lesson and stored alongside the
    doctor-feedback lessons, so future triage gets sharper over time.

    The lesson is strictly correlational. It must NEVER claim a drug cures a
    condition (e.g. never "amoxicillin cures sore throat"). It only encodes
    patterns like "patients treated for X who still report Y at course end
    often need follow-up" — which sharpens triage and follow-up prompting
    without making unsafe medical claims.
    """
    prompt = f"""
You are refining a clinical triage AI from a real medication outcome.

What happened (patient-reported only — not verified causation):
- Patient was treated for: {diagnosis}
- Medication taken: {medication}
- Patient reports RESOLVED: {resolved_areas or 'none clearly reported'}
- Patient reports STILL PRESENT: {persisting_areas or 'none reported'}
- Still unwell at course end: {still_unwell}

Write ONE short, generalised, reusable triage lesson (max 25 words).

STRICT RULES:
- Be observational/correlational only. NEVER claim a medication cures, heals, or treats anything.
  (Forbidden: "amoxicillin cures sore throat." Allowed: "patients treated for throat infection
  who still report cough at course end often need follow-up.")
- It must generalise to future patients and never name this specific patient.
- Keep it clinically safe and humble.

Return ONLY this JSON:
{{ "learned_lesson": "<one short generalised, observational rule>" }}
"""
    db = SessionLocal()
    try:
        lesson = ""
        try:
            raw = (await ask_gemini(prompt, model="llama-3.1-8b-instant")).strip()
            clean = raw.replace("```json", "").replace("```", "").strip()
            lesson = json.loads(clean).get("learned_lesson", "")[:500]
        except Exception as e:
            print(f"medication-outcome lesson parse failed: {e}")

        feedback = AIFeedback(
            appointment_id=None,
            rating=2 if still_unwell else 5,   # still-unwell ranks as a high-signal case
            ai_assessment=f"Medication outcome follow-up for {diagnosis}",
            ai_risk_score="post-treatment",
            actual_diagnosis=diagnosis,
            doctor_notes=None,
            comment=f"Resolved: {resolved_areas or 'n/a'} | Persisting: {persisting_areas or 'n/a'}",
            mismatch=bool(still_unwell),
            mismatch_analysis=f"Patient took {medication} for {diagnosis}; still unwell={still_unwell}.",
            learned_lesson=lesson,
            is_active=True,
        )
        db.add(feedback)
        db.commit()
        print(f"── Medication-outcome lesson stored ── {lesson}")
    except Exception as e:
        print(f"Error saving medication-outcome lesson: {e}")
    finally:
        db.close()


def get_learned_lessons(limit: int = 12) -> list[str]:
    """
    Returns the most relevant distilled lessons to inject into the triage prompt.

    Mismatches (cases the AI got wrong) are prioritised because they carry the
    highest learning signal — exactly the rare, low-data edge cases that matter
    most in a rural setting. This is how the feedback loop actually changes the
    AI's behaviour on the next patient without GPU fine-tuning.
    """
    db = SessionLocal()
    try:
        rows = (
            db.query(AIFeedback)
            .filter(
                AIFeedback.is_active == True,  # noqa: E712
                AIFeedback.learned_lesson.isnot(None),
                AIFeedback.learned_lesson != "",
            )
            .order_by(
                AIFeedback.mismatch.desc(),     # learn from mistakes first
                AIFeedback.created_at.desc(),   # then most recent
            )
            .limit(limit)
            .all()
        )
        return [r.learned_lesson.strip() for r in rows if r.learned_lesson]
    except Exception as e:
        print(f"Error loading learned lessons: {e}")
        return []
    finally:
        db.close()
