from rest_framework import serializers
from django.db.models import Count

from .models import (
    Course, CourseSection, CourseVideo, CourseVideoOpened,
    CourseQuiz, QuizQuestion, QuizChoice,

    # ✅ NEW
    CourseVideoNote,
)


class CourseVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseVideo
        fields = [
            "id", "order", "content_type", "video_title",
            "embed_url",
            "guide_title", "guide_url",

            # ✅ NEW: upload-backed video fields (read-only from frontend perspective)
            "sp_drive_id", "sp_item_id", "sp_web_url", "sp_name", "sp_mime", "sp_size",
        ]


class CourseSectionSerializer(serializers.ModelSerializer):
    videos = CourseVideoSerializer(many=True, read_only=True)

    class Meta:
        model = CourseSection
        fields = ["id", "title", "order", "videos"]


class CourseDetailSerializer(serializers.ModelSerializer):
    sections = CourseSectionSerializer(many=True, read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    unique_viewers = serializers.SerializerMethodField()

    attempted_times = serializers.SerializerMethodField()
    completed_times = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    def get_thumbnail_url(self, obj):
        url = obj.thumbnail_url or ""
        if not url:
            return ""
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_unique_viewers(self, obj):
        return (
            CourseVideoOpened.objects.filter(course=obj)
            .values("user_id")
            .distinct()
            .count()
        )

    def _progress_map(self):
        return self.context.get("progress_map") or {}

    def get_attempted_times(self, obj):
        p = self._progress_map().get(obj.id) or {}
        return int(p.get("attempted_times", 0) or 0)

    def get_completed_times(self, obj):
        p = self._progress_map().get(obj.id) or {}
        return int(p.get("completed_times", 0) or 0)

    def get_is_completed(self, obj):
        p = self._progress_map().get(obj.id) or {}
        return bool(p.get("is_completed", False))

    class Meta:
        model = Course
        fields = [
            "id", "title", "description",
            "track", "category", "subcategory",
            "thumbnail_url", "unique_viewers",
            "attempted_times", "completed_times", "is_completed",
            "sections"
        ]


class CourseListSerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()
    unique_viewers = serializers.IntegerField(read_only=True)

    attempted_times = serializers.SerializerMethodField()
    completed_times = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    def get_thumbnail_url(self, obj):
        url = obj.thumbnail_url or ""
        if not url:
            return ""
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def _progress_map(self):
        return self.context.get("progress_map") or {}

    def get_attempted_times(self, obj):
        p = self._progress_map().get(obj.id) or {}
        return int(p.get("attempted_times", 0) or 0)

    def get_completed_times(self, obj):
        p = self._progress_map().get(obj.id) or {}
        return int(p.get("completed_times", 0) or 0)

    def get_is_completed(self, obj):
        p = self._progress_map().get(obj.id) or {}
        return bool(p.get("is_completed", False))

    class Meta:
        model = Course
        fields = [
            "id", "title", "description",
            "track", "category", "subcategory",
            "thumbnail_url", "is_published",
            "unique_viewers",
            "attempted_times", "completed_times", "is_completed",
        ]


class QuizChoicePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizChoice
        fields = ["id", "text"]


class QuizQuestionPublicSerializer(serializers.ModelSerializer):
    choices = QuizChoicePublicSerializer(many=True, read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ["id", "order", "prompt", "choices"]


class CourseQuizPublicSerializer(serializers.ModelSerializer):
    questions = QuizQuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = CourseQuiz
        fields = ["id", "title", "questions"]


class CreatorCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "description",
            "track",
            "category",
            "subcategory",
            "thumbnail_url",
            "is_published",
            "status",
            "created_at",
            "updated_at",
            "storage_folder_name",  # ✅ NEW visibility (read/write on create only in views)
        ]
        read_only_fields = ["is_published", "status", "created_at", "updated_at"]


class CreatorCourseDetailSerializer(serializers.ModelSerializer):
    sections = CourseSectionSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "description",
            "track",
            "category",
            "subcategory",
            "thumbnail_url",
            "is_published",
            "status",
            "created_at",
            "updated_at",
            "storage_folder_name",  # ✅ NEW
            "sections",
        ]
        read_only_fields = ["is_published", "status", "created_at", "updated_at", "sections"]


class CreatorSectionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseSection
        fields = ["id", "course", "title", "order"]
        read_only_fields = ["id", "course", "order"]


class CreatorSectionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseSection
        fields = ["id", "title"]
        read_only_fields = ["id"]


class CreatorVideoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseVideo
        fields = [
            "id",
            "course",
            "section",
            "order",
            "content_type",
            "video_title",
            "embed_url",
            "guide_title",
            "guide_url",

            # ✅ NEW
            "sp_drive_id", "sp_item_id", "sp_web_url", "sp_name", "sp_mime", "sp_size",
        ]
        read_only_fields = ["id", "course", "section", "order"]


class CreatorVideoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseVideo
        fields = [
            "id",
            "content_type",
            "video_title",
            "embed_url",
            "guide_title",
            "guide_url",
        ]
        read_only_fields = ["id"]


# ============================================================
# ✅ NEW: Creator quiz serializers (include is_correct)
# ============================================================

class CreatorQuizChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizChoice
        fields = ["id", "text", "is_correct"]


class CreatorQuizQuestionSerializer(serializers.ModelSerializer):
    choices = CreatorQuizChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = QuizQuestion
        fields = ["id", "order", "prompt", "choices"]


class CreatorCourseQuizSerializer(serializers.ModelSerializer):
    questions = CreatorQuizQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CourseQuiz
        fields = ["id", "title", "is_published", "questions"]


# ============================================================
# ✅ NEW: Notes serializer
# ============================================================

class CourseVideoNoteSerializer(serializers.ModelSerializer):
    video_id = serializers.IntegerField(source="video.id", read_only=True)

    class Meta:
        model = CourseVideoNote
        fields = ["video_id", "text", "created_at", "updated_at"]
