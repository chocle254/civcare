import os
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.consultation import Consultation, ConsultationStatus
from app.services.authz import Principal, current_user, current_doctor, must_be_doctor, can_consultation

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
async def start_video(data: VideoStart, user: Principal = Depends(current_doctor), db: Session = Depends(get_db)):
    """Doctor starts the consultation. Creates (or reuses) a private Daily
    room, flips the consultation to IN_PROGRESS, returns a join link that
    carries a meeting token only this doctor gets."""
    must_be_doctor(user, data.doctor_id)
    consult = can_consultation(db, user, data.consultation_id)

    name = _room_name(data.consultation_id)
    exp = int(time.time()) + 2 * 60 * 60  # room auto-expires after 2 hours
    payload = {
        "name": name,
        # Private: only someone holding a meeting token for this room can join.
        "privacy": "private",
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
            if room.get("privacy") != "private":
                await http.post(f"{DAILY_API_URL}/rooms/{name}", json={"privacy": "private"}, headers=_auth_headers())
        else:
            print(f"Daily room error: {res.status_code}")
            raise HTTPException(status_code=502, detail="Could not create the video room. Try again.")
        join_url = await _join_url(http, room["url"], name, owner=True)

    first_start = consult.status != ConsultationStatus.IN_PROGRESS
    consult.status = ConsultationStatus.IN_PROGRESS
    if not consult.call_initiated_at:
        consult.call_initiated_at = datetime.utcnow()
    db.commit()

    if first_start:
        from app.services.push import notify_patient
        await notify_patient(consult.patient_id, "consult", url="/consultation/waiting", tag=f"consult-{consult.id}")

    return {"room_url": join_url, "status": consult.status}


@router.get("/room")
async def get_room(consultation_id: str, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Patient polls this to learn whether the doctor has started the call yet."""
    consult = can_consultation(db, user, consultation_id)

    name = _room_name(consultation_id)
    async with httpx.AsyncClient(timeout=15) as http:
        got = await http.get(f"{DAILY_API_URL}/rooms/{name}", headers=_auth_headers())
        if got.status_code == 404:
            return {"ready": False, "status": consult.status}
        if got.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not load video room.")
        join_url = await _join_url(http, got.json()["url"], name, owner=user.is_doctor)

    return {"ready": True, "room_url": join_url, "status": consult.status}


async def _join_url(http, room_url: str, room_name: str, owner: bool) -> str:
    """Room link plus a short-lived meeting token for this one person."""
    res = await http.post(f"{DAILY_API_URL}/meeting-tokens", headers=_auth_headers(), json={
        "properties": {"room_name": room_name, "is_owner": owner, "exp": int(time.time()) + 2 * 60 * 60},
    })
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not prepare the video call. Try again.")
    return f"{room_url}?t={res.json()['token']}"
