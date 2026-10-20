"""
Patients' own medical records: X-rays and scans, surgery and discharge
reports, lab results.

- Only the patient uploads and deletes. Doctors caring for the patient can
  view; every view is written to the access log the patient can read.
- Files sit in a private bucket and are opened through 5-minute links.
- For written reports the assistant copies out what the document says
  (app/agents/document_reader.py). It never reads X-ray or scan images.
"""
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.document import MedicalDocument
from app.services import storage
from app.services.authz import Principal, current_user, current_patient, can_patient, only_patient, log_access

router = APIRouter()

KINDS = {
    "xray":       ("X-ray or scan image", False),   # (label, assistant reads it)
    "surgery":    ("Surgery or operation report", True),
    "discharge":  ("Discharge summary", True),
    "imaging":    ("Radiology or scan report (written)", True),
    "lab":        ("Lab result", True),
    "prescription": ("Prescription or clinic card", True),
    "other":      ("Other medical document", True),
}
TYPES = {"image/jpeg": b"\xff\xd8", "image/png": b"\x89PNG", "image/webp": b"RIFF", "application/pdf": b"%PDF"}
MAX_PER_PATIENT = 60


def _iso(dt):
    return dt.isoformat() + "Z" if dt else None


def doc_out(d: MedicalDocument) -> dict:
    try:
        extracted = json.loads(d.extracted) if d.extracted else None
    except ValueError:
        extracted = None
    return {
        "id": d.id, "kind": d.kind, "kind_label": KINDS.get(d.kind, ("Document",))[0],
        "title": d.title, "taken_on": d.taken_on, "facility": d.facility, "notes": d.notes,
        "file_name": d.file_name, "mime_type": d.mime_type, "size_bytes": d.size_bytes,
        "read_status": d.read_status, "extracted": extracted,
        "uploaded_at": _iso(d.uploaded_at),
    }


def records_for_ai(db: Session, patient_id: str, limit: int = 12) -> list[str]:
    """One line per uploaded record, for triage and the case statement."""
    rows = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id) \
        .order_by(MedicalDocument.uploaded_at.desc()).limit(limit).all()
    lines = []
    for d in rows:
        head = f"{d.title} ({KINDS.get(d.kind, ('document',))[0].lower()}"
        head += f", {d.taken_on}" if d.taken_on else ""
        head += f", {d.facility}" if d.facility else ""
        head += ")"
        if d.kind == "xray":
            line = f"{head}: image only; the doctor will look at it"
        else:
            try:
                ex = json.loads(d.extracted) if d.extracted else {}
            except ValueError:
                ex = {}
            facts = ex.get("summary")
            extra = []
            if ex.get("procedures"):
                extra.append("procedures: " + "; ".join(ex["procedures"][:4]))
            if ex.get("diagnoses"):
                extra.append("diagnoses written: " + "; ".join(ex["diagnoses"][:4]))
            if ex.get("medicines"):
                extra.append("medicines: " + "; ".join(ex["medicines"][:5]))
            if ex.get("allergies"):
                extra.append("allergies: " + "; ".join(ex["allergies"][:4]))
            if ex.get("stated_conclusion"):
                extra.append(f"report's own conclusion: \"{ex['stated_conclusion'][:240]}\"")
            body = "; ".join(x for x in [facts] + extra if x)
            line = f"{head}: {body}" if body else f"{head}: not readable by the assistant"
        if d.notes:
            line += f". Patient's note: {d.notes[:160]}"
        lines.append(line)
    return lines


async def _read_later(doc_id: str, content: bytes, mime: str, label: str) -> None:
    from app.agents.document_reader import read_document
    status, extracted, reason = await read_document(content, mime, label)
    db = SessionLocal()
    try:
        d = db.query(MedicalDocument).filter(MedicalDocument.id == doc_id).first()
        if d:
            d.read_status = status
            payload = extracted or {}
            if reason:
                payload["reason"] = reason
            d.extracted = json.dumps(payload, ensure_ascii=False) if payload else None
            db.commit()
    finally:
        db.close()


@router.get("/kinds")
async def kinds():
    return [{"id": k, "label": v[0], "assistant_reads": v[1]} for k, v in KINDS.items()]


@router.post("/upload")
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    kind: str = Form(...),
    title: str = Form(...),
    taken_on: str = Form(""),
    facility: str = Form(""),
    notes: str = Form(""),
    consent: str = Form("false"),
    user: Principal = Depends(current_patient),
    db: Session = Depends(get_db),
):
    if consent.lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=400, detail="Please agree to how CivCare stores and shares this file.")
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail="Choose what kind of record this is.")
    title = (title or "").strip()[:120]
    if not title:
        raise HTTPException(status_code=400, detail="Give the record a name, e.g. Chest X-ray.")
    if db.query(MedicalDocument).filter(MedicalDocument.patient_id == user.id).count() >= MAX_PER_PATIENT:
        raise HTTPException(status_code=400, detail=f"You can keep up to {MAX_PER_PATIENT} records. Delete an old one first.")

    content = await file.read(storage.MAX_BYTES + 1)
    if len(content) > storage.MAX_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 10 MB. Take a smaller photo or split the PDF.")
    mime = (file.content_type or "").lower()
    magic = TYPES.get(mime)
    if not magic or not content.startswith(magic):
        raise HTTPException(status_code=400, detail="Upload a photo (JPG, PNG, WebP) or a PDF.")

    doc_id = str(uuid.uuid4())
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}[mime]
    path = f"{user.id}/{doc_id}.{ext}"
    try:
        await storage.upload(path, content, mime)
    except Exception as e:
        print(f"Record upload failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail="Could not save the file. Please try again.")

    reads = KINDS[kind][1]
    doc = MedicalDocument(
        id=doc_id, patient_id=user.id, kind=kind, title=title,
        taken_on=(taken_on or "").strip()[:20] or None, facility=(facility or "").strip()[:120] or None,
        notes=(notes or "").strip()[:500] or None, storage_path=path,
        file_name=(file.filename or "")[:120] or None, mime_type=mime, size_bytes=len(content),
        read_status="pending" if reads else "not_read", consented_at=datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    log_access(db, user, user.id, "uploaded a medical record", title)
    if reads:
        background.add_task(_read_later, doc_id, content, mime, f"{title} ({KINDS[kind][0]})")
    return doc_out(doc)


@router.get("/mine")
async def my_documents(user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    rows = db.query(MedicalDocument).filter(MedicalDocument.patient_id == user.id) \
        .order_by(MedicalDocument.uploaded_at.desc()).all()
    return [doc_out(d) for d in rows]


@router.get("/patient/{patient_id}")
async def patient_documents(patient_id: str, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    can_patient(db, user, patient_id)
    rows = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id) \
        .order_by(MedicalDocument.uploaded_at.desc()).all()
    if user.is_doctor and rows:
        log_access(db, user, patient_id, "viewed list of uploaded records")
    return [doc_out(d) for d in rows]


@router.get("/{doc_id}/open")
async def open_document(doc_id: str, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    d = db.query(MedicalDocument).filter(MedicalDocument.id == doc_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Record not found.")
    can_patient(db, user, d.patient_id)
    try:
        url = await storage.signed_url(d.storage_path, 300)
    except Exception as e:
        print(f"Signed link failed: {type(e).__name__}")
        raise HTTPException(status_code=502, detail="Could not open the file. Please try again.")
    if user.is_doctor:
        log_access(db, user, d.patient_id, "opened an uploaded record", d.title)
    return {"url": url, "expires_in": 300, "mime_type": d.mime_type}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: Principal = Depends(current_patient), db: Session = Depends(get_db)):
    d = db.query(MedicalDocument).filter(MedicalDocument.id == doc_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Record not found.")
    only_patient(user, d.patient_id)
    try:
        await storage.delete([d.storage_path])
    except Exception as e:
        print(f"Record delete failed: {type(e).__name__}")
        raise HTTPException(status_code=502, detail="Could not delete the file. Please try again.")
    db.delete(d)
    db.commit()
    return {"message": "Deleted."}


async def delete_all_for(db: Session, patient_id: str) -> int:
    """Account erasure: remove every uploaded file and its row."""
    rows = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id).all()
    if not rows:
        return 0
    await storage.delete([d.storage_path for d in rows])
    for d in rows:
        db.delete(d)
    return len(rows)
