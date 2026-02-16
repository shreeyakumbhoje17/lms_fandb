import time
import requests
from urllib.parse import quote
from django.conf import settings

# -------------------------------------------------
# In-memory caches (process-local)
# -------------------------------------------------

_token_cache = {"access_token": None, "expires_at": 0}
_sku_cache = {"map": None, "expires_at": 0}


# -------------------------------------------------
# App-only Microsoft Graph token
# -------------------------------------------------

def _get_graph_app_token() -> str:
    """
    Gets an app-only Microsoft Graph token using client_credentials.
    Uses an in-memory cache to avoid requesting a token on every call.
    """
    now = int(time.time())

    if _token_cache["access_token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    url = f"{settings.AZURE_AUTHORITY}/oauth2/v2.0/token"

    data = {
        "client_id": settings.AZURE_CLIENT_ID,
        "client_secret": settings.AZURE_CLIENT_SECRET,
        "grant_type": "client_credentials",
        # MUST be .default for app-only permissions
        "scope": getattr(
            settings,
            "AZURE_GRAPH_SCOPE",
            "https://graph.microsoft.com/.default",
        ),
    }

    r = requests.post(url, data=data, timeout=15)

    # ✅ DO NOT hide Azure AD error payloads
    if r.status_code >= 400:
        try:
            payload = r.json()
        except Exception:
            payload = {"raw": r.text}

        raise RuntimeError(
            "Azure token request failed\n"
            f"POST {url}\n"
            f"Status: {r.status_code}\n"
            f"Response: {payload}\n"
            f"client_id: {data.get('client_id')}\n"
            f"scope: {data.get('scope')}\n"
        )

    j = r.json()

    _token_cache["access_token"] = j["access_token"]
    _token_cache["expires_at"] = now + int(j.get("expires_in", 3600))

    return _token_cache["access_token"]


# -------------------------------------------------
# Public wrapper (used by uploads / streaming)
# -------------------------------------------------

def get_graph_app_token() -> str:
    """
    Public wrapper for the app-only Graph token.
    """
    return _get_graph_app_token()


# -------------------------------------------------
# Low-level Graph helpers
# -------------------------------------------------

def _graph_get(path: str) -> dict:
    """
    Performs a GET against Microsoft Graph with the app-only token.
    On failure, raises RuntimeError with Graph's error body.
    """
    token = _get_graph_app_token()
    url = f"https://graph.microsoft.com/v1.0{path}"

    r = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )

    if r.status_code >= 400:
        raise RuntimeError(f"Graph {r.status_code} for {path}: {r.text}")

    return r.json()


# -------------------------------------------------
# License / SKU helpers
# -------------------------------------------------

def _get_sku_id_to_partnumber() -> dict:
    """
    Cache tenant subscribed SKUs so we can map skuId -> skuPartNumber.
    """
    now = int(time.time())

    if _sku_cache["map"] and now < _sku_cache["expires_at"] - 60:
        return _sku_cache["map"]

    data = _graph_get("/subscribedSkus?$select=skuId,skuPartNumber")
    m = {item["skuId"]: item.get("skuPartNumber", "") for item in data.get("value", [])}

    _sku_cache["map"] = m
    _sku_cache["expires_at"] = now + 6 * 3600  # 6 hours

    return m


def get_user_licenses_and_object_id(user_identifier: str) -> tuple[list[str], str | None]:
    """
    user_identifier can be:
      - Entra Object ID (oid)
      - User Principal Name / email

    Returns:
      (sku_part_numbers, resolved_object_id)
    """
    ident = quote(user_identifier, safe="")
    user = _graph_get(f"/users/{ident}?$select=id,assignedLicenses")

    sku_ids = [x["skuId"] for x in user.get("assignedLicenses", []) if "skuId" in x]
    sku_map = _get_sku_id_to_partnumber()
    sku_parts = [sku_map.get(s, s) for s in sku_ids]

    return sku_parts, user.get("id")


def suggest_role_from_skus(sku_parts: list[str]) -> tuple[str | None, str]:
    """
    Returns (role, reason)
    role ∈ {"field", "office", None}
    """
    parts = [p.upper() for p in sku_parts]

    if any("F3" in p for p in parts):
        return "field", f"Detected F3-like SKU(s): {', '.join(sku_parts)}"

    if any("E3" in p for p in parts) or any("ENTERPRISEPACK" in p for p in parts):
        return "office", f"Detected E3-like SKU(s): {', '.join(sku_parts)}"

    if sku_parts:
        return None, f"SKU(s) found but not mapped: {', '.join(sku_parts)}"

    return None, "No assigned licenses found"


# -------------------------------------------------
# Trainer group membership (app-only)
# -------------------------------------------------

def is_user_in_group(user_object_id: str, group_object_id: str) -> bool:
    """
    Uses Microsoft Graph checkMemberGroups to verify group membership.

    Requires Application permission:
      - GroupMember.Read.All OR
      - Directory.Read.All
    """
    if not user_object_id or not group_object_id:
        return False

    token = _get_graph_app_token()

    url = (
        "https://graph.microsoft.com/v1.0"
        f"/users/{quote(user_object_id, safe='')}/checkMemberGroups"
    )

    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"groupIds": [group_object_id]},
        timeout=15,
    )

    if r.status_code >= 400:
        raise RuntimeError(f"Graph {r.status_code} checkMemberGroups: {r.text}")

    data = r.json() or {}
    return group_object_id in (data.get("value") or [])
