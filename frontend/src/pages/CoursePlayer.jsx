// CoursePlayer.jsx
import "../styles/courseplayer.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api";

function flattenVideos(sections) {
  const flat = [];
  const secs = Array.isArray(sections) ? sections : [];
  const sortedSecs = secs.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const sec of sortedSecs) {
    const vids = Array.isArray(sec.videos) ? sec.videos : [];
    const sortedVids = vids.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const v of sortedVids) {
      flat.push({ ...v, __sectionId: sec.id, __sectionTitle: sec.title });
    }
  }
  return flat;
}

function findVideoInSections(sections, videoId) {
  const id = Number(videoId);
  for (const sec of sections || []) {
    for (const v of sec?.videos || []) {
      if (Number(v?.id) === id) return { video: v, section: sec };
    }
  }
  return null;
}

function firstVideoFromSections(sections) {
  for (const sec of sections || []) {
    if (sec?.videos?.length) return { video: sec.videos[0], section: sec };
  }
  return null;
}

export default function CoursePlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeVideoId = searchParams.get("v");

  const DASHBOARD_PATH = "/dashboard";

  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");

  const [activeVideo, setActiveVideo] = useState(null);
  const [activeTitleOnly, setActiveTitleOnly] = useState(null);
  const [tab, setTab] = useState("overview");
  const [openSections, setOpenSections] = useState({});

  // ✅ Me (used to show trainer edit/delete buttons)
  const [me, setMe] = useState(null);
  const canEdit = !!me?.can_upload; // group-based trainer capability

  // ✅ Course delete state
  const [deleting, setDeleting] = useState(false);

  // ✅ Notes (BACKEND-SAVED per user+video)
  const [notes, setNotes] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesErr, setNotesErr] = useState("");
  const [notesSavedHint, setNotesSavedHint] = useState("");

  // ✅ NEW: Overview editing (trainer only)
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState("");
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [overviewErr, setOverviewErr] = useState("");

  // ✅ Quiz UI state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizStatus, setQuizStatus] = useState(null);

  // ✅ quiz data + answers + submit state
  const [quizData, setQuizData] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // ✅ forward-only quiz navigation
  const [quizStep, setQuizStep] = useState(0);

  // ✅ Gate: only show "Start Quiz" label after last video progress POST succeeded
  const [lastVideoProgressPushed, setLastVideoProgressPushed] = useState(false);

  // ✅ Status line shown under the buttons
  const [quizHint, setQuizHint] = useState("");

  // ✅ Track resource clicks for article-only gating (and mixed courses)
  const [openedResourceIds, setOpenedResourceIds] = useState({});

  const sections = useMemo(() => {
    if (!course?.sections) return [];
    return [...course.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [course]);

  const flatVideos = useMemo(() => flattenVideos(sections), [sections]);

  const isLastVideo = useMemo(() => {
    if (!activeVideo?.id || !flatVideos.length) return false;
    const idx = flatVideos.findIndex((v) => Number(v.id) === Number(activeVideo.id));
    return idx === flatVideos.length - 1;
  }, [activeVideo?.id, flatVideos]);

  const hasAnyItems = useMemo(() => {
    return (flatVideos?.length || 0) > 0;
  }, [flatVideos]);

  const isArticleOnlyItem = useMemo(() => {
    if (!activeVideo) return false;
    const hasEmbed = !!(activeVideo.embed_url && String(activeVideo.embed_url).trim());
    const hasGuide = !!(activeVideo.guide_url && String(activeVideo.guide_url).trim());
    return !hasEmbed && hasGuide;
  }, [activeVideo]);

  const isVideoItem = useMemo(() => {
    if (!activeVideo) return false;
    const hasEmbed = !!(activeVideo.embed_url && String(activeVideo.embed_url).trim());
    return hasEmbed;
  }, [activeVideo]);

  const allResourcesOpened = useMemo(() => {
    if (!flatVideos.length) return false;
    for (const v of flatVideos) {
      const hasEmbed = !!(v?.embed_url && String(v.embed_url).trim());
      const hasGuide = !!(v?.guide_url && String(v.guide_url).trim());

      if (!hasEmbed && hasGuide) {
        if (!openedResourceIds[Number(v.id)]) return false;
      }
    }
    return true;
  }, [flatVideos, openedResourceIds]);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ✅ Keep URL clean (optional): strip ?v=
  useEffect(() => {
    try {
      window.history.replaceState(null, "", `/course/${courseId}`);
    } catch {
      // ignore
    }
  }, [courseId]);

  function resetQuizUI() {
    setQuizOpen(false);
    setQuizError("");
    setQuizStatus(null);
    setQuizData(null);
    setQuizAnswers({});
    setQuizLoading(false);
    setQuizSubmitting(false);
    setQuizResult(null);
    setQuizStep(0);
  }

  function resetQuizAttemptOnly() {
    setQuizError("");
    setQuizResult(null);
    setQuizAnswers({});
    setQuizSubmitting(false);
    setQuizStep(0);
  }

  // ✅ Back button should go directly to dashboard
  function handlePlayerBack() {
    navigate(DASHBOARD_PATH);
  }

  // ✅ Edit
  function handleEditCourse() {
    navigate(`/creator/courses/${courseId}`);
  }

  // ✅ Delete
  async function handleDeleteCourse() {
    if (deleting) return;

    const ok = window.confirm(
      "Delete this course?\n\nThis will remove the course from the LMS. (SharePoint cleanup depends on backend.)"
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        alert(t || `Delete failed (${res.status})`);
        setDeleting(false);
        return;
      }
      navigate(DASHBOARD_PATH);
    } catch (e) {
      alert(String(e));
      setDeleting(false);
    }
  }

  async function fetchMe() {
    try {
      const res = await apiFetch("/api/me/");
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data) setMe(data);
    } catch {
      // ignore
    }
  }

  async function fetchQuizStatusOnly() {
    try {
      const res = await apiFetch(`/api/courses/${courseId}/quiz/status/`);
      const data = await res.json().catch(() => null);
      if (!res.ok) return null;
      setQuizStatus(data);
      return data;
    } catch {
      return null;
    }
  }

  const sortedQuestions = useMemo(() => {
    const qs = quizData?.questions ? [...quizData.questions] : [];
    return qs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [quizData]);

  const currentQuestion = useMemo(() => {
    if (!sortedQuestions.length) return null;
    const i = Math.max(0, Math.min(quizStep, sortedQuestions.length - 1));
    return sortedQuestions[i];
  }, [sortedQuestions, quizStep]);

  const isLastQuestion = useMemo(() => {
    if (!sortedQuestions.length) return true;
    return quizStep >= sortedQuestions.length - 1;
  }, [sortedQuestions.length, quizStep]);

  async function pushProgressForItem(videoObj, video_index, isLastIdx) {
    try {
      const res = await apiFetch(`/api/courses/${courseId}/progress/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoObj.id,
          video_index: video_index,
        }),
      });

      if (res && res.ok && isLastIdx) {
        setLastVideoProgressPushed(true);
        fetchQuizStatusOnly();
      }
    } catch {
      // silent fail
    }
  }

  async function handleResourceClick(e, vObj) {
    if (e) e.stopPropagation();
    if (!vObj?.id) return;

    const idx = flatVideos.findIndex((x) => Number(x.id) === Number(vObj.id));
    const isLastIdx = idx >= 0 && idx === flatVideos.length - 1;

    setOpenedResourceIds((prev) => ({ ...prev, [Number(vObj.id)]: true }));

    const hasEmbed = !!(vObj?.embed_url && String(vObj.embed_url).trim());
    const hasGuide = !!(vObj?.guide_url && String(vObj.guide_url).trim());

    if (!hasEmbed && hasGuide) {
      setLastVideoProgressPushed(false);

      await pushProgressForItem(vObj, idx >= 0 ? idx : 0, isLastIdx);

      const nextOpened = { ...openedResourceIds, [Number(vObj.id)]: true };
      let okAll = true;
      for (const it of flatVideos) {
        const itHasEmbed = !!(it?.embed_url && String(it.embed_url).trim());
        const itHasGuide = !!(it?.guide_url && String(it.guide_url).trim());
        if (!itHasEmbed && itHasGuide) {
          if (!nextOpened[Number(it.id)]) {
            okAll = false;
            break;
          }
        }
      }

      if (okAll && isLastIdx) {
        setLastVideoProgressPushed(true);
        fetchQuizStatusOnly();
      }
    }
  }

  // ✅ NEW: Save Overview (trainer only)
  async function saveOverview() {
    if (!canEdit) return;

    setOverviewErr("");
    setOverviewSaving(true);
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: String(overviewDraft ?? "") }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.detail || `Failed to save overview (${res.status})`;
        setOverviewErr(msg);
        setOverviewSaving(false);
        return;
      }

      // Update local course state so all viewers see it
      if (data && typeof data.description === "string") {
        setCourse((prev) => (prev ? { ...prev, description: data.description } : prev));
        setOverviewDraft(data.description);
      } else {
        setCourse((prev) => (prev ? { ...prev, description: String(overviewDraft ?? "") } : prev));
      }

      setOverviewEditing(false);
      setOverviewSaving(false);
    } catch (e) {
      setOverviewErr(String(e));
      setOverviewSaving(false);
    }
  }

  // ✅ Take Quiz
  async function handleTakeQuiz() {
    setQuizError("");
    setQuizData(null);
    setQuizAnswers({});
    setQuizResult(null);
    setQuizStep(0);

    try {
      setQuizLoading(true);

      const res = await apiFetch(`/api/courses/${courseId}/quiz/status/`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.detail || `Failed to check quiz status (${res.status})`;
        setQuizError(msg);
        setQuizHint(msg);
        setQuizLoading(false);
        return;
      }

      setQuizStatus(data);

      if (!data?.has_quiz) {
        const msg = "Quiz not set for this guide yet (admin has not added questions).";
        setQuizError(msg);
        setQuizHint(msg);
        setQuizLoading(false);
        return;
      }

      if (!isLastVideo || !lastVideoProgressPushed) {
        const ov = data?.opened_videos ?? 0;
        const tv = data?.total_videos ?? 0;

        let msg = `Quiz locked: open all modules first (${ov}/${tv}).`;

        if (hasAnyItems) {
          const anyArticle = flatVideos.some((v) => {
            const hasEmbed = !!(v?.embed_url && String(v.embed_url).trim());
            const hasGuide = !!(v?.guide_url && String(v.guide_url).trim());
            return !hasEmbed && hasGuide;
          });

          if (anyArticle && !allResourcesOpened) {
            msg = "Quiz locked: open all resources first (click each 📄 Resources button).";
          } else if (anyArticle && allResourcesOpened && !isLastVideo) {
            msg = "Quiz locked: open the last module/resource to start the quiz.";
          }
        }

        setQuizError(msg);
        setQuizHint(msg);
        setQuizLoading(false);
        return;
      }

      if (!data?.quiz_unlocked) {
        const ov = data?.opened_videos ?? 0;
        const tv = data?.total_videos ?? 0;
        const msg = `Quiz locked: open all modules first (${ov}/${tv}).`;
        setQuizError(msg);
        setQuizHint(msg);
        setQuizLoading(false);
        return;
      }

      const qRes = await apiFetch(`/api/courses/${courseId}/quiz/`);
      const qData = await qRes.json().catch(() => null);

      if (!qRes.ok) {
        const msg = qData?.detail || `Failed to load quiz (${qRes.status})`;
        setQuizError(msg);
        setQuizHint(msg);
        setQuizLoading(false);
        return;
      }

      setQuizData(qData);
      setQuizOpen(true);
      setQuizHint("");
      setQuizLoading(false);
    } catch (e) {
      const msg = String(e);
      setQuizError(msg);
      setQuizHint(msg);
      setQuizLoading(false);
    }
  }

  function chooseAnswer(questionId, choiceId) {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  }

  function goNextQuestion() {
    setQuizError("");
    if (!currentQuestion?.id) return;

    if (!quizAnswers[currentQuestion.id]) {
      setQuizError("Please choose an answer to continue.");
      return;
    }

    setQuizStep((s) => Math.min(s + 1, Math.max(0, sortedQuestions.length - 1)));
  }

  async function submitQuiz() {
    setQuizError("");
    setQuizResult(null);

    if (!sortedQuestions.length) {
      setQuizError("Quiz has no questions yet. Please ask admin to add questions.");
      return;
    }

    const missing = sortedQuestions.find((q) => !quizAnswers[q.id]);
    if (missing) {
      setQuizError("Please answer all questions before submitting.");
      return;
    }

    try {
      setQuizSubmitting(true);

      const payload = {
        answers: sortedQuestions.map((q) => ({
          question_id: q.id,
          choice_id: quizAnswers[q.id],
        })),
      };

      const res = await apiFetch(`/api/courses/${courseId}/quiz/submit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setQuizError(data?.detail || `Quiz submit failed (${res.status})`);
        setQuizSubmitting(false);
        return;
      }

      setQuizResult(data);
      setQuizSubmitting(false);

      fetchQuizStatusOnly();
    } catch (e) {
      setQuizError(String(e));
      setQuizSubmitting(false);
    }
  }

  // ============================================================
  // ✅ NOTES: load/save per-video via backend
  // ============================================================

  const notesSaveTimerRef = useRef(null);
  const lastLoadedVideoIdRef = useRef(null);

  async function loadNotesForVideo(videoObj) {
    if (!videoObj?.id) {
      setNotes("");
      setNotesErr("");
      setNotesSavedHint("");
      return;
    }

    setNotesErr("");
    setNotesSavedHint("");
    setNotesLoading(true);
    try {
      const res = await apiFetch(`/api/videos/${videoObj.id}/notes/`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.detail || `Failed to load notes (${res.status})`;
        setNotesErr(msg);
        setNotes("");
        return;
      }

      setNotes(String(data?.text ?? ""));
      lastLoadedVideoIdRef.current = Number(videoObj.id);
    } catch (e) {
      setNotesErr(String(e));
      setNotes("");
    } finally {
      setNotesLoading(false);
    }
  }

  async function saveNotesForVideo(videoObj, textToSave) {
    if (!videoObj?.id) return;

    setNotesErr("");
    setNotesSaving(true);
    try {
      const res = await apiFetch(`/api/videos/${videoObj.id}/notes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(textToSave ?? "") }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.detail || `Failed to save notes (${res.status})`;
        setNotesErr(msg);
        return;
      }

      // show subtle saved hint
      setNotesSavedHint("Saved");
      window.setTimeout(() => setNotesSavedHint(""), 1200);

      // keep in sync if backend normalized text
      if (data && typeof data.text === "string") setNotes(data.text);
    } catch (e) {
      setNotesErr(String(e));
    } finally {
      setNotesSaving(false);
    }
  }

  function scheduleAutosave(videoObj, nextText) {
    if (notesSaveTimerRef.current) window.clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = window.setTimeout(() => {
      saveNotesForVideo(videoObj, nextText);
    }, 700);
  }

  // load notes when active video changes
  useEffect(() => {
    // clear any pending autosave when switching videos
    if (notesSaveTimerRef.current) window.clearTimeout(notesSaveTimerRef.current);

    // load per active video
    loadNotesForVideo(activeVideo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.id]);

  // ============================================================

  const didInitRef = useRef(false);

  useEffect(() => {
    // fetch can_upload once when opening player
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadCourse() {
      try {
        setError("");
        setCourse(null);

        const res = await apiFetch(`/api/courses/${courseId}/`);
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Failed to load course (${res.status})`);
          return;
        }

        const data = await res.json();
        setCourse(data);

        // ✅ NEW: keep overview draft synced with course description
        setOverviewDraft(String(data?.description ?? ""));
        setOverviewEditing(false);
        setOverviewErr("");
        setOverviewSaving(false);

        const secs = Array.isArray(data.sections) ? data.sections : [];

        let picked = null;
        if (resumeVideoId) {
          picked = findVideoInSections(secs, resumeVideoId);
        }
        if (!picked) picked = firstVideoFromSections(secs);

        if (picked?.video) {
          setActiveVideo(picked.video);
          setActiveTitleOnly(null);

          const secKey = picked.section?.id ?? picked.section?.title ?? "first";
          setOpenSections({ [secKey]: true });
        } else {
          setActiveVideo(null);
          setActiveTitleOnly(secs[0]?.title ?? null);
          if (secs[0]) {
            const secKey = secs[0].id ?? secs[0].title;
            setOpenSections({ [secKey]: true });
          }
        }

        setTab("overview");
        resetQuizUI();

        setQuizHint("");
        setLastVideoProgressPushed(false);
        setOpenedResourceIds({});

        await fetchQuizStatusOnly();
      } catch (e) {
        setError(String(e));
      }
    }

    loadCourse();
    if (!didInitRef.current) didInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, resumeVideoId]);

  // Push progress on activeVideo change (VIDEOS ONLY)
  useEffect(() => {
    async function pushProgress() {
      if (!activeVideo?.id) return;

      const hasEmbed = !!(activeVideo?.embed_url && String(activeVideo.embed_url).trim());
      if (!hasEmbed) return;

      const idx = flatVideos.findIndex((v) => Number(v.id) === Number(activeVideo.id));
      const video_index = idx >= 0 ? idx : 0;

      setLastVideoProgressPushed(false);

      try {
        const res = await apiFetch(`/api/courses/${courseId}/progress/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: activeVideo.id,
            video_index: video_index,
          }),
        });

        if (res && res.ok && idx === flatVideos.length - 1) {
          setLastVideoProgressPushed(true);
          fetchQuizStatusOnly();
        }
      } catch {
        // silent fail
      }
    }

    pushProgress();
  }, [activeVideo?.id, courseId, flatVideos]);

  // Button label logic
  const quizBtnLabel = useMemo(() => {
    const has = !!quizStatus?.has_quiz;
    const unlocked = !!quizStatus?.quiz_unlocked;
    if (has && unlocked && isLastVideo && lastVideoProgressPushed) return "Start Quiz";
    return "Course Quiz";
  }, [quizStatus?.has_quiz, quizStatus?.quiz_unlocked, isLastVideo, lastVideoProgressPushed]);

  const courseCompleted = useMemo(() => {
    if (quizResult?.all_correct) return true;
    const s = quizStatus || {};
    return !!(s.completed_once || s.quiz_completed || s.passed || s.all_correct);
  }, [quizResult?.all_correct, quizStatus]);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!course) return <div style={{ padding: 20 }}>Loading course...</div>;

  const activeLabel = activeVideo?.video_title || activeTitleOnly || "";

  return (
    <div className="cp-page">
      {/* LEFT: MAIN */}
      <div className="cp-main">
        <div className="cp-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h1 className="cp-course-title" style={{ margin: 0 }}>
              {course.title}{" "}
              {courseCompleted ? (
                <span className="cp-course-tick" aria-label="Completed" title="Completed">
                  ✓
                </span>
              ) : null}
            </h1>

            {/* ✅ Trainer controls */}
            {canEdit ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleEditCourse}
                  className="cp-primary-btn"
                  style={{ height: 36, padding: "0 12px" }}
                >
                  Edit ✎
                </button>

                <button
                  type="button"
                  onClick={handleDeleteCourse}
                  className="cp-primary-btn"
                  style={{
                    height: 36,
                    padding: "0 12px",
                    backgroundColor: "#dc2626",
                    color: "#ffffff",
                    opacity: deleting ? 0.6 : 1,
                    cursor: deleting ? "default" : "pointer",
                  }}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="cp-breadcrumb">
            <button type="button" className="cp-back-btn" onClick={handlePlayerBack}>
              <span className="cp-back-icon" aria-hidden="true">
                ←
              </span>
              Back
            </button>

            <span className="cp-active-label" title={activeLabel}>
              {activeLabel}
            </span>
          </div>
        </div>

        {activeVideo ? (
          <>
            <div className="cp-player-wrap">
              <div className="cp-player-meta">
                <div className="cp-player-meta-left">
                  <div className="cp-player-kicker">Primary walkthrough</div>

                  <div className="cp-player-title" title={activeVideo.video_title}>
                    {activeVideo.video_title}
                  </div>
                </div>

                {activeVideo.guide_url ? (
                  <div className="cp-player-actions">
                    <a
                      href={activeVideo.guide_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cp-resource-link"
                      title={activeVideo.guide_title || "Open guide"}
                      onClick={(e) => handleResourceClick(e, activeVideo)}
                    >
                      📄 Resources
                    </a>
                  </div>
                ) : null}
              </div>

              {/* ✅ Bigger player (only sizing changed) */}
              <div className="cp-player-frame" style={{ minHeight: 560 }}>
                {isVideoItem ? (
                  <iframe
                    src={activeVideo.embed_url}
                    title={activeVideo.video_title}
                    frameBorder="0"
                    allowFullScreen
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : isArticleOnlyItem ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      background: "#000",
                    }}
                  >
                    <div className="cp-empty" style={{ maxWidth: 520, margin: 0 }}>
                      <div className="cp-empty-title">External resource</div>
                      <div className="cp-empty-sub">
                        Click the 📄 Resources button above to open this guide. This module has no video.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      background: "#000",
                    }}
                  >
                    <div className="cp-empty" style={{ maxWidth: 520, margin: 0 }}>
                      <div className="cp-empty-title">No content available</div>
                      <div className="cp-empty-sub">This item has no video and no resource link yet.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Overview / Notes tabs (restored) */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="cp-primary-btn"
                  onClick={() => setTab("overview")}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    opacity: tab === "overview" ? 1 : 0.7,
                    cursor: "pointer",
                  }}
                >
                  Overview
                </button>

                <button
                  type="button"
                  className="cp-primary-btn"
                  onClick={() => setTab("notes")}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    opacity: tab === "notes" ? 1 : 0.7,
                    cursor: "pointer",
                  }}
                >
                  Notes
                </button>
              </div>

              {tab === "overview" ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Course overview</div>

                    {canEdit ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {!overviewEditing ? (
                          <button
                            type="button"
                            className="cp-primary-btn"
                            title="Edit overview"
                            style={{ height: 32, padding: "0 10px" }}
                            onClick={() => {
                              setOverviewDraft(String(course?.description ?? ""));
                              setOverviewEditing(true);
                              setOverviewErr("");
                            }}
                          >
                            ✎
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="cp-primary-btn"
                            style={{
                              height: 32,
                              padding: "0 10px",
                              opacity: overviewSaving ? 0.6 : 1,
                              cursor: overviewSaving ? "default" : "pointer",
                            }}
                            onClick={saveOverview}
                            disabled={overviewSaving}
                          >
                            {overviewSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {overviewErr ? (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "#b00020" }}>
                      {overviewErr}
                    </div>
                  ) : null}

                  {overviewEditing ? (
                    <textarea
                      value={overviewDraft}
                      onChange={(e) => setOverviewDraft(e.target.value)}
                      placeholder="Write course overview…"
                      style={{
                        marginTop: 10,
                        width: "100%",
                        minHeight: 140,
                        resize: "vertical",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        padding: 12,
                        fontWeight: 700,
                        background: "#fff",
                        color: "#000",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <div style={{ whiteSpace: "pre-wrap", color: "rgba(0,0,0,0.75)" }}>
                      {course?.description ? course.description : "No overview provided yet."}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>My notes</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
                      {notesLoading ? "Loading..." : notesSaving ? "Saving..." : notesSavedHint ? notesSavedHint : ""}
                    </div>
                  </div>

                  {notesErr ? (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "#b00020" }}>
                      {notesErr}
                    </div>
                  ) : null}

                  <textarea
                    value={notes}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNotes(v);
                      scheduleAutosave(activeVideo, v);
                    }}
                    onBlur={() => {
                      // ensure a save happens when user clicks away
                      if (notesSaveTimerRef.current) window.clearTimeout(notesSaveTimerRef.current);
                      saveNotesForVideo(activeVideo, notes);
                    }}
                    placeholder="Write your notes here…"
                    style={{
                      marginTop: 10,
                      width: "100%",
                      minHeight: 140,
                      resize: "vertical",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.12)",
                      padding: 12,
                      fontWeight: 700,
                      background: "#fff",
                      color: "#000",
                      outline: "none",
                    }}
                  />
                </div>
              )}
            </div>
          </>
        ) : activeTitleOnly ? (
          <>
            <div className="cp-empty">
              <div className="cp-empty-title">{activeTitleOnly}</div>
              <div className="cp-empty-sub">Videos will be added later under this section.</div>
            </div>

            {/* ✅ Still show Overview/Notes even if section has no videos */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="cp-primary-btn"
                  onClick={() => setTab("overview")}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    opacity: tab === "overview" ? 1 : 0.7,
                    cursor: "pointer",
                  }}
                >
                  Overview
                </button>

                <button
                  type="button"
                  className="cp-primary-btn"
                  onClick={() => setTab("notes")}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    opacity: tab === "notes" ? 1 : 0.7,
                    cursor: "pointer",
                  }}
                >
                  Notes
                </button>
              </div>

              {tab === "overview" ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Course overview</div>

                    {canEdit ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {!overviewEditing ? (
                          <button
                            type="button"
                            className="cp-primary-btn"
                            title="Edit overview"
                            style={{ height: 32, padding: "0 10px" }}
                            onClick={() => {
                              setOverviewDraft(String(course?.description ?? ""));
                              setOverviewEditing(true);
                              setOverviewErr("");
                            }}
                          >
                            ✎
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="cp-primary-btn"
                            style={{
                              height: 32,
                              padding: "0 10px",
                              opacity: overviewSaving ? 0.6 : 1,
                              cursor: overviewSaving ? "default" : "pointer",
                            }}
                            onClick={saveOverview}
                            disabled={overviewSaving}
                          >
                            {overviewSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {overviewErr ? (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900, color: "#b00020" }}>
                      {overviewErr}
                    </div>
                  ) : null}

                  {overviewEditing ? (
                    <textarea
                      value={overviewDraft}
                      onChange={(e) => setOverviewDraft(e.target.value)}
                      placeholder="Write course overview…"
                      style={{
                        marginTop: 10,
                        width: "100%",
                        minHeight: 140,
                        resize: "vertical",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        padding: 12,
                        fontWeight: 700,
                        background: "#fff",
                        color: "#000",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <div style={{ whiteSpace: "pre-wrap", color: "rgba(0,0,0,0.75)" }}>
                      {course?.description ? course.description : "No overview provided yet."}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>My notes</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>
                    Notes are saved per video. Select a video to write notes.
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="cp-empty" style={{ marginTop: 16 }}>
            <div className="cp-empty-title">No content available</div>
          </div>
        )}
      </div>

      {/* RIGHT: SIDEBAR (unchanged) */}
      <aside className="cp-sidebar">
        <div className="cp-sidebar-card cp-sidebar-content">
          <div className="cp-sidebar-head">
            <div>
              <div className="cp-sidebar-title">Related guides</div>
              <div className="cp-sidebar-sub">Browse sections and videos</div>
            </div>
          </div>

          <div className="cp-sidebar-scroll">
            {sections.map((sec) => {
              const videos = Array.isArray(sec.videos) ? sec.videos : [];
              const secKey = sec.id ?? sec.title;
              const isOpen = !!openSections[secKey];

              return (
                <div key={secKey} className="cp-sec">
                  <button
                    type="button"
                    className="cp-sec-btn"
                    onClick={() => {
                      toggleSection(secKey);
                      setActiveVideo(videos[0] ?? null);
                      setActiveTitleOnly(!videos.length ? sec.title : null);
                      setTab("overview");
                      resetQuizUI();
                      setQuizHint("");
                    }}
                  >
                    <span className="cp-sec-left">
                      <span className={`cp-chevron ${isOpen ? "is-open" : ""}`} aria-hidden="true">
                        ▶
                      </span>
                      <span className="cp-sec-title">{sec.title}</span>
                    </span>
                    <span className="cp-sec-count">{videos.length}</span>
                  </button>

                  {isOpen &&
                    (videos.length ? (
                      <div className="cp-vid-list">
                        {videos.map((v) => {
                          const isActive = Number(activeVideo?.id) === Number(v.id);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className={`cp-vid ${isActive ? "is-active" : ""}`}
                              onClick={() => {
                                setActiveVideo(v);
                                setActiveTitleOnly(null);
                                setTab("overview");
                                resetQuizUI();
                                setQuizHint("");
                              }}
                              title={v.video_title}
                            >
                              {v.video_title}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="cp-empty-inline">(No videos yet)</div>
                    ))}
                </div>
              );
            })}

            <div className="cp-quiz-footer">
              <button
                type="button"
                onClick={handleTakeQuiz}
                className="cp-primary-btn cp-quiz-btn"
                disabled={quizLoading}
              >
                {quizLoading ? "Checking..." : quizBtnLabel}
              </button>

              {(quizHint || quizError) && <div className="cp-quiz-hint">{quizHint || quizError}</div>}
            </div>
          </div>
        </div>
      </aside>

      {/* QUIZ MODAL (unchanged) */}
      {quizOpen && (
        <div className="cp-modal-overlay" onClick={() => setQuizOpen(false)}>
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-head">
              <div className="cp-modal-title">{quizData?.title || "Course Quiz"}</div>
              <button type="button" className="cp-modal-x" onClick={() => setQuizOpen(false)}>
                ✕
              </button>
            </div>

            <div className="cp-modal-sub">
              Unlocked ✅ (modules opened: {quizStatus?.opened_videos}/{quizStatus?.total_videos})
            </div>

            {quizError ? <div className="cp-inline-error" style={{ marginTop: 10 }}>{quizError}</div> : null}

            {quizResult ? (
              <div className="cp-result">
                <div className="cp-result-title">
                  Result: {quizResult.score}/{quizResult.total}
                </div>
                <div className={`cp-result-status ${quizResult.all_correct ? "is-ok" : "is-bad"}`}>
                  {quizResult.all_correct
                    ? "🎉 Congratulations! You completed this quiz."
                    : "❌ Not passed (all answers must be correct)."}
                </div>

                <div className="cp-modal-actions" style={{ marginTop: 14 }}>
                  {!quizResult.all_correct ? (
                    <button
                      type="button"
                      className="cp-primary-btn"
                      onClick={resetQuizAttemptOnly}
                      style={{ cursor: "pointer" }}
                    >
                      Take quiz again
                    </button>
                  ) : (
                    <button type="button" className="cp-primary-btn" onClick={() => setQuizOpen(false)}>
                      Close
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {currentQuestion ? (
                  <div className="cp-q-list">
                    <div className="cp-q">
                      <div className="cp-q-prompt">
                        {quizStep + 1}. {currentQuestion.prompt}
                      </div>

                      <div className="cp-q-choices">
                        {(currentQuestion.choices || []).map((ch) => {
                          const checked = Number(quizAnswers[currentQuestion.id]) === Number(ch.id);
                          return (
                            <label key={ch.id} className={`cp-choice ${checked ? "is-selected" : ""}`}>
                              <input
                                type="radio"
                                name={`q-${currentQuestion.id}`}
                                checked={checked}
                                onChange={() => chooseAnswer(currentQuestion.id, ch.id)}
                              />
                              <span>{ch.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="cp-modal-actions">
                      <button type="button" className="cp-primary-btn" onClick={() => setQuizOpen(false)}>
                        Close
                      </button>

                      {!isLastQuestion ? (
                        <button type="button" className="cp-primary-btn" onClick={goNextQuestion}>
                          Next
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cp-primary-btn"
                          onClick={submitQuiz}
                          disabled={quizSubmitting}
                          style={{
                            opacity: quizSubmitting ? 0.6 : 1,
                            cursor: quizSubmitting ? "default" : "pointer",
                          }}
                        >
                          {quizSubmitting ? "Submitting..." : "Submit"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="cp-muted" style={{ marginTop: 14 }}>
                    No questions found for this course yet. Ask admin to add questions in Django.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
