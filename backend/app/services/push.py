"""
Web Push: notifications that reach the phone while CivCare is closed.

Same approach as Fedha. The browser subscribes with the push service of
its maker (free, no account), the subscription is stored here, and the
server signs each message with a VAPID key.

The VAPID key pair comes from VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY if set
on Railway; otherwise it is generated once and kept in `app_secrets`, so
push works without any setup. Changing the key unsubscribes every phone.

Lock screens are visible to anyone holding the phone, so messages never
name a medicine or a diagnosis (Data Protection Act 2019, s. 41).
"""
import asyncio
import base64
import json
import os
from datetime import datetime

from app.database import SessionLocal

_keys: dict = {}


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def vapid_keys() -> tuple[str, str]:
    """(private key in PEM, public key as base64url) — loaded or created once."""
    if _keys:
        return _keys["private"], _keys["public"]
    priv, pub = os.environ.get("VAPID_PRIVATE_KEY"), os.environ.get("VAPID_PUBLIC_KEY")
    if not (priv and pub):
        from app.models.push import AppSecret
        db = SessionLocal()
        try:
            row_priv = db.query(AppSecret).filter(AppSecret.key == "vapid_private").first()
            row_pub = db.query(AppSecret).filter(AppSecret.key == "vapid_public").first()
            if not (row_priv and row_pub):
                from cryptography.hazmat.primitives import serialization
                from cryptography.hazmat.primitives.asymmetric import ec
                key = ec.generate_private_key(ec.SECP256R1())
                priv = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption()).decode()
                pub = _b64url(key.public_key().public_bytes(serialization.Encoding.X962,
                                                            serialization.PublicFormat.UncompressedPoint))
                db.merge(AppSecret(key="vapid_private", value=priv))
                db.merge(AppSecret(key="vapid_public", value=pub))
                db.commit()
                print("Push: created a new signing key")
            else:
                priv, pub = row_priv.value, row_pub.value
        finally:
            db.close()
    _keys.update(private=priv, public=pub)
    return priv, pub


def _send_one(sub, payload: str) -> str:
    """Returns 'ok', 'gone' (subscription expired) or 'error'."""
    from pywebpush import webpush, WebPushException
    from py_vapid import Vapid
    priv, _ = vapid_keys()
    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=payload,
            vapid_private_key=Vapid.from_pem(priv.encode()),
            vapid_claims={"sub": os.environ.get("VAPID_SUBJECT", "mailto:privacy@civcare.app")},
            ttl=4 * 3600,          # if the phone is off, deliver within 4 hours or drop it
            timeout=10,
        )
        return "ok"
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        if code in (404, 410):
            return "gone"
        print(f"Push failed ({code}): {str(e)[:120]}")
        return "error"
    except Exception as e:
        print(f"Push failed: {type(e).__name__}: {str(e)[:120]}")
        return "error"


async def notify(owner_id: str, title: str, body: str, url: str = "/dashboard", tag: str | None = None,
                 actions: list | None = None) -> int:
    """Send to every device the person subscribed. Returns how many got it."""
    from app.models.push import PushSubscription
    db = SessionLocal()
    try:
        subs = db.query(PushSubscription).filter(PushSubscription.owner_id == owner_id).all()
        if not subs:
            return 0
        payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag, "actions": actions or []})
        results = await asyncio.gather(*(asyncio.to_thread(_send_one, s, payload) for s in subs))
        delivered = 0
        for s, r in zip(subs, results):
            if r == "gone":
                db.delete(s)
            elif r == "ok":
                delivered += 1
                s.last_seen_at = datetime.utcnow()
        db.commit()
        return delivered
    finally:
        db.close()
