class Echo:
    """File-like object returning what is written, for streaming CSV."""

    def write(self, value):
        return value


def csv_safe(value):
    """Neutralize spreadsheet formulas (CSV injection) in text cells."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text