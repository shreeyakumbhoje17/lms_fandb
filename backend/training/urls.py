# training/urls.py
from django.urls import path
from .views_trainer import trainer_status

urlpatterns = [
    path("trainer-status/", trainer_status),
]
