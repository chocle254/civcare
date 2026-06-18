import os
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.consultation import Consultation, ConsultationStatus

router = APIRouter()

DAILY_API_KEY = os.environ.get("DAILY_API_KEY", "")
DAILY_API_URL = "https://api.daily.co/v1"


def _room_name(consultation_id: str) -> str:
    """Deterministic Daily room name from the consultation id so both
    doctor and patient resolve the exact same room. Daily names allow
    alphanumerics/underscore/dash and must be reasonably short."""
    return ("cc" + consultation_id.replace("-", ""))[:40]


def _auth_headers():
    if not DAILY_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Video calling is not configured. Set DAILY_API_KEY on the server.",
        )
    return {"Authorization": f"Bearer {DAILY_API_KEY}"}


class VideoStart(BaseModel):
    consultation_id: str
    doctor_id: str


@router.post("/start")
async def start_video(data: VideoStart, db: Session = Depends(get_db)):
    """Doctor starts the consultation. Creates (or reuses) a Daily room,
    flips the consultation to IN_PROGRESS, returns the room URL to join."""
    consult = db.query(Consultation).filter(
        Consultation.id == data.consultation_id
    ).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    name = _room_name(data.consultation_id)
    exp = int(time.time()) + 2 * 60 * 60  # room auto-expires after 2 hours
    payload = {
        "name": name,
        "privacy": "public",
        "properties": {
            "exp": exp,
            "enable_chat": True,
            "enable_screenshare": True,
            "start_video_off": False,
            "start_audio_off": False,
        },
    }

    async with httpx.AsyncClient(timeout=15) as http:
        res = await http.post(f"{DAILY_API_URL}/rooms", json=payload, headers=_auth_headers())
        if res.status_code == 200:
            room = res.json()
        elif res.status_code == 400 and "already exists" in res.text.lower():
            got = await http.get(f"{DAILY_API_URL}/rooms/{name}", headers=_auth_headers())
            if got.status_code != 200:
                raise HTTPException(status_code=502, detail="Could not load video room.")
            room = got.json()
        else:
            raise HTTPException(status_code=502, detail=f"Daily error: {res.text}")

    consult.status = ConsultationStatus.IN_PROGRESS
    if not consult.call_initiated_at:
        consult.call_initiated_at = datetime.utcnow()
    db.commit()

    return {"room_url": room["url"], "status": consult.status}


@router.get("/room")
async def get_room(consultation_id: str, db: Session = Depends(get_db)):
    """Patient polls this to learn whether the doctor has started the call yet."""
    consult = db.query(Consultation).filter(
        Consultation.id == consultation_id
    ).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    name = _room_name(consultation_id)
    async with httpx.AsyncClient(timeout=15) as http:
        got = await http.get(f"{DAILY_API_URL}/rooms/{name}", headers=_auth_headers())

    if got.status_code == 404:
        return {"ready": False, "status": consult.status}
    if got.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not load video room.")

    return {"ready": True, "room_url": got.json()["url"], "status": consult.status}
