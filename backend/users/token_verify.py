import time
import jwt
from jwt import PyJWKClient

from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed


_jwks_client_cache = {"client": None, "expires_at": 0}


def _jwks_client() -> PyJWKClient:
    """
    Cache JWKS client to avoid fetching keys every request.
    """
    now = int(time.time())
    if _jwks_client_cache["client"] and now < _jwks_client_cache["expires_at"]:
        return _jwks_client_cache["client"]

    tenant_id = getattr(settings, "AZURE_TENANT_ID", "") or ""
    if not tenant_id:
        raise AuthenticationFailed("Server misconfiguration: AZURE_TENANT_ID missing")

    jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    client = PyJWKClient(jwks_url)

    _jwks_client_cache["client"] = client
    _jwks_client_cache["expires_at"] = now + 6 * 3600
    return client


def _expected_issuers() -> set[str]:
    tid = getattr(settings, "AZURE_TENANT_ID", "") or ""
    return {
        f"https://login.microsoftonline.com/{tid}/v2.0",
        f"https://sts.windows.net/{tid}/",
    }


def _expected_audiences_for_id_token() -> set[str]:
    """
    For an ID token, the audience is usually the FRONTEND app's client id.
    We'll allow both frontend and backend client ids to be safe.
    """
    auds = set()

    frontend = (getattr(settings, "AZURE_FRONTEND_CLIENT_ID", "") or "").strip()
    backend = (getattr(settings, "AZURE_CLIENT_ID", "") or "").strip()
    api_aud = (getattr(settings, "AZURE_API_AUDIENCE", "") or "").strip()

    if frontend:
        auds.add(frontend)
    if backend:
        auds.add(backend)
    if api_aud:
        auds.add(api_aud)

    return {a for a in auds if a}


def verify_microsoft_id_token(id_token: str) -> dict:
    """
    Verify Microsoft Entra ID token:
      - signature (JWKS)
      - exp
      - aud (frontend client id)
      - iss (tenant)
    Returns the claims.
    """
    tok = (id_token or "").strip()
    if not tok:
        raise AuthenticationFailed("id_token is required")

    jwk_client = _jwks_client()
    signing_key = jwk_client.get_signing_key_from_jwt(tok).key

    audiences = list(_expected_audiences_for_id_token())
    if not audiences:
        raise AuthenticationFailed("Server misconfiguration: AZURE_FRONTEND_CLIENT_ID missing")

    claims = jwt.decode(
        tok,
        signing_key,
        algorithms=["RS256"],
        audience=audiences,
        options={
            "verify_signature": True,
            "verify_aud": True,
            "verify_exp": True,
            "verify_iss": False,  # manual below
        },
    )

    iss = (claims.get("iss") or "").strip()
    if iss not in _expected_issuers():
        raise AuthenticationFailed(f"Invalid issuer: {iss}")

    tid_claim = (claims.get("tid") or "").strip()
    tid_expected = (getattr(settings, "AZURE_TENANT_ID", "") or "").strip()
    if tid_claim and tid_expected and tid_claim != tid_expected:
        raise AuthenticationFailed("Invalid tenant")

    return claims
