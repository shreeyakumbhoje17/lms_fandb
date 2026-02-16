# training/views_trainer.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import IsTrainer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trainer_status(request):
    """
    Returns whether the current authenticated user can upload (is a trainer).

    ✅ Uses JWT auth (DRF IsAuthenticated) — NOT Django session login_required.
    ✅ Uses the same Entra group enforcement logic as the protected endpoints.
    """
    can_upload = IsTrainer().has_permission(request, None)
    return Response({
        "can_upload": bool(can_upload),
        "source": "entra_group"
    })
