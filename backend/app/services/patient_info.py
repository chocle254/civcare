from datetime import date


def patient_age(patient) -> str:
    """Age in years from date of birth (YYYY-MM-DD), else the stored age, else 'Unknown'."""
    dob = getattr(patient, "date_of_birth", None)
    if dob:
        try:
            y, m, d = (int(x) for x in str(dob)[:10].split("-"))
            today = date.today()
            return str(today.year - y - ((today.month, today.day) < (m, d)))
        except ValueError:
            pass
    return getattr(patient, "age", None) or "Unknown"


def patient_sex(patient) -> str:
    return getattr(patient, "sex", None) or "Not recorded"
