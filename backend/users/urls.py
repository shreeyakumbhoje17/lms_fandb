from django.urls import path
from .views import microsoft_login, navigation, my_learning, me

urlpatterns = [
    path("auth/microsoft/", microsoft_login, name="microsoft_login"),
    path("me/", me, name="me"),
    path("navigation/", navigation, name="navigation"),
    path("my-learning/", my_learning, name="my_learning"),
]
