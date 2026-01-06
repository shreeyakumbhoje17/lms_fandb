from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Course
from .serializers import CourseListSerializer, CourseDetailSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_list(request):
    qs = Course.objects.filter(is_published=True)

    # ✅ Only restrict field users who are NOT staff/superuser
    # Pending users (role is null/empty) can still see the list (locked in frontend)
    if request.user.role == "field" and not (request.user.is_staff or request.user.is_superuser):
        qs = qs.filter(track="field")

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category=category)

    return Response(CourseListSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_detail(request, course_id):
    try:
        course = Course.objects.get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    # ✅ Block pending users (no role assigned yet)
    # This prevents bypassing the locked UI by typing /course/<id>
    if not getattr(request.user, "role", None):
        return Response({"detail": "Waiting for admin access"}, status=status.HTTP_403_FORBIDDEN)

    # ✅ Block only if field user (not staff/superuser) tries to open office course
    if request.user.role == "field" and not (request.user.is_staff or request.user.is_superuser):
        if course.track != "field":
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    return Response(CourseDetailSerializer(course, context={"request": request}).data)
