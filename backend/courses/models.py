# courses/models.py
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from urllib.parse import urlparse


def validate_company_sharepoint_embed(url: str):
    """
    ✅ Validates that a URL is a company SharePoint URL suitable for embedding.
    - Allows only domains in settings.ALLOWED_EMBED_DOMAINS
    - Blocks personal OneDrive (/personal/)
    - Blocks common anonymous/guest patterns
    """
    u = (url or "").strip()
    if not u:
        return

    parsed = urlparse(u)
    host = (parsed.netloc or "").lower()

    allowed = set(getattr(settings, "ALLOWED_EMBED_DOMAINS", []) or [])
    if allowed and host not in allowed:
        raise ValidationError("Only company SharePoint links are allowed for videos.")

    lower = u.lower()

    # Block personal OneDrive locations
    if "/personal/" in lower:
        raise ValidationError(
            "Personal OneDrive links are not allowed. Please use the company SharePoint site."
        )

    # Block common anonymous/guest link patterns (keeps content internal)
    if "guestaccess.aspx" in lower or "anonymous" in lower:
        raise ValidationError(
            "Anonymous/guest SharePoint links are not allowed. Use an internal SharePoint link."
        )


class Course(models.Model):
    TRACK_CHOICES = [
        ("office", "Office Track"),
        ("field", "Field Track"),
    ]

    CATEGORY_CHOICES = [
        ("office", "Office"),
        ("field", "Field Engineers"),
        ("trades", "Trades"),
    ]

    SUBCATEGORY_CHOICES = [
        ("essentials", "Essentials"),
        ("applications", "Applications"),
        ("customers", "Customers"),
        ("building_fabric", "Building Fabric"),
        ("drainage_and_plumbing", "Drainage and Plumbing"),
        ("gas_and_electrical", "Gas and Electrical"),
        ("fire_safety", "Fire Safety"),
        ("environmental_services", "Environmental Services"),
        ("aspect_principles", "Aspect Principles"),
    ]

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    track = models.CharField(max_length=20, choices=TRACK_CHOICES, db_index=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, db_index=True)
    subcategory = models.CharField(max_length=50, choices=SUBCATEGORY_CHOICES, db_index=True)

    is_published = models.BooleanField(default=True, db_index=True)

    # Frontend uses this to render a thumbnail.
    # ✅ Recommended: set this to a Django endpoint like /api/courses/<id>/thumbnail/
    thumbnail_url = models.CharField(max_length=500, blank=True, default="")

    # ✅ NEW: fixed storage folder name created once (do not auto-rename on title change)
    storage_folder_name = models.CharField(max_length=255, blank=True, default="", db_index=True)

    # -----------------------------
    # ✅ NEW: SharePoint thumbnail file references (for uploads)
    # -----------------------------
    thumb_sp_drive_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    thumb_sp_item_id = models.CharField(max_length=256, blank=True, default="", db_index=True)
    thumb_sp_web_url = models.URLField(max_length=2000, blank=True, default="")
    thumb_sp_name = models.CharField(max_length=512, blank=True, default="")
    thumb_sp_mime = models.CharField(max_length=255, blank=True, default="")
    thumb_sp_size = models.BigIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_courses",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="published", db_index=True)

    def __str__(self):
        return self.title


class CourseSection(models.Model):
    course = models.ForeignKey(Course, related_name="sections", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["course", "order"],
                name="unique_section_order_per_course",
            ),
        ]

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class CourseVideo(models.Model):
    """
    Represents a COURSE CONTENT ITEM.
    Can be a video, article, file, or external link.
    """

    CONTENT_TYPE_CHOICES = [
        ("video", "Video"),
        ("article", "Article / Page"),
        ("file", "File / Document"),
        ("link", "External Link"),
    ]

    course = models.ForeignKey(Course, related_name="videos", on_delete=models.CASCADE)
    section = models.ForeignKey(CourseSection, related_name="videos", on_delete=models.CASCADE)

    content_type = models.CharField(
        max_length=20,
        choices=CONTENT_TYPE_CHOICES,
        default="video",
        db_index=True,
    )

    video_title = models.CharField(max_length=255)
    embed_url = models.URLField(max_length=2000, blank=True, default="")

    guide_title = models.CharField(max_length=255, blank=True, default="Open resource")
    guide_url = models.URLField(max_length=2000, blank=True, default="")

    order = models.PositiveIntegerField()

    # -----------------------------
    # ✅ SharePoint file references (for uploads)
    # -----------------------------
    sp_drive_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    sp_item_id = models.CharField(max_length=256, blank=True, default="", db_index=True)
    sp_web_url = models.URLField(max_length=2000, blank=True, default="")
    sp_name = models.CharField(max_length=512, blank=True, default="")
    sp_mime = models.CharField(max_length=255, blank=True, default="")
    sp_size = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "order"],
                name="unique_video_order_per_section",
            ),
        ]

    def clean(self):
        if self.course_id and self.section_id:
            if self.section.course_id != self.course_id:
                raise ValidationError(
                    {"section": "Selected section does not belong to the selected course."}
                )

        # ✅ For video items, allow EITHER:
        #   - embed_url (existing behavior)
        #   - OR SharePoint upload references (new behavior)
        if self.content_type == "video":
            has_embed = bool((self.embed_url or "").strip())
            has_sp = bool((self.sp_drive_id or "").strip() and (self.sp_item_id or "").strip())

            if not has_embed and not has_sp:
                raise ValidationError(
                    {"embed_url": "Video content requires an embed URL OR an uploaded SharePoint file."}
                )

            # Only validate SharePoint embed URL if embed_url is used
            if has_embed:
                validate_company_sharepoint_embed(self.embed_url)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.video_title} ({self.course.title})"


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

    attempted_times = models.PositiveIntegerField(default=0)
    completed_times = models.PositiveIntegerField(default=0)
    is_completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "course"],
                name="unique_progress_per_user_course",
            ),
        ]

    def __str__(self):
        return f"{getattr(self.user, 'email', self.user_id)} - {self.course.title}"


class CourseVideoOpened(models.Model):
    """
    One row per (user, content item).
    Used for:
      - unique viewers count
      - quiz unlock (open required content)
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="opened_videos",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="opened_events",
    )
    video = models.ForeignKey(
        CourseVideo,
        on_delete=models.CASCADE,
        related_name="opened_by",
    )
    first_opened_at = models.DateTimeField(auto_now_add=True)
    last_opened_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "video"],
                name="unique_open_per_user_video",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "course"]),
            models.Index(fields=["course", "video"]),
        ]

    def __str__(self):
        return f"{getattr(self.user, 'email', self.user_id)} opened {self.video.video_title}"


class CourseQuiz(models.Model):
    course = models.OneToOneField(
        Course,
        on_delete=models.CASCADE,
        related_name="quiz",
    )
    title = models.CharField(max_length=255, default="Course Quiz")
    is_published = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return f"Quiz: {self.course.title}"


class QuizQuestion(models.Model):
    quiz = models.ForeignKey(
        CourseQuiz,
        on_delete=models.CASCADE,
        related_name="questions",
    )
    prompt = models.TextField()
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["quiz", "order"],
                name="unique_question_order_per_quiz",
            ),
        ]

    def __str__(self):
        return f"Q{self.order}: {self.prompt[:40]}"


class QuizChoice(models.Model):
    question = models.ForeignKey(
        QuizQuestion,
        on_delete=models.CASCADE,
        related_name="choices",
    )
    text = models.CharField(max_length=600)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text


class QuizSubmission(models.Model):
    """
    One submission per user per quiz attempt.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_submissions",
    )
    quiz = models.ForeignKey(
        CourseQuiz,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    score = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    all_correct = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["user", "quiz"]),
        ]

    def __str__(self):
        return (
            f"{getattr(self.user, 'email', self.user_id)} "
            f"submission for {self.quiz.course.title} ({self.score}/{self.total})"
        )


class QuizAnswer(models.Model):
    submission = models.ForeignKey(
        QuizSubmission,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(QuizChoice, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["submission", "question"],
                name="unique_answer_per_submission_question",
            ),
        ]

    def __str__(self):
        return f"Answer: {self.question_id} -> {self.selected_choice_id}"


# ============================================================
# ✅ NEW: Per-user, per-video notes (saved + loaded)
# ============================================================

class CourseVideoNote(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="course_video_notes",
        db_index=True,
    )
    video = models.ForeignKey(
        CourseVideo,
        on_delete=models.CASCADE,
        related_name="notes",
        db_index=True,
    )
    text = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "video"], name="unique_note_per_user_video"),
        ]
        indexes = [
            models.Index(fields=["user", "video"]),
        ]

    def __str__(self):
        return f"Note: {getattr(self.user, 'email', self.user_id)} - video {self.video_id}"
