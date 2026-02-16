from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import MonthlyActiveUsers, UserMonthlyLogin

User = get_user_model()


@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "role",
        "suggested_role",
        "can_create_courses",
        "is_staff",
        "is_superuser",
    )
    search_fields = ("email", "first_name", "last_name", "azure_oid")
    list_filter = ("role", "suggested_role", "can_create_courses", "is_staff", "is_superuser")

    # These should be auto-filled by login/Graph, not manually edited
    readonly_fields = ("azure_oid", "azure_tid", "suggested_role", "suggested_role_reason")


@admin.register(MonthlyActiveUsers)
class MonthlyActiveUsersAdmin(admin.ModelAdmin):
    list_display = ("year", "month", "active_users")
    ordering = ("-year", "-month")
    list_filter = ("year", "month")


@admin.register(UserMonthlyLogin)
class UserMonthlyLoginAdmin(admin.ModelAdmin):
    list_display = ("user", "year", "month", "first_login_at")
    ordering = ("-first_login_at",)
    list_filter = ("year", "month")
    search_fields = ("user__email",)
