
import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = "Create the initial HR administrator"

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "")
        first_name = os.environ.get("ADMIN_FIRST_NAME", "").strip()
        last_name = os.environ.get("ADMIN_LAST_NAME", "").strip()

        if not all([email, password, first_name, last_name]):
            raise CommandError(
                "ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME "
                "and ADMIN_LAST_NAME are required."
            )

        if User.objects.filter(email=email).exists():
            raise CommandError(
                f"A user with email {email} already exists. No changes made."
            )

        user = User.objects.create_superuser(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Administrator {user.email} created successfully."
            )
        )
