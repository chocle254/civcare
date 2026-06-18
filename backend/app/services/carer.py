"""
Carer service — the closed loop that stays with the patient through their
whole medication course, not just up to the doctor's verdict.

Flow:
  1. A dose reminder fires.
  2. generate_checkin_question() asks a short, diagnosis-aware question.
  3. analyze_checkin() reads the patient's reply (observationally).
  4. When the course finishes, build_course_outcome() summarises recovery
     as "what resolved / what persists" — never as a causal drug claim.
  5. If the patient is still unwell, they are re-offered hospital / online
     doctor with a follow-up case file for the next doctor.

Nothing here ever asserts that a drug cured anything. CivCare only records
what the patient reports and hands it to a licensed doctor to interpret.
"""
import json

from app.services.ai_client import ask_gemini


def _diagnosis_for_prescription(db, prescription) -> str:
    """Resolve the diagnosis a prescription was written for, via its verdict."""
    try:
        from app.models.verdict import Verdict
        if prescription.verdict_id:
            v = db.query(Verdict).filter(Verdict.id == prescription.verdict_id).first()
            if v and v.diagnosis:
                return v.diagnosis
    except Exception as e:
        print(f"diagnosis lookup failed: {e}")
    return "their condition"


async def generate_checkin_question(medication: str, diagnosis: str) -> str:
    """
    Build a warm, specific question that maps the medication to the diagnosis,
    so the check-in feels like a real carer rather than a generic survey.
    e.g. amoxicillin for a throat infection -> "Is swallowing any easier, and
    has the fever come down since you started?"
    """
    prompt = f"""
You are a caring community health nurse checking in on a patient by text, right after
they have taken a dose of their medication.

Medication just taken: {medication}
What the doctor is treating: {diagnosis}

Write ONE short, warm check-in question (max 25 words) asking how they feel right now.
Make it specific to their condition where natural (e.g. for a throat infection ask about
swallowing and fever). Do NOT diagnose. Do NOT claim the medicine is working. Do NOT give
medical advice. Just ask, kindly, how they are feeling.

Return only the question text, nothing else.
"""
    try:
        q = (await ask_gemini(prompt, model="llama-3.1-8b-instant")).strip()
        return q.strip('"') or "How are you feeling right now after taking your medication?"
    except Exception:
        return "How are you feeling right now after taking your medication?"


async def analyze_checkin(answer: str, diagnosis: str, medication: str) -> dict:
    """
    Read the patient's free-text reply and extract an OBSERVATIONAL reading:
    are they improving, the same, worse, or reporting a side effect, and which
    symptoms/areas they say eased vs. still bother them.

    This never attributes cause to the drug — it only structures what the
    patient said so a doctor can read it quickly later.
    """
    prompt = f"""
A patient on medication for "{diagnosis}" was asked how they feel after a dose.
Their reply: "{answer}"

Extract ONLY what the patient actually reported. Do not infer that the medication caused
anything. Do not diagnose.

Respond ONLY in this exact JSON:
{{
    "sentiment": "improving" | "same" | "worse" | "side_effect",
    "improved_areas": "<comma-separated symptoms/body areas the patient says feel better, or empty>",
    "persisting_areas": "<comma-separated symptoms/body areas still bothering them, or empty>"
}}
"""
    try:
        raw = (await ask_gemini(prompt, model="llama-3.1-8b-instant")).strip()
        clean = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean)
        return {
            "sentiment": data.get("sentiment", "same"),
            "improved_areas": (data.get("improved_areas") or "").strip()[:500],
            "persisting_areas": (data.get("persisting_areas") or "").strip()[:500],
        }
    except Exception as e:
        print(f"check-in analysis failed: {e}")
        return {"sentiment": "same", "improved_areas": "", "persisting_areas": ""}


async def build_course_outcome(db, prescription) -> dict:
    """
    Runs when a course finishes. Aggregates every dose check-in into an
    observational recovery summary and decides whether the patient is still
    unwell (and therefore should be re-offered a doctor).
    """
    from app.models.medication_outcome import DoseCheckin

    checkins = (
        db.query(DoseCheckin)
        .filter(DoseCheckin.prescription_id == prescription.id)
        .order_by(DoseCheckin.created_at.asc())
        .all()
    )

    diagnosis = _diagnosis_for_prescription(db, prescription)
    medication = prescription.medication_name

    taken_count = sum(1 for c in checkins if c.taken)
    total = len(checkins)
    adherence_note = f"{taken_count}/{total} logged doses taken" if total else "No dose check-ins recorded"

    # Collect what the patient reported across the whole course
    improved, persisting, answers = set(), set(), []
    for c in checkins:
        if c.improved_areas:
            improved.update(a.strip() for a in c.improved_areas.split(",") if a.strip())
        if c.persisting_areas:
            persisting.update(a.strip() for a in c.persisting_areas.split(",") if a.strip())
        if c.patient_answer:
            answers.append(c.patient_answer)

    last_sentiment = checkins[-1].sentiment if checkins else "same"
    still_unwell = bool(persisting) or last_sentiment in ("same", "worse", "side_effect")

    # Anything that showed up as both improved and persisting -> treat as persisting
    resolved_areas = improved - persisting

    # Ask the model to write a careful, observational follow-up note for the doctor
    followup_note = await _write_followup_note(
        medication=medication,
        diagnosis=diagnosis,
        resolved=", ".join(sorted(resolved_areas)) or "None clearly reported",
        persisting=", ".join(sorted(persisting)) or "None reported",
        adherence=adherence_note,
        answers=answers,
    )

    return {
        "medications": medication,
        "resolved_areas": ", ".join(sorted(resolved_areas)),
        "persisting_areas": ", ".join(sorted(persisting)),
        "adherence_note": adherence_note,
        "still_unwell": still_unwell,
        "followup_note": followup_note,
    }


async def _write_followup_note(medication, diagnosis, resolved, persisting, adherence, answers) -> str:
    """
    Compose the note shown to the next doctor. STRICTLY observational —
    it reports what the patient took and what they report, and never claims
    the medicine cured or failed to cure anything.
    """
    answers_block = "\n".join(f"- {a}" for a in answers[-6:]) or "- (no free-text reports)"
    prompt = f"""
You are writing a short follow-up handover note for a doctor. A patient has just finished a
medication course and still does not feel fully well.

Facts you may use:
- Medication the patient took: {medication}
- It was prescribed for: {diagnosis}
- Adherence: {adherence}
- Symptoms the patient reports have RESOLVED: {resolved}
- Symptoms the patient reports are STILL PRESENT: {persisting}
- The patient's own words during the course:
{answers_block}

STRICT RULES:
- Write 2-3 plain sentences.
- Be purely observational. State what the patient TOOK and what they REPORT.
- NEVER say or imply the medication cured, healed, treated, or failed to treat anything.
  (Wrong: "amoxicillin healed the throat". Right: "the patient took amoxicillin; they
  report the sore throat has resolved but the cough persists.")
- Do not diagnose. Do not recommend a new medication.
- End with: "Patient does not feel well after completing this course and is seeking review."

Return only the note text.
"""
    try:
        return (await ask_gemini(prompt, model="llama-3.1-8b-instant")).strip()
    except Exception:
        return (
            f"The patient took {medication} (prescribed for {diagnosis}); {adherence}. "
            f"They report the following resolved: {resolved}. Still present: {persisting}. "
            f"Patient does not feel well after completing this course and is seeking review."
        )
