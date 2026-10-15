import logging
import re

# Masks values following keys such as password=..., "token": "...", Authorization: ...
_SENSITIVE = re.compile(
    r"""(?ix)
    (password|passwd|token|secret|authorization|api[_-]?key)
    (["']?\s*[:=]\s*)
    (["']?)
    [^\s,"'}]+
    """
)


class SensitiveDataFilter(logging.Filter):
    """Last line of defense: redact credentials that slip into log messages."""

    def filter(self, record):
        message = record.getMessage()
        record.msg = _SENSITIVE.sub(r"\1\2\3***", message)
        record.args = ()
        return True