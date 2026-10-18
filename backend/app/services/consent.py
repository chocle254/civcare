"""Privacy notice version. Bump it whenever the notice changes in a way
patients must agree to again (new data use, new processor, new country)."""
PRIVACY_VERSION = "2026-10-18"


def has_consent(patient) -> bool:
    return bool(patient and patient.consent_at and patient.consent_version == PRIVACY_VERSION)
