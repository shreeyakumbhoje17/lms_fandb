from functools import wraps
from django.http import JsonResponse

from django.conf import settings
from rest_framework.permissions import BasePermission

from users.graph import is_user_in_group


def require_trainer(view_func):
    """
    Temporary gate. For now it reads request.user.can_upload (if set)
    or request.can_upload (if you attach it in middleware).
    Default is False.
    """
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        can_upload = getattr(request, "can_upload", None)
        if can_upload is None:
            can_upload = getattr(request.user, "can_upload", False)

        if not can_upload:
            return JsonResponse(
                {"detail": "Forbidden: trainers only."},
                status=403
            )
        return view_func(request, *args, **kwargs)

    return _wrapped


def is_trainer_user(user) -> bool:
    """
    ✅ Reusable trainer check (group-based).
    Staff/superuser bypass.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
        return True

    group_id = getattr(settings, "LMS_TRAINERS_GROUP_ID", "") or ""
    oid = getattr(user, "azure_oid", None)

    if not group_id or not oid:
        return False

    try:
        return bool(is_user_in_group(oid, group_id))
    except Exception:
        # fail closed (secure)
        return False


class IsTrainer(BasePermission):
    """
    ✅ Enforces Entra group membership for trainers.
    Uses app-only Graph token to check if the authenticated user is in LMS-Trainers.
    """
    message = "Forbidden: trainers only."

    def has_permission(self, request, view):
        return is_trainer_user(getattr(request, "user", None))
