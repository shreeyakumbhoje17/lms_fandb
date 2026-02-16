from django.urls import path
from . import views

urlpatterns = [
    # -----------------------------
    # Learner APIs
    # -----------------------------
    path("courses/", views.course_list),
    path("courses/<int:course_id>/", views.course_detail),
    path("courses/search/", views.course_search),
    path("my-learning/", views.my_learning),
    path("courses/<int:course_id>/progress/", views.update_progress),

    path("courses/<int:course_id>/quiz/status/", views.quiz_status),
    path("courses/<int:course_id>/quiz/", views.quiz_get),
    path("courses/<int:course_id>/quiz/submit/", views.quiz_submit),

    path("search/", views.course_search),
    path("search/suggestions/", views.search_suggestions),

    # -----------------------------
    # ✅ NEW: Learner Notes API (per-user, per-video)
    # -----------------------------
    path("videos/<int:video_id>/notes/", views.video_notes_get_set),

    # -----------------------------
    # Creator APIs
    # -----------------------------
    path("creator/courses/", views.creator_course_list_create),
    path("creator/courses/<int:course_id>/", views.creator_course_detail_update_delete),
    path("creator/courses/<int:course_id>/publish/", views.creator_course_publish),

    path("creator/courses/<int:course_id>/sections/", views.creator_section_create),
    path("creator/courses/<int:course_id>/sections/reorder/", views.creator_sections_reorder),
    path("creator/sections/<int:section_id>/", views.creator_section_update_delete),

    path("creator/sections/<int:section_id>/videos/", views.creator_video_create),
    path("creator/sections/<int:section_id>/videos/reorder/", views.creator_videos_reorder),
    path("creator/videos/<int:video_id>/", views.creator_video_update_delete),

    # -----------------------------
    # ✅ Uploads
    # -----------------------------
    path("creator/sections/<int:section_id>/videos/upload/", views.creator_video_upload),

    # ✅ NEW: course thumbnail upload (SharePoint)
    path(
        "creator/courses/<int:course_id>/thumbnail/upload/",
        views.creator_course_thumbnail_upload,
    ),

    # -----------------------------
    # Video streaming
    # -----------------------------
    path("videos/<int:video_id>/playback-url/", views.video_playback_url),
    path("videos/<int:video_id>/stream/", views.video_stream, name="video_stream"),

    # ============================================================
    # ✅ NEW: Creator quiz builder APIs (trainer-only)
    # ============================================================
    path("creator/courses/<int:course_id>/quiz/", views.creator_quiz_get_create_update_delete),

    path("creator/quizzes/<int:quiz_id>/questions/", views.creator_question_create),
    path("creator/questions/<int:question_id>/", views.creator_question_update_delete),

    path("creator/questions/<int:question_id>/choices/", views.creator_choice_create),
    path("creator/choices/<int:choice_id>/", views.creator_choice_update_delete),
]
