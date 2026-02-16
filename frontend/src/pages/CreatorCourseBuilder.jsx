// CreatorCourseBuilder.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";

const ASPECT_BLUE = "#285193";
const ASPECT_YELLOW = "#F1FF28";

const btnPrimary = (disabled) => ({
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: `1px solid rgba(0,0,0,0.10)`,
  background: ASPECT_BLUE,
  color: ASPECT_YELLOW,
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
});

const btnPrimaryTall = (disabled) => ({
  ...btnPrimary(disabled),
  height: 42,
  padding: "0 16px",
});

const btnGhost = (disabled) => ({
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: `1px solid rgba(0,0,0,0.10)`,
  background: ASPECT_BLUE,
  color: ASPECT_YELLOW,
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
});

const btnGhostSmall = (disabled) => ({
  ...btnGhost(disabled),
  height: 36,
  padding: "0 12px",
});

// ❌ small icon-only button (keeps same behavior as delete buttons)
const btnX = (disabled) => ({
  height: 34,
  width: 34,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
});

export default function CreatorCourseBuilder() {
  const { id } = useParams();
  const courseId = Number(id);
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [newSectionTitle, setNewSectionTitle] = useState("");

  const [addToSectionId, setAddToSectionId] = useState(null);
  const [contentType, setContentType] = useState("video");
  const [videoTitle, setVideoTitle] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");

  // ✅ local upload support for videos
  const [videoFile, setVideoFile] = useState(null);
  const videoFileRef = useRef(null);

  const [guideTitle, setGuideTitle] = useState("Open resource");
  const [guideUrl, setGuideUrl] = useState("");

  const [busy, setBusy] = useState(false);

  const sections = useMemo(() => course?.sections || [], [course]);

  // ============================================================
  // ✅ Quiz builder state
  // ============================================================
  const [quizWrap, setQuizWrap] = useState(null); // { quiz: {...} } from backend
  const [quizTitleDraft, setQuizTitleDraft] = useState("");
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newChoiceTextByQ, setNewChoiceTextByQ] = useState({}); // { [qid]: text }

  async function loadQuiz() {
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/quiz/`);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (!data) return;

      setQuizWrap(data);

      const qt = data?.quiz?.title || "";
      setQuizTitleDraft(qt);
    } catch {
      // ignore
    }
  }

  async function ensureQuizExists() {
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/quiz/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Course Quiz", is_published: true }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to create quiz (${res.status})`);
      }
      const data = await res.json().catch(() => null);
      setQuizWrap(data);
      setQuizTitleDraft(data?.quiz?.title || "");
      return data?.quiz || null;
    } catch (e) {
      throw e;
    }
  }

  async function saveQuizTitle() {
    if (!quizWrap?.quiz?.id) return;
    const title = String(quizTitleDraft || "").trim() || "Course Quiz";

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/quiz/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to update quiz (${res.status})`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addQuestion() {
    const prompt = String(newQuestionPrompt || "").trim();
    if (!prompt) {
      setErr("Question prompt is required.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      let quiz = quizWrap?.quiz || null;
      if (!quiz?.id) {
        quiz = await ensureQuizExists();
      }

      const res = await apiFetch(`/api/creator/quizzes/${quiz.id}/questions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to add question (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);

      setNewQuestionPrompt("");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function updateQuestionPrompt(questionId, prompt) {
    const p = String(prompt || "").trim();
    if (!p) {
      setErr("Question prompt cannot be empty.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/questions/${questionId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });

      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to update question (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(questionId) {
    const ok = window.confirm("Delete this question (and its options)?");
    if (!ok) return;

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/questions/${questionId}/`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to delete question (${res.status})`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);
      else await loadQuiz();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addChoice(questionId) {
    const text = String(newChoiceTextByQ[questionId] || "").trim();
    if (!text) {
      setErr("Option text is required.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/questions/${questionId}/choices/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, is_correct: false }),
      });

      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to add option (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);

      setNewChoiceTextByQ((prev) => ({ ...prev, [questionId]: "" }));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function updateChoice(choiceId, payload) {
    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/choices/${choiceId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to update option (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteChoice(choiceId) {
    const ok = window.confirm("Delete this option?");
    if (!ok) return;

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/choices/${choiceId}/`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to delete option (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => null);
      if (data) setQuizWrap(data);
      else await loadQuiz();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  // UI helper: choose one correct option per question (frontend behavior only)
  async function setCorrectChoice(questionId, choiceId) {
    const quiz = quizWrap?.quiz;
    const questions = quiz?.questions || [];
    const q = questions.find((x) => Number(x.id) === Number(questionId));
    if (!q) return;

    // 1) set all others false (only if needed)
    const choices = q.choices || [];
    for (const ch of choices) {
      const shouldBeCorrect = Number(ch.id) === Number(choiceId);
      if (!!ch.is_correct !== shouldBeCorrect) {
        // eslint-disable-next-line no-await-in-loop
        await updateChoice(ch.id, { is_correct: shouldBeCorrect });
      }
    }
  }

  // ============================================================

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/`);
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to load (${res.status})`);
        setCourse(null);
        return;
      }
      const data = await res.json();
      setCourse(data);
    } catch (e) {
      setErr(String(e));
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(courseId)) return;
    load();
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function createSection() {
    const title = String(newSectionTitle || "").trim();
    if (!title) {
      setErr("Section title is required.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/sections/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to create section (${res.status})`);
        return;
      }

      setNewSectionTitle("");
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  // ✅ NEW: delete section
  async function deleteSection(sectionId) {
    const ok = window.confirm("Delete this section (and all content inside it)?");
    if (!ok) return;

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/sections/${sectionId}/`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to delete section (${res.status})`);
        return;
      }

      if (addToSectionId === sectionId) setAddToSectionId(null);

      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  // ✅ NEW: delete video/content
  async function deleteVideo(videoId) {
    const ok = window.confirm("Delete this content item?");
    if (!ok) return;

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/videos/${videoId}/`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to delete content (${res.status})`);
        return;
      }

      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  // ✅ upload video file to backend -> SharePoint
  async function uploadVideoFileToSharePoint(sectionId, title, file) {
    const fd = new FormData();
    fd.append("video_title", title);
    fd.append("file", file);

    const res = await apiFetch(`/api/creator/sections/${sectionId}/videos/upload/`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Failed to upload video (${res.status})`);
    }

    return res.json().catch(() => ({}));
  }

  async function addContent(sectionId) {
    const title = String(videoTitle || "").trim();

    if (!title) {
      setErr("Content title is required.");
      return;
    }

    // ✅ Video: local file upload
    if (contentType === "video") {
      if (!videoFile) {
        setErr("Please choose a video file to upload.");
        return;
      }

      setBusy(true);
      setErr("");
      try {
        await uploadVideoFileToSharePoint(sectionId, title, videoFile);

        // reset inputs
        setContentType("video");
        setVideoTitle("");
        setEmbedUrl("");
        setVideoFile(null);
        if (videoFileRef.current) videoFileRef.current.value = "";
        setGuideTitle("Open resource");
        setGuideUrl("");
        setAddToSectionId(null);

        await load();
        return;
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setBusy(false);
      }
      return;
    }

    // ✅ Non-video: URL-based
    const payload = {
      content_type: contentType,
      video_title: title,
      embed_url: String(embedUrl || "").trim(),
      guide_title: String(guideTitle || "").trim(),
      guide_url: String(guideUrl || "").trim(),
    };

    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/sections/${sectionId}/videos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to add content (${res.status})`);
        return;
      }

      setContentType("video");
      setVideoTitle("");
      setEmbedUrl("");
      setVideoFile(null);
      if (videoFileRef.current) videoFileRef.current.value = "";
      setGuideTitle("Open resource");
      setGuideUrl("");
      setAddToSectionId(null);

      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function publishCourse() {
    setBusy(true);
    setErr("");
    try {
      const res = await apiFetch(`/api/creator/courses/${courseId}/publish/`, { method: "POST" });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `Failed to publish (${res.status})`);
        return;
      }
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading builder…</div>;

  if (err && !course) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontWeight: 900, color: "#b00020", whiteSpace: "pre-wrap" }}>{err}</div>
        <button onClick={() => navigate("/dashboard")} style={{ marginTop: 12 }}>
          Back
        </button>
      </div>
    );
  }

  const quiz = quizWrap?.quiz || null;
  const quizQuestions = (quiz?.questions || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{course?.title || "Course Builder"}</h1>
          <div style={{ color: "rgba(0,0,0,0.65)", marginTop: 6 }}>
            Status: <strong>{course?.status || (course?.is_published ? "published" : "draft")}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => navigate("/dashboard")} disabled={busy} style={btnGhost(busy)}>
            Back
          </button>

          <button type="button" onClick={publishCourse} disabled={busy} style={btnGhost(busy)}>
            Publish
          </button>
        </div>
      </div>

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(176,0,32,0.08)",
            border: "1px solid rgba(176,0,32,0.25)",
            color: "#b00020",
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}

      {/* Create Section */}
      <div
        style={{
          marginTop: 16,
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            placeholder="New section title (e.g. Introduction)"
            style={{
              flex: 1,
              height: 42,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              padding: "0 12px",
              fontWeight: 700,
              color: "#000",
              background: "#fff",
            }}
            disabled={busy}
          />
          <button type="button" onClick={createSection} disabled={busy} style={btnPrimaryTall(busy)}>
            Add section
          </button>
        </div>
      </div>

      {/* Sections */}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {sections.map((sec) => (
          <div
            key={sec.id}
            style={{
              borderRadius: 16,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                {sec.order}. {sec.title}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setAddToSectionId(addToSectionId === sec.id ? null : sec.id)}
                  style={btnGhostSmall(false)}
                  disabled={busy}
                >
                  + Add content
                </button>

                <button
                  type="button"
                  onClick={() => deleteSection(sec.id)}
                  disabled={busy}
                  style={btnX(busy)}
                  title="Delete section"
                  aria-label="Delete section"
                >
                  ❌
                </button>
              </div>
            </div>

            {/* Content list */}
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {(sec.videos || []).map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "rgba(0,0,0,0.02)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>
                      {v.order}. {v.video_title}{" "}
                      <span style={{ fontWeight: 700, color: "rgba(0,0,0,0.6)" }}>({v.content_type})</span>
                    </div>

                    {v.embed_url ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(0,0,0,0.65)",
                          marginTop: 4,
                          wordBreak: "break-all",
                        }}
                      >
                        {v.embed_url}
                      </div>
                    ) : null}

                    {v.guide_url ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(0,0,0,0.65)",
                          marginTop: 4,
                          wordBreak: "break-all",
                        }}
                      >
                        {v.guide_title || "Open resource"} — {v.guide_url}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteVideo(v.id)}
                    disabled={busy}
                    style={btnX(busy)}
                    title="Delete content"
                    aria-label="Delete content"
                  >
                    ❌
                  </button>
                </div>
              ))}

              {(sec.videos || []).length === 0 && (
                <div style={{ color: "rgba(0,0,0,0.6)", fontWeight: 700 }}>No content yet.</div>
              )}
            </div>

            {/* Add content form */}
            {addToSectionId === sec.id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>Type</label>
                    <select
                      value={contentType}
                      onChange={(e) => {
                        setContentType(e.target.value);
                        setErr("");
                        if (e.target.value !== "video") {
                          setVideoFile(null);
                          if (videoFileRef.current) videoFileRef.current.value = "";
                        }
                      }}
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        padding: "0 10px",
                        fontWeight: 900,
                        color: "#000",
                        background: "#fff",
                      }}
                      disabled={busy}
                    >
                      <option value="video">Video (Upload file)</option>
                      <option value="article">Article / Page</option>
                      <option value="file">File / Document</option>
                      <option value="link">External Link</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>Title</label>
                    <input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g. Week 1 – Checklist"
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        padding: "0 12px",
                        fontWeight: 800,
                        color: "#000",
                        background: "#fff",
                      }}
                      disabled={busy}
                    />
                  </div>

                  {/* Video upload */}
                  {contentType === "video" ? (
                    <div style={{ gridColumn: "1 / span 2" }}>
                      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>Video file *</label>
                      <input
                        ref={videoFileRef}
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setErr("");
                          setVideoFile(f);
                        }}
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.15)",
                          padding: "6px 10px",
                          fontWeight: 800,
                          color: "#000",
                          background: "#fff",
                        }}
                        disabled={busy}
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 700 }}>
                        This uploads directly to SharePoint (via backend).
                      </div>
                    </div>
                  ) : (
                    <div style={{ gridColumn: "1 / span 2" }}>
                      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>Embed URL (optional)</label>
                      <input
                        value={embedUrl}
                        onChange={(e) => setEmbedUrl(e.target.value)}
                        placeholder="https://..."
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.15)",
                          padding: "0 12px",
                          fontWeight: 700,
                          color: "#000",
                          background: "#fff",
                        }}
                        disabled={busy}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>Guide title</label>
                    <input
                      value={guideTitle}
                      onChange={(e) => setGuideTitle(e.target.value)}
                      placeholder="Open resource"
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        padding: "0 12px",
                        fontWeight: 700,
                        color: "#000",
                        background: "#fff",
                      }}
                      disabled={busy}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>Guide URL</label>
                    <input
                      value={guideUrl}
                      onChange={(e) => setGuideUrl(e.target.value)}
                      placeholder="https://..."
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        padding: "0 12px",
                        fontWeight: 700,
                        color: "#000",
                        background: "#fff",
                      }}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" onClick={() => addContent(sec.id)} disabled={busy} style={btnGhost(busy)}>
                    Add
                  </button>

                  <button type="button" onClick={() => setAddToSectionId(null)} disabled={busy} style={btnGhost(busy)}>
                    Cancel
                  </button>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                  Note: Quiz Builder is available below.
                </div>
              </div>
            )}
          </div>
        ))}

        {sections.length === 0 && (
          <div style={{ marginTop: 10, color: "rgba(0,0,0,0.65)", fontWeight: 800 }}>
            Add a section to start building your course.
          </div>
        )}
      </div>

      {/* ============================================================
          ✅ Quiz Builder
         ============================================================ */}
      <div
        style={{
          marginTop: 18,
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Quiz Builder</div>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 700, marginTop: 4 }}>
              Trainers can create/edit quiz questions and options here. Learners never see correct answers.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {!quiz?.id ? (
              <button
                type="button"
                onClick={async () => {
                  setErr("");
                  setBusy(true);
                  try {
                    await ensureQuizExists();
                  } catch (e) {
                    setErr(String(e?.message || e));
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                style={btnGhost(busy)}
              >
                Create quiz
              </button>
            ) : null}
          </div>
        </div>

        {!quiz?.id ? (
          <div style={{ marginTop: 12, color: "rgba(0,0,0,0.65)", fontWeight: 800 }}>
            No quiz exists yet for this course. Click <strong>Create quiz</strong> to start.
          </div>
        ) : (
          <>
            {/* Quiz title */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={quizTitleDraft}
                onChange={(e) => setQuizTitleDraft(e.target.value)}
                placeholder="Quiz title"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  padding: "0 12px",
                  fontWeight: 800,
                  color: "#000",
                  background: "#fff",
                }}
                disabled={busy}
              />
              <button type="button" onClick={saveQuizTitle} disabled={busy} style={btnGhost(busy)}>
                Save title
              </button>
            </div>

            {/* Add question */}
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={newQuestionPrompt}
                onChange={(e) => setNewQuestionPrompt(e.target.value)}
                placeholder="New question prompt (e.g. What should you check first?)"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  padding: "0 12px",
                  fontWeight: 800,
                  color: "#000",
                  background: "#fff",
                }}
                disabled={busy}
              />
              <button type="button" onClick={addQuestion} disabled={busy} style={btnGhost(busy)}>
                Add question
              </button>
            </div>

            {/* Questions list */}
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {quizQuestions.map((q) => {
                const choices = q.choices || [];
                const hasMaxChoices = choices.length >= 4;

                return (
                  <div
                    key={q.id}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>
                        Q{q.order}.{" "}
                        <input
                          defaultValue={q.prompt}
                          onBlur={(e) => {
                            const next = e.target.value;
                            if (String(next || "").trim() !== String(q.prompt || "").trim()) {
                              updateQuestionPrompt(q.id, next);
                            }
                          }}
                          style={{
                            width: "min(820px, 100%)",
                            maxWidth: "100%",
                            marginLeft: 6,
                            height: 36,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.12)",
                            padding: "0 10px",
                            fontWeight: 800,
                            color: "#000",
                            background: "#fff",
                          }}
                          disabled={busy}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteQuestion(q.id)}
                        disabled={busy}
                        style={btnX(busy)}
                        title="Delete question"
                        aria-label="Delete question"
                      >
                        ❌
                      </button>
                    </div>

                    {/* Choices */}
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {choices.map((ch) => (
                        <div
                          key={ch.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,0.10)",
                            background: "#fff",
                          }}
                        >
                          <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={!!ch.is_correct}
                              onChange={() => setCorrectChoice(q.id, ch.id)}
                              disabled={busy}
                            />
                            <input
                              defaultValue={ch.text}
                              onBlur={(e) => {
                                const next = e.target.value;
                                if (String(next || "").trim() !== String(ch.text || "").trim()) {
                                  updateChoice(ch.id, { text: next });
                                }
                              }}
                              style={{
                                flex: 1,
                                height: 34,
                                borderRadius: 10,
                                border: "1px solid rgba(0,0,0,0.12)",
                                padding: "0 10px",
                                fontWeight: 800,
                                color: "#000",
                                background: "#fff",
                              }}
                              disabled={busy}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => deleteChoice(ch.id)}
                            disabled={busy}
                            style={btnX(busy)}
                            title="Delete option"
                            aria-label="Delete option"
                          >
                            ❌
                          </button>
                        </div>
                      ))}

                      {/* Add choice */}
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          value={newChoiceTextByQ[q.id] || ""}
                          onChange={(e) => setNewChoiceTextByQ((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="New option text"
                          style={{
                            flex: 1,
                            height: 36,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            padding: "0 12px",
                            fontWeight: 800,
                            color: "#000",
                            background: "#fff",
                          }}
                          disabled={busy || hasMaxChoices}
                        />
                        <button
                          type="button"
                          onClick={() => addChoice(q.id)}
                          disabled={busy || hasMaxChoices}
                          style={btnGhostSmall(busy || hasMaxChoices)}
                        >
                          Add option
                        </button>
                      </div>

                      {hasMaxChoices ? (
                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 700 }}>
                          This question already has 4 options (maximum).
                        </div>
                      ) : null}

                      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 700 }}>
                        Tip: Select exactly one correct option (radio button). Learners will never receive correct flags.
                      </div>
                    </div>
                  </div>
                );
              })}

              {quizQuestions.length === 0 && (
                <div style={{ color: "rgba(0,0,0,0.65)", fontWeight: 800 }}>
                  No questions yet. Add your first question above.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
