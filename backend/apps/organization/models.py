from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.validators import code_validator


class Department(models.Model):
    """Company department. `parent` allows sub-departments / services.

    The `manager` field (an employee) is added with the employees module.
    """

    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    name = models.CharField("nom", max_length=150)
    description = models.TextField("description", blank=True)
    parent = models.ForeignKey(
        "self",
        verbose_name="département parent",
        null=True,
        blank=True,
        on_delete=models.PROTECT,  # historical data must never lose its department
        related_name="children",
    )
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "département"
        verbose_name_plural = "départements"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(parent=models.F("id")),
                name="department_parent_not_self",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)


class Position(models.Model):
    """Job position, optionally attached to a department."""

    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    title = models.CharField("intitulé", max_length=150)
    description = models.TextField("description", blank=True)
    level = models.PositiveSmallIntegerField(
        "niveau hiérarchique",
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="1 = direction, 10 = niveau le plus opérationnel.",
    )
    department = models.ForeignKey(
        Department,
        verbose_name="département",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="positions",
    )
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "poste"
        verbose_name_plural = "postes"

    def __str__(self):
        return f"{self.code} - {self.title}"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)