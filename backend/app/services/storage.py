"""
Private file storage for patient uploads (Supabase Storage).

The bucket is private: files are only reachable through short-lived signed
links that the API hands to the patient or to a doctor caring for them.
Uses the service role key, which never leaves the server.
"""
import httpx

from app.config import settings

BUCKET = "medical-records"
MAX_BYTES = 10 * 1024 * 1024
_ready = {"bucket": False}


def _base() -> str:
    return settings.SUPABASE_URL.rstrip("/") + "/storage/v1"


def _headers(extra: dict | None = None) -> dict:
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    return {"Authorization": f"Bearer {key}", "apikey": key, **(extra or {})}


async def _ensure_bucket(client: httpx.AsyncClient) -> None:
    if _ready["bucket"]:
        return
    res = await client.get(f"{_base()}/bucket/{BUCKET}", headers=_headers())
    if res.status_code != 200:
        res = await client.post(f"{_base()}/bucket", headers=_headers(), json={
            "id": BUCKET, "name": BUCKET, "public": False, "file_size_limit": MAX_BYTES,
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        })
        if res.status_code not in (200, 201) and "already exists" not in res.text.lower():
            raise RuntimeError(f"Could not create storage bucket ({res.status_code})")
    _ready["bucket"] = True


async def upload(path: str, content: bytes, mime: str) -> None:
    async with httpx.AsyncClient(timeout=60) as client:
        await _ensure_bucket(client)
        res = await client.post(f"{_base()}/object/{BUCKET}/{path}", content=content,
                                headers=_headers({"Content-Type": mime, "x-upsert": "false"}))
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Upload failed ({res.status_code})")


async def signed_url(path: str, seconds: int = 300) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(f"{_base()}/object/sign/{BUCKET}/{path}", headers=_headers(),
                                json={"expiresIn": seconds})
        res.raise_for_status()
        signed = res.json().get("signedURL") or res.json().get("signedUrl")
        if not signed:
            raise RuntimeError("No signed link returned")
        return _base() + signed if signed.startswith("/") else signed


async def delete(paths: list[str]) -> None:
    if not paths:
        return
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.request("DELETE", f"{_base()}/object/{BUCKET}", headers=_headers(),
                                   json={"prefixes": paths})
        if res.status_code not in (200, 204):
            raise RuntimeError(f"Delete failed ({res.status_code})")
