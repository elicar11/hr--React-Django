from django.core.management.base import BaseCommand

from apps.contracts import services


class Command(BaseCommand):
    help = "Mark ACTIVE contracts whose end date has passed as ENDED. Schedule it once a day."

    def handle(self, *args, **options):
        count = services.close_expired_contracts()
        self.stdout.write(self.style.SUCCESS(f"{count} contrat(s) clôturé(s)."))