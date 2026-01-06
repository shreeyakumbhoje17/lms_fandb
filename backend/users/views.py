from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken

import jwt
from jwt import PyJWKClient

from courses.models import Course, CourseProgress

User = get_user_model()


def verify_microsoft_id_token(id_token: str) -> dict:
    tenant_id = settings.AZURE_TENANT_ID
    client_id = settings.AZURE_CLIENT_ID

    jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    jwk_client = PyJWKClient(jwks_url)
    signing_key = jwk_client.get_signing_key_from_jwt(id_token)

    issuer = f"https://login.microsoftonline.com/{tenant_id}/v2.0"

    payload = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=issuer,
        options={"verify_exp": True},
    )
    return payload


@api_view(["POST"])
@permission_classes([AllowAny])
def microsoft_login(request):
    """
    POST /api/auth/microsoft/
    Body: { "id_token": "..." }
    """
    id_token = request.data.get("id_token")
    if not id_token:
        return Response({"detail": "id_token is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = verify_microsoft_id_token(id_token)
    except Exception as e:
        return Response({"detail": f"Invalid token: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)

    email = payload.get("preferred_username") or payload.get("email")
    name = payload.get("name") or ""

    if not email:
        return Response({"detail": "Email not found in token"}, status=status.HTTP_400_BAD_REQUEST)

    first = name.split(" ")[0] if name else ""
    last = " ".join(name.split(" ")[1:]) if len(name.split(" ")) > 1 else ""

    user, _ = User.objects.get_or_create(
        email=email,
        defaults={
            "username": email.split("@")[0],
            "first_name": first,
            "last_name": last,
        },
    )

    # ✅ Treat staff/superuser as office view
    if user.is_superuser or user.is_staff:
        if user.role != "office":
            user.role = "office"
            user.save(update_fields=["role"])

    refresh = RefreshToken.for_user(user)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """
    GET /api/me/
    Returns the currently logged in user.
    """
    u = request.user
    role = u.role

    if u.is_superuser or u.is_staff:
        role = "office"

    return Response({
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": role,
        "is_superuser": u.is_superuser,
        "is_staff": u.is_staff,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def navigation(request):
    """
    GET /api/navigation/
    Build categories dynamically from published courses.

    Requirements:
    - Essentials dropdown contains BOTH office + field essentials courses (when allowed)
    - Applications dropdown contains Chumley (office) + FSL (field) (when allowed)
    - Customer Journey dropdown contains both (when allowed)
    - No "Tracks" item
    """
    u = request.user

    role = u.role
    if u.is_superuser or u.is_staff:
        role = "office"

    qs = Course.objects.filter(is_published=True)

    # Field users see only field track (unless staff/superuser)
    if role == "field" and not (u.is_superuser or u.is_staff):
        qs = qs.filter(track="field")

    # Pending users (role is None/empty) still see all menu items,
    # but frontend will block clicks using pendingMode.
    courses = list(qs.values("id", "title", "track", "category"))

    def norm_cat(cat: str) -> str:
        # support your old value too
        if cat == "fsl_app":
            return "applications"
        return cat

    cat_order = ["essentials", "applications", "customer_journey"]
    cat_labels = {
        "essentials": "Essentials",
        "applications": "Applications",
        "customer_journey": "Customer Journey",
    }

    grouped = {c: [] for c in cat_order}
    for c in courses:
        grouped.setdefault(norm_cat(c["category"]), []).append(c)

    items = []
    for cat in cat_order:
        sub = []
        for c in sorted(grouped.get(cat, []), key=lambda x: (x["track"], x["id"])):
            sub.append({
                "label": c["title"],
                "to": f"/course/{c['id']}",
                "track": c["track"],
            })

        if sub:
            items.append({
                "label": cat_labels.get(cat, cat.title()),
                "sub": sub,
            })

    return Response({
        "role": role,
        "items": items,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_learning(request):
    """
    GET /api/my-learning/
    Returns user's courses ordered by last_accessed DESC.
    """
    u = request.user

    qs = (
        CourseProgress.objects
        .filter(user=u, course__is_published=True)
        .select_related("course", "last_video")
        .order_by("-last_accessed")
    )

    if (u.role == "field") and (not u.is_superuser) and (not u.is_staff):
        qs = qs.filter(course__track="field")

    items = []
    for p in qs:
        c = p.course
        items.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "thumbnail_url": getattr(c, "thumbnail_url", ""),
            "resume": {
                "video_index": p.last_video_index,
                "video_id": p.last_video.id if p.last_video else None,
                "video_title": p.last_video.video_title if p.last_video else "",
            },
            "last_accessed": p.last_accessed,
        })

    return Response(items)
