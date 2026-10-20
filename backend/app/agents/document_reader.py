"""
Copies out what a patient's written medical document says, so triage and
the doctor's case statement know about past surgery, scans and results.

It transcribes; it does not interpret. It never describes what an X-ray or
scan image shows. A written report's own conclusion (for example a
radiologist's "Impression") is copied word for word, labelled as written by
the document, never re-worded or judged.
"""
import base64
import io
import json
import os
import re

from app.services.ai_client import client, ask_gemini

VISION_MODEL = os.environ.get("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
MAX_IMAGE_BYTES = 3_800_000   # Groq's limit for inline images is 4 MB

RULES = """You copy facts out of a patient's medical document for a hospital's records.
Rules:
- Copy only what is written. Never guess, infer, diagnose or add advice.
- Never describe or interpret a medical image (X-ray film, scan, photo of a wound).
- If the document states a conclusion (e.g. "Impression", "Final diagnosis"), copy it word for word in "stated_conclusion".
- Use null or [] when something is not written. Dates exactly as written.
Return JSON only:
{
  "is_written_document": true | false,   // false if this is an image with no written report on it
  "document_type": "e.g. discharge summary, operation note, radiology report, lab result, prescription",
  "date": "...", "facility": "...", "clinician": "...",
  "procedures": ["operations or procedures done, as written"],
  "diagnoses": ["diagnoses as written"],
  "medicines": ["medicines with dose, as written"],
  "allergies": ["as written"],
  "results": ["test name: value unit (reference range), as written"],
  "stated_conclusion": "...",
  "follow_up": "instructions or follow-up dates, as written",
  "summary": "one plain sentence of the facts above, e.g. 'Appendectomy at Kisumu County Hospital, 12 Mar 2024; discharged on amoxicillin.'"
}"""


def _json(text: str) -> dict | None:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    try:
        return json.loads(m.group(0)) if m else None
    except ValueError:
        return None


def _clean(d: dict) -> dict:
    keys = ("document_type", "date", "facility", "clinician", "procedures", "diagnoses", "medicines",
            "allergies", "results", "stated_conclusion", "follow_up", "summary")
    out = {}
    for k in keys:
        v = d.get(k)
        if isinstance(v, list):
            v = [str(x).strip()[:300] for x in v if str(x).strip()][:20]
        elif v is not None:
            v = str(v).strip()[:800] or None
        if v:
            out[k] = v
    return out


def pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        return "\n".join((p.extract_text() or "") for p in reader.pages[:8]).strip()
    except Exception as e:
        print(f"PDF read failed: {type(e).__name__}")
        return ""


async def read_document(content: bytes, mime: str, label: str) -> tuple[str, dict | None, str | None]:
    """Returns (status, extracted, reason). Status: read / not_read / failed."""
    try:
        if mime == "application/pdf":
            text = pdf_text(content)
            if len(text) < 40:
                return "not_read", None, "This PDF is a scan with no text. Upload photos of the pages instead."
            reply = await ask_gemini(f"Patient's label: {label}\n\nDOCUMENT TEXT:\n{text[:12000]}", system_context=RULES)
            data = _json(reply)
        else:
            if len(content) > MAX_IMAGE_BYTES:
                return "not_read", None, "The photo is too large for the assistant to read."
            uri = f"data:{mime};base64,{base64.b64encode(content).decode()}"
            res = await client.chat.completions.create(
                model=VISION_MODEL, temperature=0, max_tokens=1200,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": RULES},
                    {"role": "user", "content": [
                        {"type": "text", "text": f"Patient's label: {label}. Copy out what this document says."},
                        {"type": "image_url", "image_url": {"url": uri}},
                    ]},
                ],
            )
            data = _json(res.choices[0].message.content or "")
        if not data:
            return "failed", None, "The assistant couldn't read it."
        if data.get("is_written_document") is False:
            return "not_read", None, "No written report on this image. Your doctor will look at it."
        cleaned = _clean(data)
        return ("read", cleaned, None) if cleaned else ("not_read", None, "No readable text found.")
    except Exception as e:
        print(f"Document read failed: {type(e).__name__}: {e}")
        return "failed", None, "The assistant couldn't read it."
