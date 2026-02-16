# courses/views.py
from django.utils import timezone
from django.db.models import Count, Q, Max
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse
from django.urls import reverse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

import hashlib
import hmac
import time
from urllib.parse import urlencode

from training.permissions import IsTrainer

from .models import (
    Course, CourseSection, CourseProgress, CourseVideo, CourseVideoOpened,
    CourseQuiz, QuizSubmission, QuizAnswer, QuizChoice, QuizQuestion,

    # ✅ NEW (Notes)
    CourseVideoNote,
)
from .serializers import (
    CourseListSerializer, CourseDetailSerializer, CourseVideoSerializer,
    CourseQuizPublicSerializer,
    CreatorCourseSerializer, CreatorCourseDetailSerializer,
    CreatorSectionCreateSerializer, CreatorSectionUpdateSerializer,
    CreatorVideoCreateSerializer, CreatorVideoUpdateSerializer,

    # ✅ NEW
    CreatorCourseQuizSerializer,

    # ✅ NEW (Notes)
    CourseVideoNoteSerializer,
)
from .sharepoint import SharePointStorage


# -----------------------------
# Helpers
# -----------------------------

def _normalized_role(user):
    """
    Normalizes DB role -> UI role:
      - "field_engineer" (legacy) -> "field"
      - "field" / "office" pass through
    """
    role = getattr(user, "role", None)
    if role == "field_engineer":
        return "field"
    return role


def _is_privileged(user):
    return bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))


def _is_trainer(user) -> bool:
    """
    ✅ True if user is in LMS_TRAINERS_GROUP_ID (or staff/superuser).
    Uses the same logic as IsTrainer.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False

    perm = IsTrainer()
    # IsTrainer.has_permission expects a request, but it only reads request.user.
    # We'll emulate minimal request-like object.
    class _Req:
        pass
    r = _Req()
    r.user = user

    try:
        return bool(perm.has_permission(r, None))
    except Exception:
        return False


def _touch_course_progress(user, course):
    obj, _ = CourseProgress.objects.get_or_create(
        user=user,
        course=course,
        defaults={"last_video": None, "last_video_index": 0},
    )
    obj.last_accessed = timezone.now()
    obj.save(update_fields=["last_accessed"])
    return obj


def _enforce_course_access(user, course):
    """
    Access rules:
      - If user has no role => deny (keeps your current behavior)
      - Field users (non-privileged) can only access field-track courses
      - Office + privileged can access everything
    """
    role = _normalized_role(user)
    if not role:
        return False, Response({"detail": "Waiting for admin access"}, status=status.HTTP_403_FORBIDDEN)

    if role == "field" and not _is_privileged(user):
        if course.track != "field":
            return False, Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    return True, None


def _build_progress_map(user, courses_qs):
    ids = list(courses_qs.values_list("id", flat=True))
    if not ids:
        return {}

    rows = (
        CourseProgress.objects
        .filter(user=user, course_id__in=ids)
        .values("course_id", "attempted_times", "completed_times", "is_completed")
    )

    m = {}
    for r in rows:
        m[int(r["course_id"])] = {
            "attempted_times": int(r.get("attempted_times", 0) or 0),
            "completed_times": int(r.get("completed_times", 0) or 0),
            "is_completed": bool(r.get("is_completed", False)),
        }
    return m


def _quiz_unlocked_for_user(user, course):
    total_required = CourseVideo.objects.filter(course=course, content_type="video").count()
    if total_required == 0:
        return True, 0, 0

    opened_required = (
        CourseVideoOpened.objects
        .filter(user=user, course=course, video__content_type="video")
        .values("video_id")
        .distinct()
        .count()
    )
    return opened_required >= total_required, total_required, opened_required


# -----------------------------
# Learner endpoints
# -----------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])  # ✅ learners allowed
def course_list(request):
    qs = Course.objects.filter(is_published=True)

    role = _normalized_role(request.user)
    if role == "field" and not _is_privileged(request.user):
        qs = qs.filter(track="field")

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category=category)

    qs = qs.annotate(unique_viewers=Count("opened_events__user_id", distinct=True))
    progress_map = _build_progress_map(request.user, qs)

    return Response(
        CourseListSerializer(
            qs,
            many=True,
            context={"request": request, "progress_map": progress_map},
        ).data
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_detail(request, course_id):
    try:
        course = Course.objects.prefetch_related("sections__videos").get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    ok, resp = _enforce_course_access(request.user, course)
    if not ok:
        return resp

    _touch_course_progress(request.user, course)
    progress_map = _build_progress_map(request.user, Course.objects.filter(id=course.id))

    return Response(
        CourseDetailSerializer(course, context={"request": request, "progress_map": progress_map}).data
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_learning(request):
    role = _normalized_role(request.user)
    if not role:
        return Response([])

    progress_qs = (
        CourseProgress.objects
        .filter(user=request.user, course__is_published=True)
        .select_related("course", "last_video")
        .order_by("-last_accessed")
    )

    out = []
    for p in progress_qs:
        c = p.course

        if role == "field" and not _is_privileged(request.user):
            if c.track != "field":
                continue

        base_qs = Course.objects.filter(id=c.id).annotate(unique_viewers=Count("opened_events__user_id", distinct=True))
        progress_map = _build_progress_map(request.user, base_qs)

        course_data = CourseListSerializer(
            base_qs.first(),
            context={"request": request, "progress_map": progress_map},
        ).data

        course_data["last_video"] = CourseVideoSerializer(p.last_video).data if p.last_video else None
        course_data["last_video_index"] = p.last_video_index or 0
        course_data["last_accessed"] = p.last_accessed

        out.append(course_data)
        if len(out) >= 3:
            break

    return Response(out)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_progress(request, course_id):
    role = _normalized_role(request.user)
    if not role:
        return Response({"detail": "Waiting for admin access"}, status=status.HTTP_403_FORBIDDEN)

    video_id = request.data.get("video_id")
    video_index = request.data.get("video_index", 0)

    if not video_id:
        return Response({"detail": "video_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        course = Course.objects.get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    ok, resp = _enforce_course_access(request.user, course)
    if not ok:
        return resp

    try:
        video = CourseVideo.objects.select_related("section", "section__course").get(id=video_id)
    except CourseVideo.DoesNotExist:
        return Response({"detail": "Video not found"}, status=status.HTTP_404_NOT_FOUND)

    if video.section.course_id != course.id:
        return Response({"detail": "Video does not belong to this course"}, status=status.HTTP_400_BAD_REQUEST)

    obj, _ = CourseProgress.objects.get_or_create(
        user=request.user,
        course=course,
        defaults={"last_video": video, "last_video_index": int(video_index or 0)},
    )

    obj.last_video = video
    obj.last_video_index = int(video_index or 0)
    obj.last_accessed = timezone.now()

    if obj.is_completed and int(video_index or 0) == 0:
        obj.is_completed = False

    obj.save(update_fields=["last_video", "last_video_index", "last_accessed", "is_completed"])

    CourseVideoOpened.objects.update_or_create(
        user=request.user,
        video=video,
        defaults={"course": course},
    )

    return Response({"detail": "Progress updated"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quiz_status(request, course_id):
    try:
        course = Course.objects.get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    ok, resp = _enforce_course_access(request.user, course)
    if not ok:
        return resp

    unlocked, total_required, opened_required = _quiz_unlocked_for_user(request.user, course)
    has_quiz = CourseQuiz.objects.filter(course=course, is_published=True).exists()

    prog = CourseProgress.objects.filter(user=request.user, course=course).only(
        "attempted_times", "completed_times", "is_completed"
    ).first()

    return Response({
        "course_id": course.id,
        "total_videos": total_required,
        "opened_videos": opened_required,
        "quiz_unlocked": unlocked,
        "has_quiz": has_quiz,
        "attempted_times": int(getattr(prog, "attempted_times", 0) or 0),
        "completed_times": int(getattr(prog, "completed_times", 0) or 0),
        "is_completed": bool(getattr(prog, "is_completed", False)),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quiz_get(request, course_id):
    try:
        course = Course.objects.get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    ok, resp = _enforce_course_access(request.user, course)
    if not ok:
        return resp

    unlocked, _, _ = _quiz_unlocked_for_user(request.user, course)
    if not unlocked:
        return Response({"detail": "Quiz locked. Open all required videos first."}, status=status.HTTP_403_FORBIDDEN)

    try:
        quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(course=course, is_published=True)
    except CourseQuiz.DoesNotExist:
        return Response({"detail": "Quiz not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response(CourseQuizPublicSerializer(quiz).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def quiz_submit(request, course_id):
    try:
        course = Course.objects.get(id=course_id, is_published=True)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found"}, status=status.HTTP_404_NOT_FOUND)

    ok, resp = _enforce_course_access(request.user, course)
    if not ok:
        return resp

    unlocked, _, _ = _quiz_unlocked_for_user(request.user, course)
    if not unlocked:
        return Response({"detail": "Quiz locked. Open all required videos first."}, status=status.HTTP_403_FORBIDDEN)

    try:
        quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(course=course, is_published=True)
    except CourseQuiz.DoesNotExist:
        return Response({"detail": "Quiz not found"}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data or {}
    answers = payload.get("answers") or []
    if not isinstance(answers, list):
        return Response({"detail": "answers must be a list"}, status=status.HTTP_400_BAD_REQUEST)

    questions = list(quiz.questions.all())
    total = len(questions)
    if total == 0:
        return Response({"detail": "Quiz has no questions"}, status=status.HTTP_400_BAD_REQUEST)

    correct = {}
    for q in questions:
        correct_ids = set(q.choices.filter(is_correct=True).values_list("id", flat=True))
        correct[q.id] = correct_ids

    submitted_map = {}
    for a in answers:
        try:
            qid = int(a.get("question_id"))
            cid = int(a.get("choice_id"))
        except Exception:
            continue
        submitted_map[qid] = cid

    score = 0
    for q in questions:
        chosen = submitted_map.get(q.id)
        if chosen and chosen in correct.get(q.id, set()):
            score += 1

    all_correct = (score == total)

    sub = QuizSubmission.objects.create(
        user=request.user,
        quiz=quiz,
        score=score,
        total=total,
        all_correct=all_correct,
    )

    for q in questions:
        chosen = submitted_map.get(q.id)
        if not chosen:
            continue
        if not QuizChoice.objects.filter(id=chosen, question=q).exists():
            continue
        QuizAnswer.objects.create(
            submission=sub,
            question=q,
            selected_choice_id=chosen,
        )

    prog, _ = CourseProgress.objects.get_or_create(user=request.user, course=course)
    prog.attempted_times = int(prog.attempted_times or 0) + 1

    if all_correct:
        prog.completed_times = int(prog.completed_times or 0) + 1
        prog.is_completed = True
        prog.completed_at = timezone.now()

    prog.save(update_fields=["attempted_times", "completed_times", "is_completed", "completed_at"])

    return Response({
        "score": score,
        "total": total,
        "all_correct": all_correct,
        "completed": all_correct,
        "message": "Course completed" if all_correct else "Not completed",
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_search(request):
    q = (request.query_params.get("q") or "").strip()
    if not q:
        return Response([])

    courses_qs = Course.objects.filter(is_published=True)

    role = _normalized_role(request.user)
    if role == "field" and not _is_privileged(request.user):
        courses_qs = courses_qs.filter(track="field")

    course_matches = courses_qs.filter(Q(title__icontains=q) | Q(description__icontains=q)).distinct()

    section_rows = (
        courses_qs
        .filter(sections__title__icontains=q)
        .values(
            "id", "title", "track", "category", "subcategory", "thumbnail_url",
            "sections__id", "sections__title",
        )
        .distinct()
    )

    video_rows = (
        courses_qs
        .filter(videos__video_title__icontains=q)
        .values(
            "id", "title", "track", "category", "subcategory", "thumbnail_url",
            "videos__id", "videos__video_title",
            "videos__section__id", "videos__section__title",
        )
        .distinct()
    )

    course_matches = course_matches.annotate(unique_viewers=Count("opened_events__user_id", distinct=True))
    progress_map = _build_progress_map(request.user, course_matches)

    serialized_courses = CourseListSerializer(
        course_matches,
        many=True,
        context={"request": request, "progress_map": progress_map},
    ).data

    by_id = {}
    for c in serialized_courses:
        if c.get("id") is not None:
            by_id[int(c["id"])] = c

    out = [{"type": "course", "course": c} for c in serialized_courses]

    if section_rows:
        sec_course_ids = sorted({int(r["id"]) for r in section_rows if r.get("id") is not None})
        if sec_course_ids:
            sec_courses_qs = Course.objects.filter(id__in=sec_course_ids, is_published=True)
            if role == "field" and not _is_privileged(request.user):
                sec_courses_qs = sec_courses_qs.filter(track="field")

            sec_courses_qs = sec_courses_qs.annotate(unique_viewers=Count("opened_events__user_id", distinct=True))
            sec_progress_map = _build_progress_map(request.user, sec_courses_qs)
            sec_serialized = CourseListSerializer(
                sec_courses_qs,
                many=True,
                context={"request": request, "progress_map": sec_progress_map},
            ).data
            for c in sec_serialized:
                by_id[int(c["id"])] = c

        for r in section_rows:
            cid = int(r["id"])
            course_payload = by_id.get(cid)
            if not course_payload:
                continue
            out.append({
                "type": "section",
                "course": course_payload,
                "section": {"id": r.get("sections__id"), "title": r.get("sections__title") or ""},
            })

    if video_rows:
        vid_course_ids = sorted({int(r["id"]) for r in video_rows if r.get("id") is not None})
        if vid_course_ids:
            vid_courses_qs = Course.objects.filter(id__in=vid_course_ids, is_published=True)
            if role == "field" and not _is_privileged(request.user):
                vid_courses_qs = vid_courses_qs.filter(track="field")

            vid_courses_qs = vid_courses_qs.annotate(unique_viewers=Count("opened_events__user_id", distinct=True))
            vid_progress_map = _build_progress_map(request.user, vid_courses_qs)
            vid_serialized = CourseListSerializer(
                vid_courses_qs,
                many=True,
                context={"request": request, "progress_map": vid_progress_map},
            ).data
            for c in vid_serialized:
                by_id[int(c["id"])] = c

        for r in video_rows:
            cid = int(r["id"])
            course_payload = by_id.get(cid)
            if not course_payload:
                continue
            out.append({
                "type": "video",
                "course": course_payload,
                "section": {"id": r.get("videos__section__id"), "title": r.get("videos__section__title") or ""},
                "video": {"id": r.get("videos__id"), "title": r.get("videos__video_title") or ""},
            })

    return Response(out)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_suggestions(request):
    q = (request.query_params.get("q") or "").strip()
    if not q:
        return Response([])

    q = q[:80]

    courses_qs = Course.objects.filter(is_published=True)

    role = _normalized_role(request.user)
    if role == "field" and not _is_privileged(request.user):
        courses_qs = courses_qs.filter(track="field")

    course_titles = list(courses_qs.filter(title__icontains=q).values_list("title", flat=True)[:6])
    section_titles = list(
        courses_qs.filter(sections__title__icontains=q).values_list("sections__title", flat=True).distinct()[:6]
    )
    video_titles = list(
        courses_qs.filter(videos__video_title__icontains=q).values_list("videos__video_title", flat=True).distinct()[:6]
    )

    seen = set()
    out = []
    for s in course_titles + section_titles + video_titles:
        if not s:
            continue
        text = str(s).strip()
        if not text:
            continue
        k = text.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(text)
        if len(out) >= 8:
            break

    return Response(out)


# ============================================================
# ✅ NEW: Learner Notes endpoint (per-user, per-video)
# ============================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def video_notes_get_set(request, video_id):
    """
    Per-user, per-video notes.
    GET  -> returns saved note text (or empty if none)
    POST -> creates/updates note text
    """
    video = get_object_or_404(CourseVideo.objects.select_related("course"), id=video_id)

    ok, resp = _enforce_course_access(request.user, video.course)
    if not ok:
        return resp

    if request.method == "GET":
        note = CourseVideoNote.objects.filter(user=request.user, video=video).first()
        if not note:
            return Response({"video_id": int(video.id), "text": ""}, status=status.HTTP_200_OK)
        return Response(CourseVideoNoteSerializer(note).data, status=status.HTTP_200_OK)

    payload = request.data or {}
    text = payload.get("text", "")
    if text is None:
        text = ""
    text = str(text)

    if len(text) > 20000:
        return Response({"detail": "Notes too long (max 20000 characters)."}, status=status.HTTP_400_BAD_REQUEST)

    note, _ = CourseVideoNote.objects.update_or_create(
        user=request.user,
        video=video,
        defaults={"text": text},
    )
    return Response(CourseVideoNoteSerializer(note).data, status=status.HTTP_200_OK)


# -----------------------------
# Creator workflow
# -----------------------------

def _enforce_creator_ready(user):
    role = _normalized_role(user)
    if not role:
        return False, Response({"detail": "Waiting for admin access"}, status=status.HTTP_403_FORBIDDEN)
    return True, None


def _get_creator_course_or_404(user, course_id):
    """
    ✅ Updated: trainers can access any course in creator workflow (not just creator).
    """
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        raise

    if _is_privileged(user) or _is_trainer(user):
        return course

    if course.created_by_id != getattr(user, "id", None):
        raise Course.DoesNotExist()

    return course


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def creator_course_list_create(request):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    # ✅ uploads/creator access is trainer-gated
    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    if request.method == "GET":
        # ✅ trainers can see all creator courses
        qs = Course.objects.all().order_by("-updated_at", "-created_at")
        return Response(CreatorCourseSerializer(qs, many=True, context={"request": request}).data)

    ser = CreatorCourseSerializer(data=request.data, context={"request": request})
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    course = Course.objects.create(
        title=ser.validated_data["title"],
        description=ser.validated_data.get("description", ""),
        track=ser.validated_data["track"],
        category=ser.validated_data["category"],
        subcategory=ser.validated_data["subcategory"],
        thumbnail_url=ser.validated_data.get("thumbnail_url", ""),
        created_by=request.user,
        status="draft",
        is_published=False,
    )

    if not (course.storage_folder_name or "").strip():
        sp = SharePointStorage()
        sp.ensure_course_storage_folder_name(course)

    return Response(
        CreatorCourseDetailSerializer(course, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def creator_course_detail_update_delete(request, course_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    # ✅ uploads/creator access is trainer-gated
    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    try:
        course = _get_creator_course_or_404(request.user, course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        course = Course.objects.prefetch_related("sections__videos").get(id=course.id)
        return Response(CreatorCourseDetailSerializer(course, context={"request": request}).data)

    if request.method == "PATCH":
        ser = CreatorCourseSerializer(course, data=request.data, partial=True, context={"request": request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        for field in ["title", "description", "track", "category", "subcategory", "thumbnail_url"]:
            if field in ser.validated_data:
                setattr(course, field, ser.validated_data[field])

        course.save()
        course = Course.objects.prefetch_related("sections__videos").get(id=course.id)
        return Response(CreatorCourseDetailSerializer(course, context={"request": request}).data)

    course.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_course_publish(request, course_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    try:
        course = _get_creator_course_or_404(request.user, course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    has_section = CourseSection.objects.filter(course=course).exists()
    has_video = CourseVideo.objects.filter(course=course).exists()

    if not has_section or not has_video:
        return Response(
            {"detail": "Add at least 1 section and 1 content item before publishing."},
            status=status.HTTP_400_BAD_REQUEST
        )

    course.status = "published"
    course.is_published = True
    course.save(update_fields=["status", "is_published", "updated_at"])
    return Response({"detail": "Published"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_section_create(request, course_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    try:
        course = _get_creator_course_or_404(request.user, course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    title = (request.data.get("title") or "").strip()
    if not title:
        return Response({"detail": "title is required"}, status=status.HTTP_400_BAD_REQUEST)

    max_order = CourseSection.objects.filter(course=course).aggregate(m=Max("order")).get("m") or 0
    section = CourseSection.objects.create(course=course, title=title, order=max_order + 1)

    return Response(
        CreatorSectionCreateSerializer(section, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def creator_section_update_delete(request, section_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    section = get_object_or_404(CourseSection.objects.select_related("course"), id=section_id)

    # ✅ changed: allow trainers (not just owner)
    if not (_is_privileged(request.user) or _is_trainer(request.user)) and section.course.created_by_id != request.user.id:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        ser = CreatorSectionUpdateSerializer(section, data=request.data, partial=True, context={"request": request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        if "title" in ser.validated_data:
            section.title = ser.validated_data["title"]
        section.save()

        return Response(CreatorSectionCreateSerializer(section, context={"request": request}).data)

    section.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_sections_reorder(request, course_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    try:
        course = _get_creator_course_or_404(request.user, course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    section_ids = request.data.get("section_ids")
    if not isinstance(section_ids, list) or not section_ids:
        return Response({"detail": "section_ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

    existing = list(CourseSection.objects.filter(course=course, id__in=section_ids).values_list("id", flat=True))
    if len(existing) != len(section_ids):
        return Response({"detail": "One or more sections are invalid"}, status=status.HTTP_400_BAD_REQUEST)

    for idx, sid in enumerate(section_ids, start=1):
        CourseSection.objects.filter(id=sid, course=course).update(order=idx)

    return Response({"detail": "Reordered"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_video_create(request, section_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    section = get_object_or_404(CourseSection.objects.select_related("course"), id=section_id)

    # ✅ changed: allow trainers (not just owner)
    if not (_is_privileged(request.user) or _is_trainer(request.user)) and section.course.created_by_id != request.user.id:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    ser = CreatorVideoUpdateSerializer(data=request.data, context={"request": request})
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    max_order = CourseVideo.objects.filter(section=section).aggregate(m=Max("order")).get("m") or 0

    video = CourseVideo(
        course=section.course,
        section=section,
        order=max_order + 1,
        content_type=ser.validated_data.get("content_type", "video"),
        video_title=ser.validated_data.get("video_title", ""),
        embed_url=ser.validated_data.get("embed_url", "") or "",
        guide_title=ser.validated_data.get("guide_title", "Open resource") or "Open resource",
        guide_url=ser.validated_data.get("guide_url", "") or "",
    )
    video.save()

    return Response(
        CreatorVideoCreateSerializer(video, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def creator_video_update_delete(request, video_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    video = get_object_or_404(CourseVideo.objects.select_related("section__course"), id=video_id)

    # ✅ changed: allow trainers (not just owner)
    if not (_is_privileged(request.user) or _is_trainer(request.user)) and video.course.created_by_id != request.user.id:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        ser = CreatorVideoUpdateSerializer(video, data=request.data, partial=True, context={"request": request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        for field in ["content_type", "video_title", "embed_url", "guide_title", "guide_url"]:
            if field in ser.validated_data:
                setattr(video, field, ser.validated_data[field])

        video.save()
        return Response(CreatorVideoCreateSerializer(video, context={"request": request}).data)

    video.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_videos_reorder(request, section_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    section = get_object_or_404(CourseSection.objects.select_related("course"), id=section_id)

    # ✅ changed: allow trainers (not just owner)
    if not (_is_privileged(request.user) or _is_trainer(request.user)) and section.course.created_by_id != request.user.id:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    video_ids = request.data.get("video_ids")
    if not isinstance(video_ids, list) or not video_ids:
        return Response({"detail": "video_ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

    existing = list(CourseVideo.objects.filter(section=section, id__in=video_ids).values_list("id", flat=True))
    if len(existing) != len(video_ids):
        return Response({"detail": "One or more videos are invalid"}, status=status.HTTP_400_BAD_REQUEST)

    for idx, vid in enumerate(video_ids, start=1):
        CourseVideo.objects.filter(id=vid, section=section).update(order=idx)

    return Response({"detail": "Reordered"}, status=status.HTTP_200_OK)


# -----------------------------
# Upload permissions + Signed Streaming
# -----------------------------

def _require_trainer_group(request):
    """
    Enforce LMS-Trainers group for creator/upload endpoints.
    Staff/superuser bypass inside IsTrainer.
    """
    perm = IsTrainer()
    if not perm.has_permission(request, None):
        return False, Response({"detail": perm.message}, status=status.HTTP_403_FORBIDDEN)
    return True, None


def _sign_stream_params(video_id: int, exp: int) -> str:
    msg = f"{video_id}:{exp}".encode("utf-8")
    key = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_course_thumbnail_upload(request, course_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    try:
        course = _get_creator_course_or_404(request.user, course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    up = request.FILES.get("file")
    if not up:
        return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

    content_type = (getattr(up, "content_type", "") or "").lower()
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if content_type and content_type not in allowed:
        return Response({"detail": "Only PNG/JPG/WEBP images are allowed."}, status=status.HTTP_400_BAD_REQUEST)

    max_bytes = 5 * 1024 * 1024
    if int(getattr(up, "size", 0) or 0) > max_bytes:
        return Response({"detail": "Max file size is 5MB."}, status=status.HTTP_400_BAD_REQUEST)

    filename = getattr(up, "name", "") or "thumbnail"
    if "." not in filename:
        if content_type == "image/png":
            filename += ".png"
        elif content_type in ("image/jpeg", "image/jpg"):
            filename += ".jpg"
        elif content_type == "image/webp":
            filename += ".webp"
        else:
            filename += ".png"

    try:
        sp = SharePointStorage()
        sp.ensure_course_storage_folder_name(course)
        ref = sp.upload_course_thumbnail(course=course, filename=filename, django_file=up)

        course.thumbnail_url = ref.web_url
        course.save(update_fields=["thumbnail_url", "updated_at"])

    except Exception as e:
        return Response({"detail": f"Upload failed: {e}"}, status=status.HTTP_400_BAD_REQUEST)

    course = Course.objects.prefetch_related("sections__videos").get(id=course.id)
    return Response(CreatorCourseDetailSerializer(course, context={"request": request}).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_video_upload(request, section_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    section = get_object_or_404(CourseSection.objects.select_related("course"), id=section_id)
    course = section.course

    # ✅ changed: allow trainers (not just owner)
    if not (_is_privileged(request.user) or _is_trainer(request.user)) and course.created_by_id != request.user.id:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    up = request.FILES.get("file")
    if not up:
        return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

    title = (request.data.get("video_title") or "").strip() or getattr(up, "name", "Uploaded video")
    filename = getattr(up, "name", "uploaded.mp4")

    max_order = CourseVideo.objects.filter(section=section).aggregate(m=Max("order")).get("m") or 0
    order = max_order + 1

    try:
        sp = SharePointStorage()
        sp.ensure_course_storage_folder_name(course)

        ref = sp.upload_course_section_video(course=course, section=section, filename=filename, django_file=up)

        # ✅ NEW: build SharePoint embed SRC (Option A) and store it in embed_url
        embed_src = ""
        try:
            embed_src = sp.build_embed_src_for_drive_item(ref.drive_id, ref.item_id) or ""
        except Exception:
            embed_src = ""

        video = CourseVideo.objects.create(
            course=course,
            section=section,
            order=order,
            content_type="video",
            video_title=title,
            embed_url=embed_src,
            sp_drive_id=ref.drive_id,
            sp_item_id=ref.item_id,
            sp_web_url=ref.web_url,
            sp_name=ref.name,
            sp_mime=ref.mime,
            sp_size=int(ref.size or 0),
        )

    except Exception as e:
        return Response({"detail": f"Upload failed: {e}"}, status=status.HTTP_400_BAD_REQUEST)

    return Response(CreatorVideoCreateSerializer(video, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def video_playback_url(request, video_id):
    video = get_object_or_404(CourseVideo.objects.select_related("course", "section"), id=video_id)

    ok, resp = _enforce_course_access(request.user, video.course)
    if not ok:
        return resp

    if not ((video.sp_drive_id or "").strip() and (video.sp_item_id or "").strip()):
        return Response({"detail": "Video is not an uploaded SharePoint file."}, status=status.HTTP_400_BAD_REQUEST)

    ttl = int(getattr(settings, "VIDEO_STREAM_SIGNED_URL_TTL_SECONDS", 900))
    exp = int(time.time()) + ttl
    sig = _sign_stream_params(video.id, exp)

    base = request.build_absolute_uri(reverse("video_stream", kwargs={"video_id": video.id}))
    qs = urlencode({"exp": exp, "sig": sig})
    return Response({"url": f"{base}?{qs}"})


@api_view(["GET"])
@permission_classes([])  # signed access only (no JWT)
def video_stream(request, video_id):
    try:
        exp = int(request.query_params.get("exp") or "0")
    except Exception:
        exp = 0
    sig = (request.query_params.get("sig") or "").strip()

    if exp <= 0 or exp < int(time.time()):
        return HttpResponse("Expired", status=403)

    expected = _sign_stream_params(int(video_id), int(exp))
    if not sig or not hmac.compare_digest(sig, expected):
        return HttpResponse("Forbidden", status=403)

    video = get_object_or_404(CourseVideo.objects.select_related("course"), id=video_id)

    if not ((video.sp_drive_id or "").strip() and (video.sp_item_id or "").strip()):
        return HttpResponse("Not found", status=404)

    range_header = request.headers.get("Range")
    sp = SharePointStorage()
    r = sp.download_stream(video.sp_drive_id, video.sp_item_id, range_header=range_header)

    if r.status_code >= 400:
        return HttpResponse(f"Upstream error: {r.status_code}", status=502)

    def _iter():
        for chunk in r.iter_content(chunk_size=1024 * 256):
            if chunk:
                yield chunk

    status_code = 206 if range_header else 200
    resp = StreamingHttpResponse(_iter(), status=status_code)

    ctype = (video.sp_mime or "").strip() or r.headers.get("Content-Type") or "application/octet-stream"
    resp["Content-Type"] = ctype
    resp["Accept-Ranges"] = "bytes"

    if "Content-Range" in r.headers:
        resp["Content-Range"] = r.headers["Content-Range"]
    if "Content-Length" in r.headers:
        resp["Content-Length"] = r.headers["Content-Length"]

    return resp


# ============================================================
# ✅ NEW: Creator Quiz Builder Endpoints (trainer-only)
#    - Does NOT affect learner quiz behavior
# ============================================================

@api_view(["GET", "POST", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def creator_quiz_get_create_update_delete(request, course_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    try:
        course = _get_creator_course_or_404(request.user, course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        quiz = CourseQuiz.objects.filter(course=course).prefetch_related("questions__choices").first()
        if not quiz:
            return Response({"quiz": None}, status=status.HTTP_200_OK)
        return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)

    if request.method == "POST":
        # Create quiz if not exists
        if CourseQuiz.objects.filter(course=course).exists():
            quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(course=course)
            return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)

        title = (request.data.get("title") or "").strip() or "Course Quiz"
        is_published = bool(request.data.get("is_published", True))

        quiz = CourseQuiz.objects.create(
            course=course,
            title=title,
            is_published=is_published,
        )
        quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(id=quiz.id)
        return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_201_CREATED)

    quiz = CourseQuiz.objects.filter(course=course).prefetch_related("questions__choices").first()
    if not quiz:
        return Response({"detail": "Quiz not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        changed = set()

        if "title" in request.data:
            quiz.title = (request.data.get("title") or "").strip() or quiz.title
            changed.add("title")

        if "is_published" in request.data:
            quiz.is_published = bool(request.data.get("is_published"))
            changed.add("is_published")

        if changed:
            quiz.save(update_fields=list(changed))

        quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(id=quiz.id)
        return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)

    # DELETE
    quiz.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_question_create(request, quiz_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    quiz = get_object_or_404(CourseQuiz.objects.select_related("course"), id=quiz_id)

    # Ensure trainer has access to this course via existing helper
    try:
        _get_creator_course_or_404(request.user, quiz.course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    prompt = (request.data.get("prompt") or "").strip()
    if not prompt:
        return Response({"detail": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)

    max_order = QuizQuestion.objects.filter(quiz=quiz).aggregate(m=Max("order")).get("m") or 0
    q = QuizQuestion.objects.create(quiz=quiz, prompt=prompt, order=max_order + 1)

    quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(id=quiz.id)
    return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def creator_question_update_delete(request, question_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    q = get_object_or_404(QuizQuestion.objects.select_related("quiz__course"), id=question_id)

    try:
        _get_creator_course_or_404(request.user, q.quiz.course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        prompt = (request.data.get("prompt") or "").strip()
        if "prompt" in request.data and not prompt:
            return Response({"detail": "prompt cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)

        if "prompt" in request.data:
            q.prompt = prompt
            q.save(update_fields=["prompt"])

        quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(id=q.quiz_id)
        return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)

    # DELETE
    quiz_id = q.quiz_id
    q.delete()
    quiz = CourseQuiz.objects.filter(id=quiz_id).prefetch_related("questions__choices").first()
    if not quiz:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def creator_choice_create(request, question_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    q = get_object_or_404(QuizQuestion.objects.select_related("quiz__course"), id=question_id)

    try:
        _get_creator_course_or_404(request.user, q.quiz.course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    # ✅ NEW: enforce max 4 choices per question
    existing_count = QuizChoice.objects.filter(question=q).count()
    if existing_count >= 4:
        return Response({"detail": "Each question can have a maximum of 4 options."}, status=status.HTTP_400_BAD_REQUEST)

    text = (request.data.get("text") or "").strip()
    if not text:
        return Response({"detail": "text is required"}, status=status.HTTP_400_BAD_REQUEST)

    is_correct = bool(request.data.get("is_correct", False))

    QuizChoice.objects.create(
        question=q,
        text=text,
        is_correct=is_correct,
    )

    quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(id=q.quiz_id)
    return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def creator_choice_update_delete(request, choice_id):
    ok, resp = _enforce_creator_ready(request.user)
    if not ok:
        return resp

    ok, resp = _require_trainer_group(request)
    if not ok:
        return resp

    ch = get_object_or_404(QuizChoice.objects.select_related("question__quiz__course"), id=choice_id)

    try:
        _get_creator_course_or_404(request.user, ch.question.quiz.course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PATCH":
        changed = set()

        if "text" in request.data:
            text = (request.data.get("text") or "").strip()
            if not text:
                return Response({"detail": "text cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            ch.text = text
            changed.add("text")

        if "is_correct" in request.data:
            ch.is_correct = bool(request.data.get("is_correct"))
            changed.add("is_correct")

        if changed:
            ch.save(update_fields=list(changed))

        quiz = CourseQuiz.objects.prefetch_related("questions__choices").get(id=ch.question.quiz_id)
        return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)

    # DELETE
    quiz_id = ch.question.quiz_id
    ch.delete()
    quiz = CourseQuiz.objects.filter(id=quiz_id).prefetch_related("questions__choices").first()
    if not quiz:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response({"quiz": CreatorCourseQuizSerializer(quiz).data}, status=status.HTTP_200_OK)
