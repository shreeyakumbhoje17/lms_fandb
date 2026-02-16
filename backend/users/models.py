from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ("office", "Office Staff"),
        ("field", "Field Engineer"),
    )

    # ✅ Canonical login identity (always stored lowercase; unique for USERNAME_FIELD)
    email = models.EmailField(unique=True)

    # ✅ Preserve original casing for UI / display (not used for auth)
    email_display = models.EmailField(blank=True, default="")

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, blank=True, null=True)

    azure_oid = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    azure_tid = models.CharField(max_length=64, blank=True, null=True, db_index=True)

    suggested_role = models.CharField(max_length=10, choices=ROLE_CHOICES, blank=True, null=True)
    suggested_role_reason = models.CharField(max_length=255, blank=True, null=True)

    licenses = models.TextField(blank=True, null=True)

    # creator permission (separate from office/field role)
    can_create_courses = models.BooleanField(default=False, db_index=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def save(self, *args, **kwargs):
        # Keep canonical email lowercase (prevents duplicates caused by casing differences)
        if self.email:
            raw = str(self.email).strip()
            if raw:
                # if email_display is empty, capture what we currently have as display
                if not (self.email_display or "").strip():
                    self.email_display = raw
                self.email = raw.lower()

        # ensure email_display exists for older rows
        if self.email and not (self.email_display or "").strip():
            self.email_display = self.email

        super().save(*args, **kwargs)

    def __str__(self):
        return self.email_display or self.email


class UserMonthlyLogin(models.Model):
    """
    Dedupe table: one row per (user, year, month) for first login in that month.
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="monthly_logins")
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveIntegerField(db_index=True)
    first_login_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "year", "month"], name="uniq_user_month_login")
        ]

    def __str__(self):
        return f"{self.user.email} {self.year}-{self.month:02d}"


class MonthlyActiveUsers(models.Model):
    """
    Aggregated MAU count per month.
    """
    year = models.PositiveIntegerField(db_index=True)
    month = models.PositiveIntegerField(db_index=True)
    active_users = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["year", "month"], name="uniq_mau_year_month")
        ]

    def __str__(self):
        return f"MAU {self.year}-{self.month:02d}: {self.active_users}"
