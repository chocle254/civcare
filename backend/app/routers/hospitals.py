import asyncio
import math
import os
import re
import time
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

# Public Overpass servers are free but often overloaded or rate-limited, so
# we try several in turn instead of failing on the first slow one.
OVERPASS_URLS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
OVERPASS_HEADERS = {
    "Accept": "*/*",
    "User-Agent": "CivTechCare/1.0 (healthcare app; contact@civtech.care)",
}

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Results for the same ~1 km area are reused for a while, which spares the
# public servers and makes repeat visits instant.
_CACHE: dict = {}
_CACHE_SECONDS = 15 * 60


async def _query_overpass(query: str, budget: float = 8.0) -> list:
    """
    Ask every Overpass server at once and use the first one that answers.
    Trying them one after another took up to 40 seconds when they were busy;
    now the patient waits at most `budget` seconds before the fallback.
    """
    async def one(client, url):
        res = await client.post(url, data={"data": query}, headers=OVERPASS_HEADERS)
        res.raise_for_status()
        elements = res.json().get("elements", [])
        if not elements:
            raise ValueError("empty")
        print(f"Overpass OK via {url}: {len(elements)} elements")
        return elements

    async with httpx.AsyncClient(timeout=httpx.Timeout(budget, connect=4)) as client:
        tasks = [asyncio.create_task(one(client, u)) for u in OVERPASS_URLS]
        try:
            for done in asyncio.as_completed(tasks, timeout=budget):
                try:
                    return await done
                except asyncio.TimeoutError:
                    raise
                except Exception as e:
                    print(f"Overpass error: {type(e).__name__}: {e}")
        except asyncio.TimeoutError:
            print(f"Overpass: no server answered within {budget}s")
        finally:
            for t in tasks:
                t.cancel()
    return []


async def _query_nominatim(lat: float, lon: float, radius_km: int) -> list:
    """
    Fallback when every Overpass server is busy. Nominatim lists fewer
    facilities but is far more available. Results are reshaped to look like
    Overpass elements so the rest of the endpoint is unchanged.
    Usage policy: max 1 request/second, so the two lookups are spaced out.
    """
    d_lat = radius_km / 111.0
    d_lon = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.1))
    viewbox = f"{lon - d_lon},{lat + d_lat},{lon + d_lon},{lat - d_lat}"
    elements = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(6, connect=4)) as client:
        for i, amenity in enumerate(("hospital", "clinic")):
            if i:
                await asyncio.sleep(1.1)
            try:
                res = await client.get(NOMINATIM_URL, headers=OVERPASS_HEADERS, params={
                    "amenity": amenity, "format": "jsonv2", "limit": 40,
                    "bounded": 1, "viewbox": viewbox, "addressdetails": 1,
                })
                res.raise_for_status()
                for r in res.json():
                    addr = r.get("address") or {}
                    elements.append({
                        "type": "node",
                        "id": r.get("osm_id"),
                        "lat": float(r["lat"]),
                        "lon": float(r["lon"]),
                        "tags": {
                            "name": r.get("name") or "",
                            "addr:city": addr.get("city") or addr.get("town") or addr.get("village") or "",
                            "addr:county": addr.get("county") or addr.get("state") or "",
                            "addr:street": addr.get("road") or "",
                        },
                    })
            except Exception as e:
                print(f"Nominatim error ({amenity}): {type(e).__name__}: {e}")
    print(f"Nominatim fallback: {len(elements)} facilities")
    return elements


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate straight-line distance between two GPS coordinates in km."""
    R = 6371  # Earth radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_travel_time(distance_km: float) -> str:
    """Rough driving time estimate for Kenyan roads."""
    minutes = (distance_km / 30) * 60  # Assume avg 30 km/h in urban/peri-urban Kenya
    if minutes < 5:
        return "< 5 min"
    elif minutes < 60:
        return f"{int(minutes)} min"
    else:
        hours = minutes / 60
        return f"{hours:.1f} hr"


# ── KNH TESTING OVERRIDE ──────────────────────────────────────────────────
# Injected at the top of the list for testing. Set KNH_TEST_ROUTING=0 on
# Railway before real patients use the app.
KNH_TEST_ROUTING = os.environ.get("KNH_TEST_ROUTING", "1") != "0"
KNH_OVERRIDE = {
    "id":           "knh-nairobi-testing",
    "name":         "Kenyatta National Hospital (KNH)",
    "town":         "Nairobi",
    "county":       "Nairobi County",
    "phone":        "+254 20 2726300",
    "address":      "Hospital Road, Upper Hill, Nairobi",
    "distance_km":  0.0,   # Will be recalculated dynamically
    "travel_time":  "varies",
    "lat":          -1.3019,
    "lon":          36.8068,
    "source":       "civtech_testing",
    "is_testing":   True,
}


@router.get("/nearby")
async def get_nearby_hospitals(lat: float, lon: float, radius_km: int = 30):
    """
    Queries OpenStreetMap Overpass API for hospitals near the patient.
    Returns a sorted list by distance with name, distance, and travel time.
    No API key needed — completely free.
    """
    radius_m = radius_km * 1000
    # OpenStreetMap only needs the rough area, so the exact position never
    # leaves CivCare: round to ~1 km before querying. Distances below are
    # still worked out from the exact position, on our server.
    q_lat, q_lon = round(lat, 2), round(lon, 2)

    # Overpass query — finds hospital nodes and ways within radius
    query = f"""
    [out:json][timeout:12];
    (
      node["amenity"="hospital"](around:{radius_m},{q_lat},{q_lon});
      node["amenity"="clinic"](around:{radius_m},{q_lat},{q_lon});
      node["healthcare"="hospital"](around:{radius_m},{q_lat},{q_lon});
      way["amenity"="hospital"](around:{radius_m},{q_lat},{q_lon});
      way["amenity"="clinic"](around:{radius_m},{q_lat},{q_lon});
    );
    out center;
    """

    cache_key = (q_lat, q_lon, radius_km)
    cached = _CACHE.get(cache_key)
    if cached and time.time() - cached[0] < _CACHE_SECONDS:
        elements = cached[1]
    else:
        # The fuller Overpass list is preferred; the Nominatim backup runs at
        # the same time so a busy Overpass costs no extra wait.
        # Hard cap: the patient never waits more than ~8 s for the list.
        op = asyncio.create_task(_query_overpass(query, budget=6.0))
        nm = asyncio.create_task(_query_nominatim(q_lat, q_lon, radius_km))
        ok = lambda t: t.done() and not t.cancelled() and not t.exception() and t.result()
        started = time.time()
        await asyncio.wait({op}, timeout=6.5)
        elements = op.result() if ok(op) else []
        if not elements:
            await asyncio.wait({nm}, timeout=max(8.0 - (time.time() - started), 0.1))
            elements = nm.result() if ok(nm) else []
        for t in (op, nm):
            t.cancel()
        if not elements:
            print("Hospital search: no map server answered within 8 s")
        if elements:
            _CACHE[cache_key] = (time.time(), elements)
    data = {"elements": elements}

    hospitals = []
    seen_names = set()

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("name:en")

        # Skip unnamed or duplicate hospitals
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        # Get coordinates — nodes have lat/lon directly, ways use center
        if element["type"] == "node":
            h_lat = element["lat"]
            h_lon = element["lon"]
        else:
            center = element.get("center", {})
            h_lat = center.get("lat")
            h_lon = center.get("lon")
            if not h_lat or not h_lon:
                continue

        distance_km = haversine_km(lat, lon, h_lat, h_lon)

        hospitals.append({
            "id":           str(element["id"]),
            "name":         name,
            "town":         tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:suburb") or "Nearby",
            "county":       tags.get("addr:county") or tags.get("addr:state") or "",
            "phone":        tags.get("phone") or tags.get("contact:phone") or "",
            "address":      tags.get("addr:street") or "",
            "distance_km":  round(distance_km, 1),
            "travel_time":  estimate_travel_time(distance_km),
            "lat":          h_lat,
            "lon":          h_lon,
            "source":       "openstreetmap",
        })

    # Sort by nearest first
    hospitals.sort(key=lambda h: h["distance_km"])

    # ── Hospitals on CivCare come first: they have doctors who can receive the patient ──
    joined = []
    for h in _approved_hospitals():
        if h.latitude is None or h.longitude is None:
            continue
        d = haversine_km(lat, lon, h.latitude, h.longitude)
        if d > radius_km:
            continue
        joined.append({
            "id": h.id, "name": h.name, "town": h.town, "county": h.county,
            "phone": h.phone_number or "", "address": h.address or "",
            "distance_km": round(d, 1), "travel_time": estimate_travel_time(d),
            "lat": h.latitude, "lon": h.longitude, "source": "civcare", "on_civcare": True,
        })
    joined.sort(key=lambda h: h["distance_km"])
    taken = {h["name"].strip().lower() for h in joined}
    hospitals = [h for h in hospitals if h["name"].strip().lower() not in taken]

    if not KNH_TEST_ROUTING:
        return (joined + hospitals)[:15]

    # ── Inject KNH at the top with real calculated distance ──
    knh = KNH_OVERRIDE.copy()
    knh["distance_km"] = round(haversine_km(lat, lon, knh["lat"], knh["lon"]), 1)
    knh["travel_time"] = estimate_travel_time(knh["distance_km"])

    # Avoid duplicates if KNH is already in OSM results
    hospitals = [h for h in hospitals if "kenyatta national" not in h["name"].lower()]

    joined = [h for h in joined if "kenyatta national" not in h["name"].lower()]
    # Return KNH first, then hospitals on CivCare, then others: 15 in all
    return ([knh] + joined + hospitals)[:15]


@router.get("/registered")
async def get_registered_hospitals(db=None):
    """
    Returns hospitals registered in the CivTech database.
    Used by doctors during registration to select their hospital from a real list.
    """
    from app.database import SessionLocal
    from app.models.hospital import Hospital

    return [{"id": h.id, "name": h.name, "town": h.town} for h in _approved_hospitals()]


def _approved_hospitals() -> list:
    """Active hospitals the CivCare team has approved (older rows count as approved)."""
    from app.database import SessionLocal
    from app.models.hospital import Hospital
    from sqlalchemy import or_

    db = SessionLocal()
    try:
        return db.query(Hospital).filter(
            Hospital.is_active == True,  # noqa: E712
            or_(Hospital.status == "approved", Hospital.status.is_(None)),
        ).order_by(Hospital.name).all()
    finally:
        db.close()


# ── HOSPITAL APPLICATIONS ──
# A hospital asks to join; the CivCare team reviews it in the admin
# dashboard. Until approved it isn't listed to patients or doctors.

class HospitalApply(BaseModel):
    name:          str
    facility_code: str                 # KMHFL code (Kenya Master Health Facility List)
    county:        str
    town:          str
    address:       str | None = None
    ownership:     str | None = None   # public / private / faith-based / NGO
    level:         str | None = None   # KEPH level
    phone_number:  str | None = None
    email:         str | None = None
    latitude:      float | None = None
    longitude:     float | None = None
    contact_name:  str
    contact_role:  str
    contact_phone: str
    contact_email: str | None = None
    agree:         bool = False        # agreed to CivCare's hospital terms and data processing


_applies: dict[str, list[float]] = {}


def _too_many(ip: str) -> bool:
    """At most 5 applications per address per hour; the form is public."""
    now = time.time()
    _applies[ip] = [t for t in _applies.get(ip, []) if now - t < 3600]
    return len(_applies[ip]) >= 5


@router.post("/apply")
async def apply_hospital(data: HospitalApply, request: Request):
    from app.database import SessionLocal
    from app.models.hospital import Hospital
    from app.services.phone import normalize_ke_phone

    ip = request.client.host if request.client else "?"
    if _too_many(ip):
        raise HTTPException(status_code=429, detail="Too many applications from here. Try again in an hour.")
    if not data.agree:
        raise HTTPException(status_code=400, detail="Please agree to the terms to apply.")
    name = re.sub(r"\s+", " ", data.name).strip()
    code = re.sub(r"\s+", "", data.facility_code).upper()
    required = {"Hospital name": name, "Facility code": code, "County": data.county.strip(),
                "Town": data.town.strip(), "Your name": data.contact_name.strip(),
                "Your role": data.contact_role.strip(), "Your phone": data.contact_phone.strip()}
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise HTTPException(status_code=400, detail=f"Please fill in: {', '.join(missing)}.")
    if not re.fullmatch(r"[A-Z0-9-]{3,20}", code):
        raise HTTPException(status_code=400, detail="The facility code should be the KMHFL code, e.g. 13023.")
    for lat_lon in ((data.latitude, -5.0, 5.5), (data.longitude, 33.5, 42.5)):
        if lat_lon[0] is not None and not (lat_lon[1] <= lat_lon[0] <= lat_lon[2]):
            raise HTTPException(status_code=400, detail="The location is outside Kenya. Use the button again at the hospital.")
    contact_phone = normalize_ke_phone(data.contact_phone)
    if not contact_phone:
        raise HTTPException(status_code=400, detail="Enter a Kenyan phone number for yourself, e.g. 0712 345 678.")

    db = SessionLocal()
    try:
        if db.query(Hospital).filter(Hospital.facility_code == code).first():
            raise HTTPException(status_code=400, detail="A hospital with this facility code has already applied or joined. Contact the CivCare team if that's wrong.")
        h = Hospital(
            name=name, facility_code=code, county=data.county.strip(), town=data.town.strip(),
            address=(data.address or "").strip() or None, ownership=data.ownership, level=data.level,
            phone_number=(data.phone_number or "").strip() or None, email=(data.email or "").strip() or None,
            latitude=data.latitude, longitude=data.longitude,
            contact_name=data.contact_name.strip(), contact_role=data.contact_role.strip(),
            contact_phone=contact_phone, contact_email=(data.contact_email or "").strip() or None,
            status="pending", is_active=False, applied_at=datetime.utcnow(),
        )
        db.add(h)
        db.commit()
        _applies.setdefault(ip, []).append(time.time())
        return {"message": "Application received. The CivCare team will call you to confirm.", "reference": h.id[:8].upper()}
    finally:
        db.close()
