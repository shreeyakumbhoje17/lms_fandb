import time
import jwt
from jwt import PyJWKClient

from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


_jwks_client_cache = {"client": None, "expires_at": 0}


def _jwks_client():
    """
    Cache the JWKS client for a while to avoid fetching keys every request.
    """
    now = int(time.time())
    if _jwks_client_cache["client"] and now < _jwks_client_cache["expires_at"]:
        return _jwks_client_cache["client"]

    tenant_id = settings.AZURE_TENANT_ID
    jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"

    client = PyJWKClient(jwks_url)
    _jwks_client_cache["client"] = client
    _jwks_client_cache["expires_at"] = now + 6 * 3600  # 6 hours
    return client


def _expected_issuers():
    tid = settings.AZURE_TENANT_ID
    return {
        f"https://login.microsoftonline.com/{tid}/v2.0",
        f"https://sts.windows.net/{tid}/",
    }


def _expected_audiences():
    client_id = settings.AZURE_CLIENT_ID
    app_id_uri = getattr(settings, "AZURE_API_AUDIENCE", None) or f"api://{client_id}"
    return {app_id_uri, client_id}


class AzureAdAccessTokenAuthentication(BaseAuthentication):
    """
    Accepts: Authorization: Bearer <Entra access token>

    ✅ FIX:
    - DO NOT lowercase emails for identity.
    - Prefer stable Entra OID for lookup/creation.
    - Fallback to case-insensitive email lookup.
    - Never create a second user due to casing differences.
    """

    def authenticate(self, request):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None

        token = auth.split(" ", 1)[1].strip()
        if not token:
            return None

        try:
            jwk_client = _jwks_client()
            signing_key = jwk_client.get_signing_key_from_jwt(token).key

            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=list(_expected_audiences()),
                options={
                    "verify_signature": True,
                    "verify_aud": True,
                    "verify_exp": True,
                    "verify_iss": False,  # manual check below
                },
            )

            iss = claims.get("iss", "")
            if iss not in _expected_issuers():
                raise AuthenticationFailed(f"Invalid issuer: {iss}")

            # Identity fields
            oid = (claims.get("oid") or "").strip()
            tid = (claims.get("tid") or "").strip()

            # IMPORTANT: do NOT .lower() this — keep as provided
            email = (
                claims.get("preferred_username")
                or claims.get("upn")
                or claims.get("email")
                or ""
            ).strip()

            if not oid and not email:
                raise AuthenticationFailed("Token missing user identity (oid or preferred_username/upn/email).")

            User = get_user_model()

            # ✅ 1) Prefer oid (best unique key)
            user = None
            if oid:
                user = User.objects.filter(azure_oid=oid).first()

            # ✅ 2) Fallback to case-insensitive email match
            if not user and email:
                user = User.objects.filter(email__iexact=email).first()

            # ✅ 3) Create only if truly prevented
            if not user:
                if not email:
                    raise AuthenticationFailed("No email/upn in token; cannot create user without email.")
                user = User.objects.create(
                    email=email,
                    username=email.split("@")[0] if "@" in email else email,
                    is_active=True,
                    azure_oid=oid or None,
                    azure_tid=tid or None,
                )
            else:
                # ✅ keep azure_oid/tid in sync
                changed = set()
                if oid and getattr(user, "azure_oid", None) != oid:
                    user.azure_oid = oid
                    changed.add("azure_oid")
                if tid and getattr(user, "azure_tid", None) != tid:
                    user.azure_tid = tid
                    changed.add("azure_tid")

                # If the user exists and email differs only by case, DO NOT create anything new.
                # Optionally update stored email to match token casing (your choice).
                # Here we keep existing email to avoid churn.

                if changed:
                    user.save(update_fields=list(changed))

            return (user, None)

        except AuthenticationFailed:
            raise
        except Exception as e:
            raise AuthenticationFailed(f"Azure token invalid: {e}")
