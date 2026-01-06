from rest_framework import serializers
from .models import Course, CourseVideo


class CourseVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseVideo
        fields = ["order", "video_title", "embed_url"]


class CourseDetailSerializer(serializers.ModelSerializer):
    videos = CourseVideoSerializer(many=True, read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    def get_thumbnail_url(self, obj):
        url = obj.thumbnail_url or ""
        if not url:
            return ""
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "description",
            "track",
            "category",
            "thumbnail_url",
            "videos",
        ]


class CourseListSerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()

    def get_thumbnail_url(self, obj):
        url = obj.thumbnail_url or ""
        if not url:
            return ""
        if url.startswith("http://") or url.startswith("https://"):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "description",
            "track",
            "category",
            "thumbnail_url",
            "is_published",
        ]
