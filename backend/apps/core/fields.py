from rest_framework import serializers

from .validators import code_validator


class CodeField(serializers.CharField):
    """Business code (e.g. 'RH', 'DEV-01'): trimmed and uppercased before validation."""

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 20)
        kwargs.setdefault("validators", [code_validator])
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return super().to_internal_value(data).upper()