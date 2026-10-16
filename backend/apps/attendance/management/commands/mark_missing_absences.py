from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.attendance import services


class Command(BaseCommand):
    help = (
        "Mark as unjustified absence the working days without any attendance record. "
        "Schedule it once a day, after the end of the day (default: yesterday)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Day to process, format YYYY-MM-DD (default: yesterday).")

    def handle(self, *args, **options):
        if options["date"]:
            try:
                day = date.fromisoformat(options["date"])
            except ValueError:
                raise CommandError("Format attendu : AAAA-MM-JJ.")
        else:
            day = timezone.localdate() - timedelta(days=1)
        try:
            count = services.mark_missing_absences(day=day)
        except ValidationError as exc:
            raise CommandError(str(exc.detail))
        self.stdout.write(self.style.SUCCESS(f"{day} : {count} absence(s) injustifiée(s) créée(s)."))