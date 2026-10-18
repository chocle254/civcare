"""
Password/PIN hashing and login throttling.

Secrets are hashed with salted PBKDF2-SHA256 (standard library, no new
dependency). Older accounts were stored as unsalted SHA-256; those still
verify, and are re-hashed the next time the person signs in.
"""
import hashlib
import hmac
import secrets
import time

_ITERATIONS = 200_000


def hash_secret(plain: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), _ITERATIONS).hex()
    return f"pbkdf2${_ITERATIONS}${salt}${digest}"


def verify_secret(plain: str, stored: str | None) -> bool:
    if not plain or not stored:
        return False
    if stored.startswith("pbkdf2$"):
        try:
            _, iters, salt, digest = stored.split("$", 3)
            check = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), int(iters)).hex()
        except ValueError:
            return False
        return hmac.compare_digest(check, digest)
    # Legacy unsalted SHA-256
    return hmac.compare_digest(hashlib.sha256(plain.encode()).hexdigest(), stored)


def needs_rehash(stored: str | None) -> bool:
    return not (stored or "").startswith("pbkdf2$")


# ── Login throttling ──
# Five wrong attempts on one account locks it for 15 minutes. In memory, so
# it resets on deploy; enough to stop guessing a 4-digit PIN.
_MAX_FAILS = 5
_WINDOW = 15 * 60
_fails: dict[str, list[float]] = {}


def _recent(key: str) -> list[float]:
    now = time.time()
    hits = [t for t in _fails.get(key, []) if now - t < _WINDOW]
    _fails[key] = hits
    return hits


def is_locked(key: str) -> bool:
    return len(_recent(key)) >= _MAX_FAILS


def record_failure(key: str) -> None:
    _recent(key).append(time.time())


def clear_failures(key: str) -> None:
    _fails.pop(key, None)


def mask(value: str | None, keep: int = 3) -> str:
    """'0712345678' -> '•••••••678'; for logs and screens that only need a hint."""
    v = str(value or "")
    return ("•" * max(len(v) - keep, 0)) + v[-keep:] if v else ""
