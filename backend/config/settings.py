from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()  # loads backend/.env

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-&ypjw4py_r5jbzt_rb&rylz-pn19@+!f(zj*gi&n8a&i##whp*"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ["*"]  # add your deployed domain/IP later

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",

    # Local apps
    "users",
    "courses",
    "training",
]

MIDDLEWARE = [
    # CORS must be near the top
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Password validation (not used for login, but keep defaults)
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "static/"

# ✅ Tell Django to look in BASE_DIR/static (your backend/static folder)
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ✅ React dev server allowed
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]



# ✅ Use your custom user model
AUTH_USER_MODEL = "users.CustomUser"

# -----------------------------
# ✅ Entra (Azure AD) + Graph config
# -----------------------------
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID_BACKEND")
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID_BACKEND")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")

AZURE_AUTHORITY = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"
AZURE_GRAPH_SCOPE = os.getenv("AZURE_GRAPH_SCOPE", "https://graph.microsoft.com/.default")
LMS_TRAINERS_GROUP_ID = os.getenv("LMS_TRAINERS_GROUP_ID", "")

# ✅ NEW: Frontend client id (audience for id_token)
AZURE_FRONTEND_CLIENT_ID = os.getenv("AZURE_FRONTEND_CLIENT_ID", "")

# ✅ IMPORTANT (Option B):
# Your frontend requests this scope:
# api://<client_id>/access_as_user
# The resulting token audience is typically api://<client_id>
AZURE_API_AUDIENCE = os.getenv("AZURE_API_AUDIENCE", f"api://{AZURE_CLIENT_ID}")

# ✅ DRF auth: your app-issued JWT only (SimpleJWT)
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

# ✅ SharePoint embed URL allowlist (for creator video validation)
ALLOWED_EMBED_DOMAINS = [
    "aspectmaint.sharepoint.com",
]

# -----------------------------
# ✅ SharePoint storage config (for uploads)
# -----------------------------
# Your storage site host name (tenant)
SHAREPOINT_TENANT_HOST = os.getenv("SHAREPOINT_TENANT_HOST", "aspectmaint.sharepoint.com")

# Site name/path for the storage site (AspectVideosSorted)
SHAREPOINT_STORAGE_SITE_PATH = os.getenv("SHAREPOINT_STORAGE_SITE_PATH", "AspectVideosSorted")

# Default doc library drive name (usually "Documents" or "Shared Documents")
SHAREPOINT_STORAGE_DRIVE_NAME = os.getenv("SHAREPOINT_STORAGE_DRIVE_NAME", "Documents")

# Root folders inside the library
SHAREPOINT_OFFICE_ROOT_FOLDER = os.getenv("SHAREPOINT_OFFICE_ROOT_FOLDER", "office")
SHAREPOINT_FIELD_ROOT_FOLDER = os.getenv("SHAREPOINT_FIELD_ROOT_FOLDER", "Common_or_Field")

# Signed streaming link TTL seconds
VIDEO_STREAM_SIGNED_URL_TTL_SECONDS = int(os.getenv("VIDEO_STREAM_SIGNED_URL_TTL_SECONDS", "900"))  # 15 min

# Upload chunk size (bytes) for Graph upload sessions
GRAPH_UPLOAD_CHUNK_SIZE = int(os.getenv("GRAPH_UPLOAD_CHUNK_SIZE", str(10 * 1024 * 1024)))  # 10MB
