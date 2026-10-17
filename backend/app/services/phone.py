"""Kenyan phone-number normalisation.

Patients type numbers as 0712 345 678, 0110..., 712345678, 254712... or
+254 712.... Store one canonical form (+2547XXXXXXXX / +2541XXXXXXXX) and
match every common variant on login, so older accounts saved in a different
format still sign in.
"""
import re
from typing import Optional


def normalize_ke_phone(raw: str) -> Optional[str]:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("254"):
        local = digits[3:]
    elif len(digits) == 10 and digits.startswith("0"):
        local = digits[1:]
    elif len(digits) == 9:
        local = digits
    else:
        return None
    if not re.fullmatch(r"[17]\d{8}", local):
        return None
    return f"+254{local}"


def phone_variants(raw: str) -> list:
    """All stored formats this number might exist under (for lookups)."""
    canonical = normalize_ke_phone(raw)
    if not canonical:
        return [raw.strip()] if raw else []
    local = canonical[4:]
    return list({canonical, f"254{local}", f"0{local}", local, (raw or "").strip()})
