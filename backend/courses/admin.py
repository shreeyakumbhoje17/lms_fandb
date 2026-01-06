from django.contrib import admin
from .models import Course, CourseVideo

class CourseVideoInline(admin.TabularInline):
    model = CourseVideo
    extra = 1
    ordering = ["order"]

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["title", "track", "category", "is_published"]
    inlines = [CourseVideoInline]

@admin.register(CourseVideo)
class CourseVideoAdmin(admin.ModelAdmin):
    list_display = ["video_title", "course", "order"]
    ordering = ["order"]
