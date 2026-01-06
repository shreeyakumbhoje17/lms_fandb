from django.conf import settings
from django.db import models


class Course(models.Model):
    TRACK_CHOICES = [
        ("office", "Office Track"),
        ("field", "Field Track"),
    ]

    CATEGORY_CHOICES = [
        ("essentials", "Essentials"),
        ("applications", "Applications"),
        ("customer_journey", "Customer Journey"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    track = models.CharField(max_length=20, choices=TRACK_CHOICES, db_index=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)

    # ✅ for dashboard card thumbnail (example: "/fslapp.jpg")
    thumbnail_url = models.CharField(max_length=500, blank=True, default="")

    def __str__(self):
        return self.title


class CourseVideo(models.Model):
    course = models.ForeignKey(Course, related_name="videos", on_delete=models.CASCADE)
    video_title = models.CharField(max_length=255)
    embed_url = models.URLField(max_length=2000)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["course", "order"], name="unique_video_order_per_course"),
        ]

    def __str__(self):
        return f"{self.video_title} ({self.course.title})"


# ✅ NEW: store per-user progress so you can resume + show last course first
class CourseProgress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_progress",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="progress_records",
    )
    last_video = models.ForeignKey(
        CourseVideo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    last_video_index = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_progress_per_user_course"),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.course.title}"
