"""Turning phone notifications on and off for the signed-in patient or doctor."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.push import PushSubscription
from app.services.authz import Principal, current_user
from app.services.push import vapid_keys, notify

router = APIRouter()
MAX_DEVICES = 5


class Keys(BaseModel):
    p256dh: str
    auth: str


class Subscription(BaseModel):
    endpoint: str
    keys: Keys


class Endpoint(BaseModel):
    endpoint: str


@router.get("/public-key")
async def public_key():
    return {"key": vapid_keys()[1]}


@router.post("/subscribe")
async def subscribe(data: Subscription, request: Request, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    if user.role not in ("patient", "doctor"):
        raise HTTPException(status_code=403, detail="Notifications are for patients and doctors.")
    if not data.endpoint.startswith("https://") or len(data.endpoint) > 1000:
        raise HTTPException(status_code=400, detail="That isn't a valid push address.")
    row = db.query(PushSubscription).filter(PushSubscription.endpoint == data.endpoint).first()
    if row:
        # The same phone, possibly now signed in as someone else: it follows the new sign-in.
        row.owner_id, row.owner_role = user.id, user.role
        row.p256dh, row.auth = data.keys.p256dh, data.keys.auth
    else:
        mine = db.query(PushSubscription).filter(PushSubscription.owner_id == user.id) \
            .order_by(PushSubscription.last_seen_at.asc()).all()
        for old in mine[: max(0, len(mine) - MAX_DEVICES + 1)]:
            db.delete(old)
        db.add(PushSubscription(owner_id=user.id, owner_role=user.role, endpoint=data.endpoint,
                                p256dh=data.keys.p256dh, auth=data.keys.auth,
                                user_agent=(request.headers.get("user-agent") or "")[:200]))
    db.commit()
    return {"message": "Notifications are on for this phone."}


@router.post("/unsubscribe")
async def unsubscribe(data: Endpoint, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    row = db.query(PushSubscription).filter(PushSubscription.endpoint == data.endpoint,
                                            PushSubscription.owner_id == user.id).first()
    if row:
        db.delete(row)
        db.commit()
    return {"message": "Notifications are off for this phone."}


@router.post("/test")
async def test(user: Principal = Depends(current_user)):
    if user.is_patient:
        from app.services.push import notify_patient
        n = await notify_patient(user.id, "test", "/dashboard", "civcare-test")
    else:
        n = await notify(user.id, "CivCare notifications are on",
                         "You'll get new-patient alerts here, even when CivCare is closed.", "/doctor/dashboard", "civcare-test")
    if not n:
        raise HTTPException(status_code=400, detail="This phone isn't set up for notifications yet.")
    return {"message": "Sent. It should appear in a few seconds.", "devices": n}
