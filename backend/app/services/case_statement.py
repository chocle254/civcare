"""
Doctor-facing case statement.

Pulls together everything CivCare knows about a patient (demographics,
allergies, medicines, past visits and how treatment went, today's triage)
into a handover a doctor who has never met the patient can act on, with
the AI's prediction and how to confirm or rule it out.

The result is generated once per visit and cached on the triage session,
so every open of the case file shows the same statement. It's regenerated
only if the visit changes (e.g. a transfer adds a reason).

Doctor-facing only: never send any of this to the patient.
"""
import json

from app.services.ai_client import ask_gemini
from app.services.patient_info import patient_age, patient_sex

CACHE_VERSION = 1


def _fmt_date(dt) -> str:
    return dt.strftime("%d %b %Y") if dt else "date unknown"


def build_dossier(db, patient, appt, session) -> str:
    """Plain-text record of everything known about the patient."""
    from app.models.verdict import Verdict
    from app.models.prescription import Prescription
    from app.models.medication_outcome import CourseOutcome
    from app.models.doctor import Doctor

    lines = [
        "DEMOGRAPHICS",
        f"- Age: {patient_age(patient)}",
        f"- Sex: {patient_sex(patient)}",
        f"- Lives in: {patient.location or 'Not recorded'} (Kenya)",
        "",
        "ALLERGIES AND ALERTS",
        f"- Allergies reported by patient: {patient.allergies or 'None recorded'}",
        f"- Earlier AI medication/allergy alerts: {patient.allergy_flags or 'None'}",
        "",
        "CURRENT MEDICINES (prescribed through CivCare, still active)",
    ]
    active = db.query(Prescription).filter(
        Prescription.patient_id == patient.id, Prescription.is_active == True,  # noqa: E712
    ).all()
    lines += [
        f"- {p.medication_name}"
        + (f" ({p.dosage_notation})" if p.dosage_notation else "")
        + (f"; note: {p.notes}" if p.notes else "")
        + f"; prescribed {_fmt_date(p.prescribed_at)}"
        for p in active
    ] or ["- None on record"]

    lines += ["", "PAST VISITS (newest first)"]
    verdicts = db.query(Verdict).filter(Verdict.patient_id == patient.id) \
        .order_by(Verdict.submitted_at.desc()).limit(8).all()
    if not verdicts:
        lines.append("- None on record: first visit through CivCare")
    for v in verdicts:
        if appt and v.appointment_id == appt.id:
            continue
        doc = db.query(Doctor).filter(Doctor.id == v.doctor_id).first()
        rx = db.query(Prescription).filter(Prescription.verdict_id == v.id).all()
        lines.append(
            f"- {_fmt_date(v.submitted_at)}: {v.diagnosis} (severity {v.severity_confirmed or 'n/a'})"
            + (f", seen by {doc.full_name}" if doc else "")
            + (f". Doctor's notes: {v.notes}" if v.notes else "")
            + (f". Prescribed: {', '.join(p.medication_name for p in rx)}" if rx else "")
        )

    lines += ["", "HOW PAST TREATMENT WENT (patient check-ins at end of course)"]
    outcomes = db.query(CourseOutcome).filter(CourseOutcome.patient_id == patient.id) \
        .order_by(CourseOutcome.created_at.desc()).limit(5).all()
    lines += [
        f"- {_fmt_date(o.created_at)}: {o.medications or 'course'}; "
        f"{'still unwell at the end' if o.still_unwell else 'felt better'}"
        + (f"; resolved: {o.resolved_areas}" if o.resolved_areas else "")
        + (f"; persisting: {o.persisting_areas}" if o.persisting_areas else "")
        + (f"; adherence: {o.adherence_note}" if o.adherence_note else "")
        for o in outcomes
    ] or ["- No completed courses recorded"]

    lines += ["", "TODAY'S VISIT"]
    if session:
        lines.append(f"- Triage risk: {session.risk_score or 'n/a'} ({session.risk_score_numeric or 'n/a'}/100), "
                     f"AI confidence {session.ai_confidence or 'n/a'}%")
        if session.ai_assessment:
            lines.append(f"- Triage assessment: {session.ai_assessment}")
        try:
            summary = json.loads(session.triage_summary or "{}")
        except (TypeError, ValueError):
            summary = {}
        facts = {k: v for k, v in summary.items()
                 if v not in (None, "", [], False) and k not in ("medscan_checked", "history_link_asked")}
        if facts:
            lines.append("- Facts extracted from the conversation: " + json.dumps(facts, ensure_ascii=False))
    if appt and appt.redirect_reason in ("transfer_doctor", "transfer_hospital"):
        frm = db.query(Doctor).filter(Doctor.id == appt.original_doctor_id).first() if appt.original_doctor_id else None
        lines.append(f"- Transferred by {frm.full_name if frm else 'another doctor'}. Reason: "
                     f"{getattr(appt, 'transfer_reason', None) or 'not given'}")
    return "\n".join(lines)


PROMPT = """You are a senior physician writing a handover for a colleague who has never met this patient.
Everything you know is below: the patient's record and today's triage conversation (the conversation is the
only examination that has happened; no vitals or exam findings exist unless the patient reported them).

PATIENT RECORD
{dossier}

TODAY'S TRIAGE CONVERSATION
{transcript}

Use ALL of it. Age, sex, where they live, allergies, current medicines, past diagnoses and how past treatment
went can each change what today's symptoms most likely mean, what is dangerous, and what is safe to prescribe.
Rules:
- Use only reported facts. Never invent vitals, exam findings, test results or a timeline.
- If something important is unknown, say so in "not_yet_asked" instead of assuming.
- Prefer common causes for this age, sex and place; name dangerous alternatives with how to rule them out.
- Prescribing cautions must come from this patient's allergies, current medicines, age, sex/pregnancy and history.
- This supports the doctor's judgement; it is not a decision.

Return ONLY this JSON, no markdown:
{{
  "one_liner": "<one sentence: age, sex, the background that matters today, and the presenting complaint with duration>",
  "presenting_complaint": "<2-3 sentences of what the patient reported today>",
  "relevant_background": ["<a record item that matters today, and why>"],
  "most_likely": {{"diagnosis": "<3-8 words>", "confidence": "low|moderate|high", "reasoning": "<2-3 sentences tying it to the evidence>"}},
  "differentials": [{{"diagnosis": "<name>", "why": "<what supports it>", "rule_out_with": "<question, exam or test>"}}],
  "red_flags": ["<finding or risk the doctor must check now>"],
  "suggested_workup": ["<exam or test>"],
  "prescribing_cautions": ["<allergy, interaction, age, renal, pregnancy or history caution>"],
  "not_yet_asked": ["<important question the triage did not cover>"]
}}
"""


async def generate_case_statement(dossier: str, transcript: str) -> dict | None:
    raw = await ask_gemini(
        PROMPT.format(dossier=dossier, transcript=transcript or "Not available"),
        model="llama-3.3-70b-versatile",
    )
    try:
        clean = raw.strip().replace("```json", "").replace("```", "").strip()
        start, end = clean.find("{"), clean.rfind("}")
        data = json.loads(clean[start:end + 1])
        return data if isinstance(data, dict) and data.get("one_liner") else None
    except (ValueError, TypeError):
        print(f"Case statement parse failed: {raw[:200]}")
        return None


def cache_key(appt) -> str:
    return f"v{CACHE_VERSION}:{appt.id if appt else ''}:{appt.redirect_count if appt else ''}"


def read_cache(session, key: str) -> dict | None:
    try:
        data = json.loads(session.case_file_cache or "{}") if session else {}
    except (TypeError, ValueError):
        return None
    return data if data.get("key") == key else None
