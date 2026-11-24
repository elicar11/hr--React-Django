from pathlib import Path
from datetime import timedelta

from decouple import config, Csv
import dj_database_url


# ============================================================
# BASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent


# ============================================================
# SECURITY
# ============================================================

SECRET_KEY = config("DJANGO_SECRET_KEY")

DEBUG = config(
    "DJANGO_DEBUG",
    default=False,
    cast=bool,
)

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)


# Nombre de reverse proxies devant Django.
# 0 en local et généralement 1 derrière Render.
TRUSTED_PROXY_COUNT = config(
    "TRUSTED_PROXY_COUNT",
    default=0,
    cast=int,
)


# ============================================================
# APPLICATION-SPECIFIC SETTINGS
# ============================================================

CONTRACT_ALERT_DAYS = config(
    "CONTRACT_ALERT_DAYS",
    default=30,
    cast=int,
)

# Nombre de jours pendant lesquels un employé peut demander
# une correction de présence.
ATTENDANCE_CORRECTION_WINDOW_DAYS = config(
    "ATTENDANCE_CORRECTION_WINDOW_DAYS",
    default=30,
    cast=int,
)


# ============================================================
# APPLICATION DEFINITION
# ============================================================

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "django_filters",
    "corsheaders",
    "drf_spectacular",

    # Local apps
    "apps.accounts",
    "apps.core",
    "apps.organization",
    "apps.employees",
    "apps.contracts",
    "apps.attendance",
    "apps.leaves",
    "apps.payroll",
    "apps.dashboard",
]


# ============================================================
# MIDDLEWARE
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",

    # Static files in production
    "whitenoise.middleware.WhiteNoiseMiddleware",

    # CORS
    "corsheaders.middleware.CorsMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",

    # CSRF
    "django.middleware.csrf.CsrfViewMiddleware",

    # Authentication
    "django.contrib.auth.middleware.AuthenticationMiddleware",

    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================
# URL / WSGI
# ============================================================

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"


# ============================================================
# TEMPLATES
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ============================================================
# DATABASE
# ============================================================

# Compatible avec :
# - PostgreSQL local
# - Neon PostgreSQL
# - Render
#
# Local :
# DATABASE_URL=postgresql://user:password@localhost:5432/hr
#
# Production :
# DATABASE_URL=postgresql://...neon.tech/...

DATABASES = {
    "default": dj_database_url.config(
        default=config("DATABASE_URL", default=""),
        conn_max_age=600,
        ssl_require=not DEBUG,
    )
}


# ============================================================
# CUSTOM USER MODEL
# ============================================================

AUTH_USER_MODEL = "accounts.User"


# ============================================================
# PASSWORD VALIDATION
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME":
        "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME":
        "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME":
        "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME":
        "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ============================================================
# INTERNATIONALIZATION
# ============================================================

LANGUAGE_CODE = "fr-fr"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# ============================================================
# STATIC FILES
# ============================================================

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"


# WhiteNoise / Django 5+
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


# ============================================================
# MEDIA FILES
# ============================================================

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"


# ============================================================
# DEFAULT PRIMARY KEY
# ============================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================

REST_FRAMEWORK = {
    # Authentication
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],

    # Permissions
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],

    # Filtering
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],

    # Pagination
    "DEFAULT_PAGINATION_CLASS":
        "rest_framework.pagination.PageNumberPagination",

    "PAGE_SIZE": 20,

    # Swagger / OpenAPI
    "DEFAULT_SCHEMA_CLASS":
        "drf_spectacular.openapi.AutoSchema",

    # Throttling
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "refresh": "10/min",
        "password_reset": "3/hour",
        "password_reset_confirm": "5/hour",
    },
}


# ============================================================
# SIMPLE JWT
# ============================================================

SIMPLE_JWT = {
    # Access token
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),

    # Refresh token
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),

    # Rotation
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,

    # Update last login
    "UPDATE_LAST_LOGIN": True,

    # Authorization header
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# ============================================================
# REFRESH TOKEN COOKIE
# ============================================================

# Le refresh token est stocké dans un cookie HttpOnly.
# Il n'est donc pas accessible directement par JavaScript.

AUTH_REFRESH_COOKIE_NAME = "hr_refresh"

# HTTPS obligatoire en production.
AUTH_COOKIE_SECURE = not DEBUG

# Configuration adaptée à notre architecture.
AUTH_COOKIE_SAMESITE = "Lax"


# ============================================================
# PASSWORD RESET
# ============================================================

# Expiration du lien de réinitialisation :
# 3600 secondes = 1 heure.
PASSWORD_RESET_TIMEOUT = 3600


# ============================================================
# CORS
# ============================================================

# Local :
# CORS_ALLOWED_ORIGINS=http://localhost:5173
#
# Production :
# CORS_ALLOWED_ORIGINS=https://ton-frontend.vercel.app

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="",
    cast=Csv(),
)

# Nécessaire pour les cookies JWT.
CORS_ALLOW_CREDENTIALS = True


# ============================================================
# CSRF
# ============================================================

# Local :
# CSRF_TRUSTED_ORIGINS=http://localhost:5173
#
# Production :
# CSRF_TRUSTED_ORIGINS=https://ton-frontend.vercel.app

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="",
    cast=Csv(),
)


# ============================================================
# FRONTEND URL
# ============================================================

# Utilisé notamment pour construire les liens de reset password.

FRONTEND_URL = config(
    "FRONTEND_URL",
    default="http://localhost:5173",
)


# ============================================================
# EMAIL
# ============================================================

# En développement, les emails sont affichés dans le terminal.

EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

EMAIL_HOST = config(
    "EMAIL_HOST",
    default="localhost",
)

EMAIL_PORT = config(
    "EMAIL_PORT",
    default=587,
    cast=int,
)

EMAIL_HOST_USER = config(
    "EMAIL_HOST_USER",
    default="",
)

EMAIL_HOST_PASSWORD = config(
    "EMAIL_HOST_PASSWORD",
    default="",
)

EMAIL_USE_TLS = config(
    "EMAIL_USE_TLS",
    default=True,
    cast=bool,
)

DEFAULT_FROM_EMAIL = config(
    "DEFAULT_FROM_EMAIL",
    default="RH <no-reply@hr.local>",
)


# ============================================================
# API DOCUMENTATION - DRF SPECTACULAR
# ============================================================

SPECTACULAR_SETTINGS = {
    "TITLE": "HR API",
    "DESCRIPTION": "API Ressources Humaines Management",
    "VERSION": "1.0.0",
}


# ============================================================
# LOGGING
# ============================================================

LOG_LEVEL = config(
    "LOG_LEVEL",
    default="INFO",
)

LOG_DIR = BASE_DIR / "logs"

LOG_DIR.mkdir(
    exist_ok=True,
)


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,

    "filters": {
        "redact": {
            "()": "apps.core.log_filters.SensitiveDataFilter",
        },
    },

    "formatters": {
        "standard": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },

    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "filters": ["redact"],
        },

        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOG_DIR / "hr.log"),
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "encoding": "utf-8",
            "formatter": "standard",
            "filters": ["redact"],
        },
    },

    "loggers": {
        "apps": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": False,
        },

        "django": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}


# ============================================================
# PRODUCTION SECURITY
# ============================================================

if not DEBUG:
    # HTTPS
    SECURE_SSL_REDIRECT = config(
        "SECURE_SSL_REDIRECT",
        default=True,
        cast=bool,
    )

    # Cookies
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # Browser security
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

    # HSTS
    SECURE_HSTS_SECONDS = config(
        "SECURE_HSTS_SECONDS",
        default=31536000,
        cast=int,
    )

    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False

    # Referrer policy
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
