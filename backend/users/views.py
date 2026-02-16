from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import F
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken

from courses.models import CourseProgress

from .graph import (
    get_user_licenses_and_object_id,
    suggest_role_from_skus,
    is_user_in_group,
)

from .models import UserMonthlyLogin, MonthlyActiveUsers
from .token_verify import verify_microsoft_id_token  # ✅ NEW

User = get_user_model()


@api_view(["POST"])
@permission_classes([AllowAny])
def microsoft_login(request):
    """
    POST /api/auth/microsoft/
    Body: { "id_token": "..." }

    ✅ Production-safe:
    - Verifies Microsoft token signature (JWKS), issuer, audience, expiry
    - Uses oid as primary identity when available
    - Stores canonical email lowercase, preserves casing in email_display
    """
    id_token = request.data.get("id_token")
    if not id_token:
        return Response({"detail": "id_token is required"}, status=status.HTTP_400_BAD_REQUEST)

    # ✅ VERIFY token properly (no verify_signature=False)
    try:
        payload = verify_microsoft_id_token(id_token)
    except Exception as e:
        return Response({"detail": f"Invalid token: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)

    email_raw = (payload.get("preferred_username") or payload.get("upn") or payload.get("email") or "").strip()
    name = (payload.get("name") or "").strip()

    oid = (payload.get("oid") or "").strip() or None
    tid = (payload.get("tid") or "").strip() or None

    if not email_raw and not oid:
        return Response({"detail": "Email/oid not found in token"}, status=status.HTTP_400_BAD_REQUEST)

    email_norm = email_raw.lower() if email_raw else ""

    first = name.split(" ")[0] if name else ""
    last = " ".join(name.split(" ")[1:]) if len(name.split(" ")) > 1 else ""

    # 1) Prefer matching by oid (best + stable)
    user = None
    if oid:
        user = User.objects.filter(azure_oid=oid).first()

    # 2) Fallback to canonical email (always lower)
    if not user and email_norm:
        user = User.objects.filter(email=email_norm).first()

    if not user:
        if not email_norm:
            return Response({"detail": "Cannot create user without email."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            email=email_norm,              # canonical
            email_display=email_raw or "",  # preserve casing for UI
            username=(email_norm.split("@")[0] if email_norm else "user"),
            first_name=first,
            last_name=last,
            is_active=True,
        )

    changed_fields = set()

    # Keep display email in sync (doesn't affect identity)
    if email_raw and getattr(user, "email_display", "") != email_raw:
        user.email_display = email_raw
        changed_fields.add("email_display")

    # Keep canonical email synced (identity)
    if email_norm and getattr(user, "email", "") != email_norm:
        user.email = email_norm
        changed_fields.add("email")

    # Save oid/tid
    if oid and getattr(user, "azure_oid", None) != oid:
        user.azure_oid = oid
        changed_fields.add("azure_oid")

    if tid and getattr(user, "azure_tid", None) != tid:
        user.azure_tid = tid
        changed_fields.add("azure_tid")

    # Staff/superuser forces office
    if user.is_superuser or user.is_staff:
        if user.role != "office":
            user.role = "office"
            changed_fields.add("role")

    # Always compute license-derived role suggestion on every login
    try:
        ident = oid or email_norm
        sku_parts, resolved_object_id = get_user_licenses_and_object_id(ident)

        if resolved_object_id and getattr(user, "azure_oid", None) != resolved_object_id:
            user.azure_oid = resolved_object_id
            changed_fields.add("azure_oid")

        sug_role, reason = suggest_role_from_skus(sku_parts)

        if getattr(user, "suggested_role", None) != sug_role:
            user.suggested_role = sug_role
            changed_fields.add("suggested_role")

        if getattr(user, "suggested_role_reason", None) != reason:
            user.suggested_role_reason = reason
            changed_fields.add("suggested_role_reason")

        licenses_str = ",".join(sku_parts or [])
        if getattr(user, "licenses", None) != licenses_str:
            user.licenses = licenses_str
            changed_fields.add("licenses")

        # Role derived from license unless staff/superuser
        if not (user.is_superuser or user.is_staff):
            if sug_role in ("office", "field"):
                if user.role != sug_role:
                    user.role = sug_role
                    changed_fields.add("role")
            else:
                if user.role is not None:
                    user.role = None
                    changed_fields.add("role")

    except Exception as e:
        msg = f"Graph lookup failed: {e}"
        if getattr(user, "suggested_role", None) is not None or getattr(user, "suggested_role_reason", None) != msg:
            user.suggested_role = None
            user.suggested_role_reason = msg
            changed_fields.update({"suggested_role", "suggested_role_reason"})

    if changed_fields:
        user.save(update_fields=list(changed_fields))

    # ✅ MAU: Count unique users who logged in this month
    now = timezone.now()
    y, m = now.year, now.month

    monthly_row, monthly_created = UserMonthlyLogin.objects.get_or_create(user=user, year=y, month=m)
    if monthly_created:
        MonthlyActiveUsers.objects.get_or_create(year=y, month=m)
        MonthlyActiveUsers.objects.filter(year=y, month=m).update(active_users=F("active_users") + 1)

    refresh = RefreshToken.for_user(user)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            # return UI email casing
            "email": user.email_display or user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "suggested_role": getattr(user, "suggested_role", None),
            "suggested_role_reason": getattr(user, "suggested_role_reason", None),
            "licenses": getattr(user, "licenses", ""),
            "can_create_courses": bool(getattr(user, "can_create_courses", False)),
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    u = request.user
    role = u.role
    if u.is_superuser or u.is_staff:
        role = "office"

    # ✅ Entra group-based can_upload
    can_upload = False
    try:
        group_id = getattr(settings, "LMS_TRAINERS_GROUP_ID", "") or ""
        oid = getattr(u, "azure_oid", None)

        if u.is_superuser or u.is_staff:
            can_upload = True
        elif group_id and oid:
            can_upload = is_user_in_group(oid, group_id)
        else:
            can_upload = False
    except Exception:
        can_upload = False

    return Response({
        "email": getattr(u, "email_display", "") or u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": role,
        "suggested_role": getattr(u, "suggested_role", None),
        "suggested_role_reason": getattr(u, "suggested_role_reason", None),
        "licenses": getattr(u, "licenses", ""),
        "can_create_courses": bool(getattr(u, "can_create_courses", False)),
        "can_upload": bool(can_upload),
        "is_superuser": u.is_superuser,
        "is_staff": u.is_staff,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def navigation(request):
    """
    Your existing navigation logic (unchanged).
    """
    from courses.models import Course

    u = request.user

    role = u.role
    if u.is_superuser or u.is_staff:
        role = "office"

    qs = Course.objects.filter(is_published=True)

    if role == "field" and not (u.is_superuser or u.is_staff):
        qs = qs.filter(track="field")

    office_field_subs = [
        ("essentials", "Essentials"),
        ("applications", "Applications"),
        ("customers", "Customers"),
    ]

    trades_subs = [
        ("building_fabric", "Building Fabric"),
        ("drainage_and_plumbing", "Drainage and Plumbing"),
        ("gas_and_electrical", "Gas and Electrical"),
        ("fire_safety", "Fire Safety"),
        ("environmental_services", "Environmental Services"),
        ("aspect_principles", "Aspect Principles"),
    ]

    categories_def = [
        ("office", "Office", office_field_subs),
        ("field", "Field Engineers", office_field_subs),
        ("trades", "Trades", trades_subs),
    ]

    existing = set(qs.values_list("category", "subcategory").distinct())

    categories = []
    for cat_key, cat_label, sub_defs in categories_def:
        subs = []
        for sub_key, sub_label in sub_defs:
            if (cat_key, sub_key) in existing:
                subs.append({"key": sub_key, "label": sub_label})

        if subs:
            categories.append({
                "key": cat_key,
                "label": cat_label,
                "subcategories": subs,
            })

    return Response({
        "role": role,
        "categories": categories,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_learning(request):
    """
    Your existing my_learning logic (unchanged).
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
