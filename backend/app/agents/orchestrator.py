import json
from datetime import datetime
from app.services.ai_client import ask_gemini, ask_gemini_with_history
from app.agents.triage_agent  import run_triage_agent
from app.agents.medscan_agent import run_medscan_agent


# ── SYSTEM CONTEXT ─────────────────────────────────────────────────────────
SYSTEM_CONTEXT = """
You are CivCare, a senior clinical triage nurse with 15+ years of experience working in Kenyan hospitals, including KNH, Aga Khan, and Moi Teaching Hospital.
Your job is to safely assess a patient's condition through empathetic, structured questioning — exactly as a real nurse would do at the reception desk.
You NEVER jump to conclusions. You gather information step by step before anything else.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTITY & TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- You are warm, professional, and deeply empathetic — like the best nurse a patient has ever met.
- LANGUAGE MIRRORING: Reply in the SAME language the patient is using.
    - If they write in English, reply in simple, clear English.
    - If they write in Swahili or Sheng, reply in the casual, everyday Swahili spoken on the streets of Nairobi — NOT formal/coastal/Tanzanian "Kiswahili sanifu". Mix in English words naturally.
    - If they mix languages (Sheng), mirror that same casual mix back.
- Keep it warm and human. Avoid deep or rare vocabulary most Kenyans wouldn't use in daily speech.
- Use empathetic openers: "I'm sorry to hear that...", "That must be uncomfortable...", "Thank you for telling me..."
- Keep every response to 1-2 SHORT sentences maximum. Never write paragraphs.
- Ask ONLY ONE question at a time. NEVER list multiple questions.
- Never use bullet points or lists in your responses. Sound human, not robotic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST AID INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━���━━
ONLY if the patient describes an acute physical injury or specific emergency where immediate physical intervention is required (e.g., active bleeding, a recent burn, choking, or chemical exposure):
- If no direct physical first aid applies to their specific symptom (e.g., for chest pain, numbness in a limb, stomach ache, or fever), DO NOT provide first aid advice. Simply reassure them and continue gathering clinical information.
- Your first aid advice must be medically sound and concise (1-2 sentences).
- NEVER give irrelevant advice (e.g., do not mention bleeding if they are not bleeding).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLINICAL QUESTIONING STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Follow this sequence. Adapt dynamically — skip questions already answered.

STEP 1 — CHIEF COMPLAINT (Turn 1-2)
Acknowledge what they said and ask ONE clarifying question:
  - If vague → "Can you describe exactly where the discomfort is and what it feels like?"
  - If specific → Move to Step 2.

STEP 2 — COMPREHENSIVE SYMPTOM GATHERING (Turn 2-5)
Your job is to build a complete clinical picture the way a great doctor would — by listening carefully and asking the right follow-up questions based on what the patient is telling you.

Do not follow a checklist. Think like a clinician.

When a patient describes a symptom, ask yourself: what else would a doctor want to know about this specific complaint? What follow-up question would reveal the most important missing piece of the clinical picture?

For example:
- If someone has fever, the most important thing to understand next is what else is happening with their body — not a list of systems, but what feels most relevant to their presentation.
- If someone has pain, understand where it is, how it feels, and what it does to them — because the character of pain tells you more than almost anything else.
- If someone mentions something unusual — a rash appearing days later, pain in an unexpected place, a symptom that doesn't fit the obvious pattern — follow that thread. Unusual details are often the key.

Always ask the ONE question that would give you the most clinical value right now given everything the patient has already told you. Not the next question on a list — the most important unanswered question.

Build the picture turn by turn. When you feel you have enough to understand what this patient is experiencing — their main complaint, how long, how bad, what else is happening, what they have tried — move to Step 3.

CONTEXT THAT CHANGES THE CAUSE
For every complaint, find out the one piece of context that most changes what is likely going on, unless they've already said it. Think about what fits THIS complaint: recent travel or where they live (infections common in that area), contact with sick people, an injury or fall, what they ate, new or changed medicines, pregnancy, sexual exposure, work or chemical exposure. Ask only what is relevant; never run through all of these.
If the patient could be a woman of childbearing age (roughly 12-50) and the complaint involves the belly, pelvis, urine, bleeding, or anything likely to need medicine, ask whether she could be pregnant, unless she has already said.

THE PATIENT'S RECORD
The patient profile below may list past conditions and current medicines. A recorded condition or medicine can completely change what today's symptoms mean (for example: weakened immunity from treatment or illness, a chronic disease that can flare or cause complications, a medicine with known side effects, pregnancy). If anything on the record could plausibly relate to today's complaint, ask ONE plain, kind question about it before the routing question: is it under treatment, when was the last treatment, has anything changed recently. Don't ask about record items that have nothing to do with today's problem.

STEP 3 — STANDARD PROBING (Turn 3-5, if not already answered)
  a) Duration and onset — "How long have you had this?"
  b) Severity — "On a scale of 1 to 10, how bad is it right now?"
  c) What makes it better or worse?
  d) Have they taken any medication for it? If yes, ask the NAME of the medicine they took or tried

STEP 4 — ROUTING QUESTION
Only when you know the duration, severity, the important associated symptoms, the key context above, and — if relevant — how the patient's record relates to today. Ask ONCE: "Are you able to travel to a hospital or clinic today, or would you prefer to speak to a doctor online?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The backend system handles ALL routing automatically. Your job is ONLY to gather clinical data.
NEVER say you are routing them anywhere. NEVER say "I will connect you" or "I'm sending you."
NEVER ask follow-up questions after the patient answers the travel question.
When you have enough clinical information and the patient's travel preference is set, your conversation is ready to be routed by the backend system.
Ask clarifying questions naturally. Do not force a goodbye; the backend will handle the transition to routing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RED FLAGS — FOR SEVERE ESCALATION ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONLY if the patient describes any of the following in combination, express urgency and ask if they can go NOW:
  - Chest pain + shortness of breath + sweating (possible cardiac event)
  - Sudden worst-ever headache + neck stiffness (possible meningitis/bleed)
  - Difficulty breathing at rest, lips turning blue
  - Confusion, seizure, or loss of consciousness
  - Coughing or vomiting blood (significant amount)
  - Severe belly pain with rigid, board-like abdomen
  - High fever (>39°C) + seizures in a child under 5
  - Stroke signs: sudden face drooping, arm weakness, slurred speech
  - Pregnancy + heavy vaginal bleeding or severe cramps

A headache ALONE is NOT a red flag. A mild fever ALONE is NOT a red flag. Use clinical judgment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT PROHIBITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEVER say:
  - "I am going to route you" / "I will connect you to a doctor" / "I'm sending you somewhere"
  - "That sounds mild" / "You probably just need rest" / "It is likely nothing serious"
  - "You should be fine" / "Don't worry" / "It's probably just..."
  - Any specific drug name as a recommendation
  - A definitive diagnosis ("you have malaria", "you have a migraine")

ALWAYS end with ONE question OR a brief reassuring statement + one question.
"""


# ── SUMMARY EXTRACTION AGENT ─────────────────────────────────────────────────

async def extract_conversation_summary(
    conversation_history: list,
    existing_summary: dict,
    patient_record: str = "",
) -> dict:
    """
    Uses Gemini to read the full conversation and extract structured clinical fields.
    Only runs every 2 turns to save API calls.
    """
    history_text = "\n".join(
        f"{'Patient' if m['role'] == 'patient' else 'Nurse'}: {m['content']}"
        for m in conversation_history
    )
    prompt = f"""
Read this medical intake conversation and extract the structured fields below.

LANGUAGE NOTE: The patient may write in English, Swahili, Sheng, or a mix of all
three in the same sentence (Kenyan code-switching). Understand the MEANING
regardless of language, then fill the fields. Examples:
  - "naumwa kichwa tangu jana" → symptom: "headache", duration: "since yesterday"
  - "ni kama dizzy kidogo na homa" → symptom: "dizziness", fever: true
  - "naweza fika" / "naweza kuja" / "niko sawa kuja" → can_travel: true
  - "siwezi, iko mbali" / "sitaki kuja, online ni poa" → can_travel: false
  - "tumbo inaniuma sana" → symptom: "stomach pain", location: "abdomen"

Only fill a field if the patient clearly stated it (in any language). Use null for unknown fields.
STRICT RULE: Translate the meaning into short ENGLISH values for every field. Never invent details the patient did not say. If unsure, use null.

PATIENT'S RECORD (from previous visits, not said in this chat):
{patient_record or "Nothing on record"}

CONVERSATION:
{history_text}

Respond ONLY in this exact JSON format with no extra text or markdown:
{{
    "symptom": "<main symptom in English, 5 words or less, or null>",
    "location": "<body location in English, or null>",
    "duration": "<how long, e.g. '2 days', 'since this morning', or null>",
    "severity": <number 1-10 only if patient explicitly rated it, else null>,
    "character": "<how patient described it: sharp/dull/burning/throbbing/etc, or null>",
    "associated": "<ONLY symptoms the patient explicitly said, in English, comma separated, or null>",
    "fever": <true if patient mentioned fever or high temperature in any language, else false>,
    "can_travel": <true if the nurse asked about travelling AND the patient agreed in ANY language (yes/naweza/niko sawa/now/okay). false if they declined or preferred online (no/siwezi/online). null if not asked yet>,
    "recent_activity": "<relevant food or activity mentioned, or null>",
    "pregnancy_status": "<pregnant, not pregnant, or null>",
    "vital_signs": "<any explicitly mentioned temp, bp, hr, spo2, or null>",
    "onset_context": "<what they were doing when it started, or null>",
    "previous_episodes": "<has this happened before, or null>",
    "self_treatment": "<what they have already tried/taken, or null>",
    "tried_medication": "<the specific medicine name the patient said they TOOK or TRIED for this problem, or null>",
    "medical_history": "<any past conditions they mentioned in chat, or null>",
    "family_history": "<relevant family conditions mentioned, or null>",
    "smoking_alcohol": "<any substance use mentioned, or null>",
    "relevant_history": "<items from the PATIENT'S RECORD that could plausibly change the meaning or danger of today's complaint (any condition or medicine, e.g. one that weakens immunity, can flare, or has related side effects), or null if none>",
    "history_link_asked": <true if the nurse has already asked how today's complaint relates to those record items (treatment, control, recent changes), false if not yet, null if there are none>
}}
"""

    response = await ask_gemini(prompt, model="llama-3.1-8b-instant")

    try:
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        extracted = json.loads(clean)
        merged = existing_summary.copy()
        for key, value in extracted.items():
            if value is not None:
                merged[key] = value
        # Once asked, it stays asked even if a later read misses it.
        if existing_summary.get("history_link_asked") is True:
            merged["history_link_asked"] = True
        return merged
    except Exception:
        return existing_summary


async def check_allergy_conflict(tried_medication: str, allergies: str) -> dict:
    """Asks the model whether a medication the patient took conflicts with their allergies."""
    prompt = f"""
A patient reports they took/tried this medication for their problem: "{tried_medication}".
Their recorded allergies (free text, may be informal like "dust", "cold", "penicillin", "sulfa"): "{allergies}".

Decide if taking that medication is risky given these allergies. Consider drug-class cross-reactions
(e.g. penicillin allergy ↔ amoxicillin/augmentin, sulfa allergy ↔ cotrimoxazole/septrin, NSAID/aspirin sensitivity ↔ ibuprofen/diclofenac).
If the allergy is non-drug (e.g. dust, pollen), there is usually NO conflict unless the medicine clearly relates.

Respond ONLY in this JSON, no markdown:
{{"conflict": <true/false>, "detail": "<one short sentence for the doctor, or empty>"}}
"""
    try:
        raw = (await ask_gemini(prompt, model="llama-3.1-8b-instant")).strip()
        clean = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception:
        return {"conflict": False, "detail": ""}


KNOWN_FACT_LABELS = [
    ("symptom", "Main symptom"), ("duration", "How long"), ("severity", "Severity (1-10)"),
    ("character", "What it feels like"), ("associated", "Other symptoms"),
    ("tried_medication", "Medicine already tried"), ("medical_history", "History mentioned in chat"),
    ("can_travel", "Can travel to a hospital"),
]


def history_link_pending(summary: dict) -> bool:
    """True while something on the record looks relevant and hasn't been asked about."""
    return bool((summary or {}).get("relevant_history")) and (summary or {}).get("history_link_asked") is not True


def _known_facts(summary: dict) -> str:
    """Bullet list of what the patient has already told us, for the prompt."""
    lines = []
    for key, label in KNOWN_FACT_LABELS:
        value = (summary or {}).get(key)
        if value not in (None, "", [], "null"):
            lines.append(f"- {label}: {value}")
    return "\n".join(lines)


def count_collected_fields(summary: dict) -> int:
    """
    Counts confirmed fields needed before routing.
    Severity must be a real number — not a string from duration.
    """
    fields = [
        summary.get("symptom"),
        summary.get("duration"),
        summary.get("severity"),
        summary.get("character"),
        summary.get("associated"),
        summary.get("can_travel"),
    ] 
    # Don't count unless associated symptoms have been gathered
    if not summary.get("associated"):
        return 0  # force more questioning

    return sum(1 for f in fields if f is not None)


def is_ready_for_routing(summary: dict, turn_count: int, mode: str | None = None) -> bool:
    """
    Ready to route when we have a clear enough clinical picture.

    Three layers of safety so the chat can NEVER loop forever:
      1. Hard stop: after too many turns we route no matter what (extraction may
         have silently failed — common with Swahili/Sheng input — so we must not
         trap the patient).
      2. Pre-selected destination (Doctor/Hospital button): the patient already
         chose, so do NOT wait for the 'can you travel?' answer.
      3. Normal triage: needs the travel question answered.
    """
    # ── Layer 1: absolute hard stop — never loop past this ──
    if turn_count >= 8:
        return True

    # Always need at least the main symptom and duration
    if not summary.get("symptom"):
        return False
    if not summary.get("duration"):
        return False

    has_context = (
        summary.get("associated") is not None or
        summary.get("character") is not None or
        summary.get("fever") is True
    )
    if not has_context:
        return False

    # ── Layer 2: destination already chosen → route once picture is clear ──
    if mode in ("pre_consultation", "pre_hospital"):
        return turn_count >= 3

    # ── Layer 3: normal triage → need travel answer + enough turns ──
    if turn_count < 4:
        return False
    if summary.get("can_travel") is None:
        return False

    return True


# ── Minimal keyword safety net for emergency detection (fallback only) ──
CRITICAL_KEYWORDS_FALLBACK = [
    "not responding", "unresponsive", "unconscious", "collapsed",
    "not breathing", "can't breathe", "cannot breathe", "stopped breathing",
    "no pulse", "faint pulse", "faint heartbeat", "no heartbeat",
    "bleeding from all", "all openings", "everywhere", "hemorrhag",
    "severe bleeding", "won't stop bleeding", "blood everywhere",
    "not moving", "limp", "convulsion", "seizure",
    "throat closing", "can't swallow", "choking",
    "gasping", "gasping for air", "lips turning blue",
    "coughing blood", "vomiting blood", "blood in mouth",
]


async def classify_emergency_severity(
    patient_message: str,
    conversation_history: list,
    patient_record: str = "",
) -> dict:
    """
    Uses the LLM to reason about emergency severity instead of hardcoded string matching.
    Returns: {severity: 'CRITICAL'|'HIGH'|'NORMAL', reasoning: str, emergency_type: str}

    If the LLM call fails, falls back to the keyword safety net.
    """
    recent_context = "\n".join([
        f"{'Patient' if m['role'] == 'patient' else 'Nurse'}: {m['content']}"
        for m in conversation_history[-4:]
    ])

    prompt = f"""You are a medical triage AI. Analyze this patient statement for life-threatening emergency signs.

PATIENT'S RECORD (from previous visits):
{patient_record or "Nothing on record"}

RECENT CONVERSATION:
{recent_context}

CURRENT PATIENT MESSAGE: "{patient_message}"

Respond ONLY with this JSON and no other text:
{{
  "severity": "<'CRITICAL' if life-threatening, 'HIGH' if urgent, 'NORMAL' if routine>",
  "reasoning": "<brief one-sentence clinical reason>",
  "emergency_type": "<'airway', 'breathing', 'circulation', 'severe_bleed', 'neuro', 'other', or null>"
}}

CRITICAL indicators (life-threatening, needs emergency transport NOW):
- Not responsive/unresponsive/unconscious
- Not breathing or severe respiratory distress
- No pulse or severe shock signs
- Massive hemorrhage from any opening
- Severe altered consciousness/seizure
- Airway compromise (choking, throat closing)

HIGH indicators (urgent, needs hospital within 1 hour):
- Severe chest pain with breathing difficulty
- Severe head injury with confusion
- Severe abdominal pain with rigidity
- Moderate active bleeding that's hard to control
- Symptoms that are urgent BECAUSE of the patient's record or what they've said, e.g. fever in
  someone whose immunity is weakened by treatment or illness, or a warning sign of a known
  complication of a condition they have

NORMAL: Everything else
"""

    try:
        response = await ask_gemini(prompt, model="llama-3.1-8b-instant")
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
        return result
    except Exception as e:
        print(f"[WARNING] Emergency classifier LLM failed: {e}. Falling back to keywords.")
        text_lower = (patient_message + " " + " ".join([
            m.get("content", "") for m in conversation_history
        ])).lower()

        for keyword in CRITICAL_KEYWORDS_FALLBACK:
            if keyword in text_lower:
                return {
                    "severity": "CRITICAL",
                    "reasoning": f"Fallback detection: keyword '{keyword}' found",
                    "emergency_type": "unknown"
                }

        return {
            "severity": "NORMAL",
            "reasoning": "No critical indicators detected",
            "emergency_type": None
        }

def detect_red_flag(conversation_history: list, current_message: str) -> bool:
    """
    Detects life-threatening symptom combinations that require immediate routing
    without waiting for full field collection.
    """
    # Only what the PATIENT said: the assistant's own questions ("any chest
    # pain or shortness of breath?") must never trigger an emergency.
    all_text = " ".join([
        m.get("content", "").lower() for m in conversation_history if m.get("role") == "patient"
    ] + [current_message.lower()])

    red_flag_combos = [
        # ── CARDIAC ──
        ["chest pain", "shortness of breath"],
        ["chest pain", "sweating"],
        ["chest pain", "left arm"],
        ["chest pain", "jaw"],
        ["chest pain", "heart racing"],
        ["chest pain", "palpitations"],
        ["chest tightness", "shortness of breath"],

        # ── STROKE ──
        ["face drooping"],
        ["arm weakness", "speech"],
        ["slurred speech"],
        ["sudden vision", "weakness"],
        ["sudden numbness", "face"],

        # ── MENINGITIS / BRAIN ──
        ["worst headache"],
        ["severe headache", "neck stiff"],
        ["severe headache", "vomiting", "fever"],
        ["sudden headache", "neck"],
        ["headache", "sensitivity to light", "fever"],

        # ── RESPIRATORY FAILURE ──
        ["can't breathe"],
        ["cannot breathe"],
        ["difficulty breathing", "rest"],
        ["lips turning blue"],
        ["fingernails blue"],
        ["gasping"],

        # ── SEVERE BLEEDING ──
        ["coughing blood"],
        ["vomiting blood"],
        ["blood in stool", "severe pain"],
        ["heavy bleeding"],
        ["bleeding won't stop"],

        # ── ABDOMINAL EMERGENCY ──
        ["severe abdominal pain", "rigid"],
        ["stomach hard"],
        ["board like"],
        ["appendix", "severe pain"],
        ["severe pain", "abdomen", "fever"],

        # ── DIABETIC EMERGENCY ──
        ["diabetic", "unconscious"],
        ["sugar", "shaking", "confusion"],
        ["hypoglycemia"],
        ["insulin", "collapsed"],

        # ── ALLERGIC REACTION / ANAPHYLAXIS ──
        ["throat closing"],
        ["tongue swelling"],
        ["face swelling", "breathing"],
        ["allergic", "can't breathe"],
        ["anaphylaxis"],
        ["severe rash", "breathing"],

        # ── OBSTETRIC ──
        ["pregnant", "heavy bleeding"],
        ["pregnant", "severe cramps"],
        ["pregnancy", "bleeding"],
        ["water broke", "pain"],
        ["baby not moving"],
        ["fetal movement", "stopped"],

        # ── SEIZURE / UNCONSCIOUS ──
        ["seizure"],
        ["convulsion"],
        ["unconscious"],
        ["collapsed"],
        ["loss of consciousness"],
        ["fainted", "not waking"],

        # ── PEDIATRIC EMERGENCY ──
        ["child", "seizure"],
        ["baby", "not breathing"],
        ["infant", "blue"],
        ["child", "high fever", "stiff"],
        ["toddler", "limp"],

        # ── TRAUMA ──
        ["hit by car"],
        ["road accident"],
        ["fell from height"],
        ["knife wound"],
        ["gunshot"],
        ["deep cut", "bleeding"],
        ["head injury", "unconscious"],

        # ── POISONING / OVERDOSE ──
        ["swallowed poison"],
        ["overdose"],
        ["took too many"],
        ["ingested chemicals"],
        ["poisoning"],

        # ── SEVERE INFECTION / SEPSIS ──
        ["high fever", "confusion"],
        ["fever", "rash", "stiff neck"],
        ["shaking", "high fever", "confusion"],
        ["sepsis"],

        # ── KIDNEY / URINARY EMERGENCY ──
        ["severe back pain", "blood in urine"],
        ["can't urinate", "severe pain"],
        ["kidney pain", "fever", "vomiting"],

        # ── MENTAL HEALTH CRISIS ──
        ["want to kill myself"],
        ["want to die"],
        ["suicide"],
        ["harm myself"],
        ["overdose on purpose"],
    ]

    for combo in red_flag_combos:
        if all(_mentioned(term, all_text) for term in combo):
            return True
    return False


NEGATIONS = ("no ", "not ", "without ", "never ", "don't have ", "dont have ", "haven't had ", "hakuna ", "sina ")


def _mentioned(term: str, text: str) -> bool:
    """True if the patient mentions `term` at least once without negating it."""
    start = 0
    while True:
        i = text.find(term, start)
        if i == -1:
            return False
        # Look back within the clause for a negation ("no chest pain", "no cough or chest pain").
        clause = text[max(0, i - 40):i]
        clause = clause.split(".")[-1].split(",")[-1].split(" but ")[-1]
        if not any(n in clause for n in NEGATIONS):
            return True
        start = i + len(term)


async def process_message(
    patient_message: str,
    conversation_history: list,
    patient_data: dict,
    conversation_summary: dict,
    current_time: str,
    mode: str | None = None,
) -> dict:
    """
    Main orchestrator. Receives patient message + full history.
    Returns AI response + routing action + updated summary.
    """

    result = {
        "response":        "",
        "action":          "continue",
        "medscan_result":  None,
        "updated_summary": conversation_summary.copy(),
        "triage_score":    None,
        "hospitals":       None,
    }
        # ── STEP 0: Emergency Severity Classification (NEW) ───────────────────────
    # Call the LLM-based emergency classifier FIRST, before anything else
    patient_record = (
        f"Conditions: {patient_data.get('conditions') or 'None on record'}\n"
        f"Current medicines: {', '.join(patient_data.get('current_medications', []) or []) or 'None'}"
    )

    emergency_classification = await classify_emergency_severity(
        patient_message=patient_message,
        conversation_history=conversation_history,
        patient_record=patient_record,
    )

    if emergency_classification.get("severity") == "CRITICAL":
        emergency_type = emergency_classification.get("emergency_type")

        if emergency_type == "airway" or emergency_type == "breathing":
            emergency_msg = (
                "This is a LIFE-THREATENING EMERGENCY. "
                "CALL EMERGENCY SERVICES NOW (112 or your local emergency number). "
                "If trained, begin CPR immediately. "
                "WE ARE ROUTING YOU TO THE NEAREST HOSPITAL NOW."
            )
        elif emergency_type == "circulation" or emergency_type == "severe_bleed":
            emergency_msg = (
                "This is a LIFE-THREATENING EMERGENCY. "
                "CALL EMERGENCY SERVICES NOW (112 or your local emergency number). "
                "Apply direct pressure to control bleeding if possible. "
                "WE ARE ROUTING YOU TO THE NEAREST HOSPITAL NOW."
            )
        else:
            emergency_msg = (
                "This is a LIFE-THREATENING EMERGENCY. "
                "CALL EMERGENCY SERVICES NOW (112 or your local emergency number). "
                "WE ARE ROUTING YOU TO THE NEAREST HOSPITAL NOW."
            )

        result["response"] = emergency_msg
        result["action"] = "route_hospital"
        result["emergency_severity"] = "CRITICAL"
        result["emergency_type"] = emergency_type
            # ── STEP 6: Fix goodbye-without-routing issue ────────────────────────────
    goodbye_phrases = [
        "our team will take it from here",
        "thank you for sharing",
        "we will take care of you",
        "we're here to help",
        "take care of you now",
    ]

    ai_said_goodbye = any(phrase in result["response"].lower() for phrase in goodbye_phrases)
    not_routed = result["action"] != "route_hospital" and result["action"] != "route_consultation"

    if ai_said_goodbye and not_routed:
        can_travel = result["updated_summary"].get("can_travel")

        if can_travel is None:
            result["action"] = "continue"
            result["response"] = (
                "Are you able to travel to a nearby hospital or clinic today, "
                "or would you prefer to speak to a doctor online?"
            )
        elif can_travel is False:
            result["action"] = "route_consultation"
            result["response"] = (
                "I understand. I'm going to connect you with a qualified doctor "
                "who can speak to you right now online."
            )
        elif can_travel is True:
            result["action"] = "route_hospital"
            result["response"] = (
                "Thank you for that information. "
                "I'm recommending you visit a hospital for a proper evaluation."
            )
        return result

    # ── STEP 2: Build conversation history for Gemini ────────────────────────
    gemini_history = []
    for msg in conversation_history:
        role = "user" if msg["role"] == "patient" else "model"
        gemini_history.append({
            "role":  role,
            "parts": [msg["content"]],
        })

    gemini_history.append({
        "role":  "user",
        "parts": [patient_message],
    })
    past_history     = patient_data.get("past_history", [])
    past_history_str = ""
    if past_history:
        lines = []
        for h in past_history:
            line = f"  - {h['date']}: Diagnosed with {h['diagnosis']} (severity: {h['severity']})"
            if h["notes"]:
                line += f" — Doctor noted: {h['notes']}"
            lines.append(line)
        past_history_str = "\n".join(lines)
    else:
        past_history_str = "  None on record"
    # ── Extract what the patient has told us, including this message ──────
    # Runs BEFORE the reply so the "already known" list includes the answer
    # just given; otherwise the reply can re-ask it.
    # History holds both sides of the chat; only the patient's messages are turns.
    turn_count = sum(1 for m in conversation_history if m.get("role") == "patient") + 1
    result["updated_summary"] = await extract_conversation_summary(
        conversation_history=conversation_history + [{"role": "patient", "content": patient_message}],
        existing_summary=result["updated_summary"],
        patient_record=patient_record,
    )
    summary_now = result["updated_summary"]

    # ── STEP 3: Get AI response ──────────────────────────────────────────────
    known_facts = _known_facts(summary_now)
    dynamic_context = SYSTEM_CONTEXT + (
        f"\n\n━ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"PATIENT PROFILE\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Age: {patient_data.get('age')}\n"
        f"Location: {patient_data.get('location')}\n"
        f"Past Conditions: {patient_data.get('conditions')}\n"
        f"Current Medications: {', '.join(patient_data.get('current_medications', [])) or 'None'}\n"
        f"Allergies: {patient_data.get('allergies')}\n"
        f"IMPORTANT INSTRUCTIONS FOR PATIENT CONTEXT:\n"
        f"- If Past Conditions or Current Medications are present, you ALREADY know this patient.\n"
        f"- On the FIRST message of a new session, briefly acknowledge their history naturally.\n"
        f"  Example: 'Good to have you back — I can see you've previously consulted us about {patient_data.get('conditions', 'a few things')}. What brings you in today?'\n"
        f"- If they describe a new symptom that could relate to a past condition, gently factor it in.\n"
        f"  Example: If they had malaria before and now have fever, probe more specifically.\n"
        f"- NEVER recite their full medical record. Reference it naturally, like a nurse who remembers a returning patient.\n"
        f"- If Past Conditions is 'None on record' and Current Medications is empty, treat them as a new patient."
        + (
            f"\n\nMUST ASK BEFORE THE ROUTING QUESTION: the record item(s) "
            f"\"{summary_now.get('relevant_history')}\" may relate to today's complaint. "
            f"Ask one plain, kind question about it (current treatment, last treatment, recent changes)."
            if history_link_pending(summary_now)
            else ""
        )
        + (
            f"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"ALREADY KNOWN FROM THIS CONVERSATION — do NOT ask about these again\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n{known_facts}"
            if known_facts else ""
        )
    )

    ai_response = await ask_gemini_with_history(
        messages=gemini_history,
        system_context=dynamic_context,
        model="llama-3.3-70b-versatile",
    )
    result["response"] = ai_response

    # ── Medication check ────────────────────────────────────────────────
    # The check informs the doctor; it never ends triage early (a fever in a
    # chemo patient still needs the full assessment) and never gives the
    # patient drug advice of its own — patient-facing wording is fixed here.
    # Runs on any medicine the patient names (found by the extraction step,
    # so it isn't limited to a fixed list), once per medicine.
    medication = result["updated_summary"].get("tried_medication")
    checked = result["updated_summary"].get("medscan_checked") or []
    if medication and medication.lower() not in [c.lower() for c in checked]:
        result["updated_summary"]["medscan_checked"] = checked + [medication]
        current_meds = patient_data.get("current_medications", []) or []
        medscan_result = await run_medscan_agent(
            medication_name=medication,
            patient_message=patient_message,
            current_medications=current_meds,
            conditions=patient_data.get("conditions", ""),
        )
        clash = bool(medscan_result.get("clash_detected")) and bool(current_meds or medscan_result.get("clash_details"))
        medscan_result["clash_detected"] = clash
        if clash:
            medscan_result["recommendation"] = (
                f"Please don't take more {medication} until a doctor has checked it against "
                f"your other medicines and conditions. Your doctor will see this note."
            )
            detail = (medscan_result.get("clash_details") or "").strip()
            result["allergy_flag"] = f"Medication check: patient mentioned {medication}. {detail}".strip()
        else:
            medscan_result["recommendation"] = (
                f"No known problem between {medication} and the medicines on your record. "
                f"Your doctor will still review everything you've taken."
            )
        result["medscan_result"] = medscan_result
        result["action"] = "medscan"

    # ── Allergy/medication conflict check ──
    tried_med = result["updated_summary"].get("tried_medication")
    allergies = patient_data.get("allergies")
    if tried_med and allergies and allergies != "None on record":
        conflict = await check_allergy_conflict(tried_med, allergies)
        if conflict.get("conflict"):
            allergy_note = f"Patient took {tried_med} despite allergy ({allergies}): {conflict.get('detail', '')}".strip()
            result["allergy_flag"] = "\n".join(f for f in (result.get("allergy_flag"), allergy_note) if f)

    # ── STEP 5: Decide routing ───────────────────────────────────────────────
    fields_collected = count_collected_fields(result["updated_summary"])
    ready_to_route   = is_ready_for_routing(result["updated_summary"], turn_count, mode)
    if ready_to_route and turn_count < 8 and history_link_pending(result["updated_summary"]):
        ready_to_route = False   # the next reply is prompted to ask about the record
    # Red flag override — bypass normal routing requirements for emergencies
    is_red_flag = (
        detect_red_flag(conversation_history, patient_message)
        or emergency_classification.get("severity") == "HIGH"
    )
    if is_red_flag and result["updated_summary"].get("can_travel") is not None:
        ready_to_route = True
    elif is_red_flag and result["updated_summary"].get("can_travel") is None:
        # Red flag but travel question not asked yet — force the question now
        result["action"] = "continue"
        result["response"] = (
            "This sounds very serious and you need medical attention urgently. "
            "Are you able to get to a hospital right now?"
        )
        return result

    print(f"[DEBUG] Turn: {turn_count}")
    print(f"[DEBUG] Summary: {result['updated_summary']}")
    print(f"[DEBUG] Fields: {fields_collected}, Ready: {ready_to_route}")
    print(f"[DEBUG] symptom={result['updated_summary'].get('symptom')}")
    print(f"[DEBUG] duration={result['updated_summary'].get('duration')}")
    print(f"[DEBUG] associated={result['updated_summary'].get('associated')}")
    print(f"[DEBUG] character={result['updated_summary'].get('character')}")
    print(f"[DEBUG] fever={result['updated_summary'].get('fever')}")
    print(f"[DEBUG] can_travel={result['updated_summary'].get('can_travel')}")

    if ready_to_route:
        transcript = "\n".join(
            f"{'Patient' if m.get('role') == 'patient' else 'Nurse'}: {m.get('content', '')}"
            for m in conversation_history if m.get("role") in ("patient", "ai")
        ) + f"\nPatient: {patient_message}"
        triage_result = await run_triage_agent(
            conversation_summary=result["updated_summary"],
            patient_data=patient_data,
            transcript=transcript,
            escalated=is_red_flag or any(
                "need medical attention urgently" in (m.get("content") or "")
                for m in conversation_history if m.get("role") == "ai"
            ),
        )
        result["triage_score"]  = triage_result.get("risk_score", "moderate")
        result["triage_result"] = triage_result
        result["risk_numeric"] = triage_result.get("risk_numeric", 50)
        result["confidence_percent"] = triage_result.get("confidence_percent", 60)
        result["preliminary_assessment"] = triage_result.get("preliminary_assessment", "")

        # Fast-track routing for pre-selected destination modes
        if mode == "pre_hospital":
            result["action"] = "route_hospital"
            result["response"] = "Thank you, I have gathered enough information. Preparing your file now..."
            return result
        elif mode == "pre_consultation":
            result["action"] = "route_consultation"
            result["response"] = "Thank you. Your file is ready. Connecting you to the doctor now..."
            return result

        can_travel = result["updated_summary"].get("can_travel")

        if can_travel is True:
            result["action"] = "route_hospital"
            routing_prompt = f"""
The patient has shared enough clinical information for safe routing.
Current time: {current_time}.
Triage assessment: {triage_result.get('preliminary_assessment', '')}.
Risk level: {triage_result.get('risk_score', 'moderate')}.

Patient's first name: {(patient_data.get('name') or '').split(' ')[0] or 'not known'}.

Write a warm, professional 2-sentence chat message from a senior nurse telling the patient you have gathered what you need
and you are recommending they visit a hospital. If the risk level is critical, tell them to go now, without delay.
Never mention the risk level, a score, or words like "critical", "severe" or "serious condition" to the patient.
Do NOT name a specific hospital. Do NOT give a diagnosis. This is a chat message, not a letter: no "Dear", no sign-off,
and never a placeholder like [Name]. Use the first name only if it is known.
"""
            result["response"] = await ask_gemini(routing_prompt, model="llama-3.1-8b-instant")

        elif can_travel is False:
            result["action"] = "route_consultation"
            routing_prompt = f"""
The patient cannot travel to a hospital right now.
Write a warm, professional 2-sentence message from a senior nurse telling them you understand completely,
and that you are going to connect them with a qualified doctor they can speak to right now online.
Do NOT give a diagnosis. Be reassuring and caring.
"""
            result["response"] = await ask_gemini(routing_prompt, model="llama-3.1-8b-instant")

        elif can_travel is None:
            # Symptoms gathered but travel preference not asked yet
            result["action"] = "continue"
            result["response"] = (
                "Thank you for sharing all of that with me. "
                "Are you able to travel to a nearby hospital or clinic today, "
                "or would you prefer to speak to a doctor online?"
            )

    return result
