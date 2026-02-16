from django.contrib import admin
from django import forms

from .models import (
    Course, CourseSection, CourseVideo, CourseProgress, CourseVideoOpened,
    CourseQuiz, QuizQuestion, QuizChoice, QuizSubmission, QuizAnswer
)


class CourseSectionInline(admin.TabularInline):
    model = CourseSection
    extra = 1
    ordering = ["order"]


class CourseVideoInlineForm(forms.ModelForm):
    class Meta:
        model = CourseVideo
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        course_obj = kwargs.pop("course_obj", None)
        super().__init__(*args, **kwargs)
        if course_obj is not None:
            self.fields["section"].queryset = CourseSection.objects.filter(course=course_obj)


class CourseVideoInline(admin.TabularInline):
    model = CourseVideo
    form = CourseVideoInlineForm
    extra = 1
    ordering = ["section", "order"]

    def get_formset(self, request, obj=None, **kwargs):
        FormSet = super().get_formset(request, obj, **kwargs)
        course_obj = obj

        class FilteredFormSet(FormSet):
            def _construct_form(self, i, **form_kwargs):
                form_kwargs["course_obj"] = course_obj
                return super()._construct_form(i, **form_kwargs)

        return FilteredFormSet


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["title", "track", "category", "subcategory", "is_published"]
    list_filter = ["track", "category", "subcategory", "is_published"]
    search_fields = ["title", "description"]
    inlines = [CourseSectionInline, CourseVideoInline]


@admin.register(CourseSection)
class CourseSectionAdmin(admin.ModelAdmin):
    list_display = ["title", "course", "order"]
    ordering = ["course", "order"]


@admin.register(CourseVideo)
class CourseVideoAdmin(admin.ModelAdmin):
    # ✅ Added content_type to make it obvious in admin
    list_display = ["video_title", "content_type", "course", "section", "order", "guide_url"]
    ordering = ["course", "section", "order"]


@admin.register(CourseProgress)
class CourseProgressAdmin(admin.ModelAdmin):
    list_display = [
        "user", "course", "last_video", "last_video_index", "last_accessed",
        "is_completed", "completed_times", "completed_at"
    ]
    ordering = ["-last_accessed"]
    list_select_related = ["user", "course", "last_video"]
    search_fields = ["user__email", "course__title", "last_video__video_title"]
    list_filter = ["course", "is_completed"]


@admin.register(CourseVideoOpened)
class CourseVideoOpenedAdmin(admin.ModelAdmin):
    list_display = ["user", "course", "video", "first_opened_at", "last_opened_at"]
    ordering = ["-last_opened_at"]
    list_select_related = ["user", "course", "video"]
    search_fields = ["user__email", "course__title", "video__video_title"]
    list_filter = ["course"]


# -------- QUIZ ADMIN --------

class QuizChoiceInline(admin.TabularInline):
    model = QuizChoice
    extra = 2


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ["quiz", "order", "prompt"]
    ordering = ["quiz", "order"]
    inlines = [QuizChoiceInline]


@admin.register(CourseQuiz)
class CourseQuizAdmin(admin.ModelAdmin):
    list_display = ["course", "title", "is_published"]
    list_filter = ["is_published"]
    search_fields = ["course__title", "title"]


@admin.register(QuizSubmission)
class QuizSubmissionAdmin(admin.ModelAdmin):
    list_display = ["user", "quiz", "score", "total", "all_correct", "submitted_at"]
    ordering = ["-submitted_at"]
    list_select_related = ["user", "quiz", "quiz__course"]
    search_fields = ["user__email", "quiz__course__title"]
    list_filter = ["all_correct", "quiz"]


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ["submission", "question", "selected_choice"]
    list_select_related = ["submission", "question", "selected_choice"]
