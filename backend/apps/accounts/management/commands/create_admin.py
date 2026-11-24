import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Create the initial HR administrator (idempotent)"

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "")
        first_name = os.environ.get("ADMIN_FIRST_NAME", "").strip()
        last_name = os.environ.get("ADMIN_LAST_NAME", "").strip()

        if not all([email, password, first_name, last_name]):
            self.stdout.write("ADMIN_* variables missing: admin creation skipped.")
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(f"Admin {email} already exists: nothing to do.")
            return

        user = User.objects.create_superuser(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        self.stdout.write(
            self.style.SUCCESS(f"Administrator {user.email} created successfully.")
        )