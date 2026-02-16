from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView

def home(request):
    return JsonResponse({"status": "ok", "service": "backend"})

urlpatterns = [
    path("admin/", admin.site.urls),

    # API modules
    path("api/", include("users.urls")),
    path("api/", include("courses.urls")),
    path("api/", include("training.urls")),  # ✅ ADD THIS

    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # homepage
    path("", home),
]
