import re

from django.core.exceptions import ValidationError

CIN_PATTERN = re.compile(r"[0-9]{12}")
# Digits 4 to 6 of a CIN: 011 = man, 012 = woman.
CIN_SEX_MARKERS = {"011": "M", "012": "F"}


def normalize_cin(value):
    """'101 011 123456' -> '101011123456'. Empty -> None, so that "no CIN" is stored as NULL."""
    cleaned = re.sub(r"[\s.\-]", "", value or "")
    return cleaned or None


def cin_format_error(value):
    """Message describing why a normalized CIN is invalid, or None when it is valid."""
    if not CIN_PATTERN.fullmatch(value):
        return "Le numéro CIN doit comporter exactement 12 chiffres."
    if value[3:6] not in CIN_SEX_MARKERS:
        return "Les 4e, 5e et 6e chiffres du CIN doivent être 011 (homme) ou 012 (femme)."
    return None


def cin_sex(value):
    """'M' or 'F' according to digits 4 to 6 of the CIN, None if they are not a known marker."""
    return CIN_SEX_MARKERS.get(value[3:6])


def validate_cin_number(value):
    """Model-level validator (the API normalizes the value first)."""
    message = cin_format_error(value)
    if message:
        raise ValidationError(message)