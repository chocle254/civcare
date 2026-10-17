from app.services.ai_client import ask_gemini
from app.services.rlhf import get_learned_lessons


async def run_triage_agent(
    conversation_summary: dict,
    patient_data: dict,
    transcript: str = "",
    escalated: bool = False,
) -> dict:
    """
    Generates a triage risk score from the conversation summary and patient history.
    This runs silently — the patient never sees the output.
    The doctor always sees it on their dashboard.

    Before scoring, it loads lessons distilled from past doctor verdicts (RLHF)
    and injects them into the prompt, so the model carries forward corrections
    learned from real cases — especially ones it previously got wrong.
    """

    # ── Pull what the AI has learned from past doctor verdicts ──
    lessons = get_learned_lessons()
    if lessons:
        lessons_block = "\n".join(f"- {lesson}" for lesson in lessons)
        learned_corrections = f"""

LEARNED CLINICAL CORRECTIONS (from doctors who reviewed your past triage decisions — apply these):
{lessons_block}
"""
    else:
        learned_corrections = ""

    prompt = f"""
You are an expert clinical triage AI assistant. Your role is to assess patient risk utilizing validated clinical scoring logic (such as NEWS2, HEART score, Wells score concepts) where applicable, heavily weighting the interplay between reported symptoms and patient medical history.

PATIENT INFORMATION:
- Age: {patient_data.get('age', 'Unknown')}
- Known conditions: {patient_data.get('conditions', 'None recorded')}
- Current medications: {patient_data.get('current_medications', 'None recorded')}
- Known allergies: {patient_data.get('allergies', 'None recorded')}

REPORTED SYMPTOMS:
- Main symptom: {conversation_summary.get('symptom', 'Not specified')}
- Duration: {conversation_summary.get('duration', 'Not specified')}
- Severity (1-10): {conversation_summary.get('severity', 'Not specified')}
- Character: {conversation_summary.get('character', 'Not specified')}
- Associated symptoms: {conversation_summary.get('associated', 'None reported')}
- Fever/Temperature mentioned: {conversation_summary.get('fever', False)}
- Vital signs mentioned: {conversation_summary.get('vital_signs', 'None')}
- Recent food/activity: {conversation_summary.get('recent_activity', 'Not specified')}
- Pregnancy Status: {conversation_summary.get('pregnancy_status', 'Not specified')}
- Record items judged relevant to today: {conversation_summary.get('relevant_history') or 'None'}

FULL TRIAGE CONVERSATION (the evidence; the fields above are a summary of it and may miss things):
{transcript or 'Not available'}
{'NOTE: the triage nurse escalated this conversation as urgent.' if escalated else ''}
{learned_corrections}
INSTRUCTIONS:
1. Conduct a "Pre-triage Red Flag Scan" (e.g. chest pain + shortness of breath, sudden severe headache, confusion).
2. Consider age/gender/pregnancy modifiers (e.g. chest pain in a diabetic is high risk, any pain with bleeding in pregnancy is critical).
   Known conditions and current medicines change the meaning of symptoms. Ask yourself what the record makes more likely or more dangerous for THIS complaint (weakened immunity, a chronic disease flaring or causing complications, a medicine side effect or interaction, pregnancy, recent surgery) and apply the higher-risk reading where it fits. Name that possibility in the assessment.
   Local epidemiology matters: weigh the infections and conditions that are common where the patient lives.
   Use only what the patient reported. Do not assume signs that were never asked about.
3. Assign a numeric risk score on a strict 1-100 rubric:
   - 1-30: Low risk (routine, non-urgent consultation)
   - 31-70: Moderate risk (requires medical attention within 12-24 hrs)
   - 71-100: Critical/High risk (immediate hospital evaluation required)

Respond ONLY in this exact JSON format with no extra text:
{{
    "risk_score": "low" | "moderate" | "critical",
    "risk_numeric": <number 1-100>,
    "preliminary_assessment": "<2-3 sentence clinical summary: most likely cause, the dangerous alternatives to rule out, and why>",
    "confidence_percent": <number 0-100>,
    "red_flags": ["<flag1>", "<flag2>"],
    "recommended_action": "<what the doctor should prioritise>"
}}
"""

    response = await ask_gemini(prompt)

    try:
        import json
        # Clean response in case Gemini adds markdown
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception:
        # Fallback if JSON parsing fails
        return {
            "risk_score":            "moderate",
            "risk_numeric":          50,
            "preliminary_assessment": response,
            "confidence_percent":    60,
            "red_flags":             [],
            "recommended_action":    "Doctor to assess in person",
        }
