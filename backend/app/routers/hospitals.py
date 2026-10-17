import asyncio
import math
import time
import httpx
from fastapi import APIRouter, HTTPException

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


async def _query_overpass(query: str) -> list:
    """Return OSM elements from the first Overpass server that answers."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(10, connect=4)) as client:
        for url in OVERPASS_URLS:
            try:
                res = await client.post(url, data={"data": query}, headers=OVERPASS_HEADERS)
                res.raise_for_status()
                elements = res.json().get("elements", [])
                print(f"Overpass OK via {url}: {len(elements)} elements")
                return elements
            except Exception as e:
                print(f"Overpass error via {url}: {type(e).__name__}: {e}")
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
    async with httpx.AsyncClient(timeout=httpx.Timeout(10, connect=4)) as client:
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
# Always injected at the top of the list for testing purposes.
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

    # Overpass query — finds hospital nodes and ways within radius
    query = f"""
    [out:json][timeout:12];
    (
      node["amenity"="hospital"](around:{radius_m},{lat},{lon});
      node["amenity"="clinic"](around:{radius_m},{lat},{lon});
      node["healthcare"="hospital"](around:{radius_m},{lat},{lon});
      way["amenity"="hospital"](around:{radius_m},{lat},{lon});
      way["amenity"="clinic"](around:{radius_m},{lat},{lon});
    );
    out center;
    """

    cache_key = (round(lat, 2), round(lon, 2), radius_km)
    cached = _CACHE.get(cache_key)
    if cached and time.time() - cached[0] < _CACHE_SECONDS:
        elements = cached[1]
    else:
        elements = await _query_overpass(query)
        if not elements:
            elements = await _query_nominatim(lat, lon, radius_km)
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

    # ── Inject KNH at the top with real calculated distance ──
    knh = KNH_OVERRIDE.copy()
    knh["distance_km"] = round(haversine_km(lat, lon, knh["lat"], knh["lon"]), 1)
    knh["travel_time"] = estimate_travel_time(knh["distance_km"])

    # Avoid duplicates if KNH is already in OSM results
    hospitals = [h for h in hospitals if "kenyatta national" not in h["name"].lower()]

    # Return KNH first, then up to 14 others
    return [knh] + hospitals[:14]


@router.get("/registered")
async def get_registered_hospitals(db=None):
    """
    Returns hospitals registered in the CivTech database.
    Used by doctors during registration to select their hospital from a real list.
    """
    from app.database import SessionLocal
    from app.models.hospital import Hospital

    db = SessionLocal()
    try:
        hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
        return [{"id": h.id, "name": h.name} for h in hospitals]
    finally:
        db.close()
