import re
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from apps.payroll.models import PayItemCalculation, PayItemCategory, PayItemType, PayrollSettings

DEMO = "[DÉMO FICTIF] "

# Structural types: the engine needs them. They carry no rate and are not fictitious.
SYSTEM_TYPES = [
    ("BASE", "Salaire de base", PayItemCategory.BASE_SALARY, PayItemCalculation.SYSTEM_BASE_SALARY),
    ("OVERTIME", "Heures supplémentaires", PayItemCategory.OVERTIME, PayItemCalculation.SYSTEM_OVERTIME),
    ("UNPAID", "Congé sans solde", PayItemCategory.ABSENCE, PayItemCalculation.SYSTEM_UNPAID_LEAVE),
]

# FICTITIOUS values, for demonstration only. They are not real rates of any country.
DEMO_TYPES = [
    dict(code="DEMO-CONTRIB", name=DEMO + "Cotisation A (5 % du brut)", category=PayItemCategory.CONTRIBUTION,
         calculation=PayItemCalculation.PERCENT_OF_GROSS, default_rate=Decimal("5"), applies_to_all=True),
    dict(code="DEMO-TAX", name=DEMO + "Prélèvement B (10 % du brut)", category=PayItemCategory.TAX,
         calculation=PayItemCalculation.PERCENT_OF_GROSS, default_rate=Decimal("10"), applies_to_all=True),
    dict(code="DEMO-TRANSPORT", name=DEMO + "Indemnité de transport", category=PayItemCategory.ALLOWANCE,
         calculation=PayItemCalculation.FIXED, default_amount=Decimal("50"), applies_to_all=False),
    dict(code="DEMO-BONUS", name=DEMO + "Prime ponctuelle", category=PayItemCategory.BONUS,
         calculation=PayItemCalculation.FIXED, applies_to_all=False),
    dict(code="DEMO-DEDUCT", name=DEMO + "Retenue ponctuelle", category=PayItemCategory.DEDUCTION,
         calculation=PayItemCalculation.FIXED, applies_to_all=False),
]


class Command(BaseCommand):
    help = "Load FICTITIOUS demo payroll parameters. Never use them for a real payroll."

    def add_arguments(self, parser):
        parser.add_argument(
            "--currency", required=True,
            help="ISO code (3 letters). Must match the currency of your contracts.",
        )

    def handle(self, *args, **options):
        currency = options["currency"].upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise CommandError("La devise doit être un code ISO à 3 lettres (ex. EUR).")

        settings = PayrollSettings.get_solo()
        if not settings.is_demo:
            raise CommandError("Les paramètres ne sont plus en mode démonstration : abandon pour ne rien écraser.")

        settings.currency = currency
        settings.monthly_hours = Decimal("160")  # fictitious
        settings.overtime_multiplier = Decimal("1.50")  # fictitious
        settings.prorate_partial_periods = True
        settings.is_demo = True
        settings.save()

        for code, name, category, calculation in SYSTEM_TYPES:
            if not PayItemType.objects.filter(calculation=calculation).exists():
                PayItemType.objects.create(code=code, name=name, category=category, calculation=calculation)
        for values in DEMO_TYPES:
            PayItemType.objects.update_or_create(code=values["code"], defaults=values)

        self.stdout.write(self.style.WARNING(
            "Paramètres de DÉMONSTRATION chargés (valeurs FICTIVES, non utilisables pour une paie réelle)."
        ))