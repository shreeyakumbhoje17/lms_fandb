import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import "../styles/upload.css";

const CATEGORIES = [
  {
    key: "office",
    label: "Office",
    subcategories: [
      { key: "essentials", label: "Essentials" },
      { key: "applications", label: "Applications" },
      { key: "customers", label: "Customers" },
    ],
  },
  {
    key: "field",
    label: "Field Engineers",
    subcategories: [
      { key: "essentials", label: "Essentials" },
      { key: "applications", label: "Applications" },
      { key: "customers", label: "Customers" },
    ],
  },
  {
    key: "trades",
    label: "Trades",
    subcategories: [
      { key: "building_fabric", label: "Building Fabric" },
      { key: "drainage_and_plumbing", label: "Drainage and Plumbing" },
      { key: "gas_and_electrical", label: "Gas and Electrical" },
      { key: "fire_safety", label: "Fire Safety" },
      { key: "environmental_services", label: "Environmental Services" },
      { key: "aspect_principles", label: "Aspect Principles" },
    ],
  },
];

const TRACKS = [
  { key: "office", label: "Office Track" },
  { key: "field", label: "Field Track" },
];

function norm(s) {
  return String(s || "").trim();
}

export default function Upload() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [track, setTrack] = useState("office");
  const [category, setCategory] = useState("office");
  const [subcategory, setSubcategory] = useState("essentials");

  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState("");
  const fileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      setLoadingMe(true);
      try {
        const res = await apiFetch("/api/me/");
        if (!res.ok) {
          const t = await res.text();
          if (!cancelled) setErr(t || `Failed to load user (${res.status})`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setMe(data);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const subsForCategory = useMemo(() => {
    const c = CATEGORIES.find((x) => x.key === category);
    return c?.subcategories || [];
  }, [category]);

  useEffect(() => {
    const valid = subsForCategory.some((s) => s.key === subcategory);
    if (!valid) setSubcategory(subsForCategory[0]?.key || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    if (!thumbFile) {
      setThumbPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(thumbFile);
    setThumbPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbFile]);

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(window.__uploadToastTimer);
    window.__uploadToastTimer = window.setTimeout(() => setToast(""), 2200);
  }

  function onPickThumbClick() {
    fileInputRef.current?.click();
  }

  function onThumbChange(e) {
    const f = e.target.files?.[0] || null;
    if (!f) return;

    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(f.type)) {
      setErr("Thumbnail must be a PNG, JPG, or WEBP image.");
      e.target.value = "";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErr("Thumbnail image is too large. Please keep it under 5MB.");
      e.target.value = "";
      return;
    }

    setErr("");
    setThumbFile(f);
  }

  // ✅ NEW: upload thumbnail to backend -> SharePoint
  async function uploadCourseThumbnail(courseId, file) {
    const fd = new FormData();
    fd.append("file", file);

    const res = await apiFetch(`/api/creator/courses/${courseId}/thumbnail/upload/`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Failed to upload thumbnail (${res.status})`);
    }

    // We don't need the response here, but it will include updated course thumbnail_url
    return res.json().catch(() => ({}));
  }

  async function onCreateCourse(e) {
    e.preventDefault();
    setErr("");

    // keep same behavior: create course first
    const payload = {
      title: norm(title),
      description: norm(description),
      track,
      category,
      subcategory,
      thumbnail_url: "",
    };

    if (!payload.title) {
      setErr("Title is required.");
      return;
    }
    if (!payload.track || !payload.category || !payload.subcategory) {
      setErr("Track, category and subcategory are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/creator/courses/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        setErr(text || `Failed to create course (${res.status})`);
        return;
      }

      const data = await res.json();
      const id = data?.id;

      if (id == null) {
        setErr("Course created but missing id in response.");
        return;
      }

      // ✅ NEW: upload thumbnail (if selected) after course exists
      if (thumbFile) {
        try {
          await uploadCourseThumbnail(id, thumbFile);
        } catch (thumbErr) {
          // don’t block redirect, but show a clear error
          // If you want to block redirect instead, tell me and I'll change it.
          setErr(String(thumbErr?.message || thumbErr));
        }
      }

      showToast("Draft created. Redirecting…");
      navigate(`/creator/courses/${id}`);
    } catch (e2) {
      setErr(String(e2));
    } finally {
      setSaving(false);
    }
  }

  if (err && loadingMe) return <div style={{ padding: 20 }}>Error: {err}</div>;
  if (loadingMe) return <div style={{ padding: 20 }}>Loading…</div>;

  const role = me?.role || null;
  const pendingMode = role == null;

  const previewTitle = norm(title) || "Course title preview";
  const previewDesc =
    norm(description) || "Add a short description so learners know what they’ll get out of this course.";
  const previewCat = CATEGORIES.find((c) => c.key === category)?.label || "Category";
  const previewTrack = TRACKS.find((t) => t.key === track)?.label || "Track";
  const previewThumb = thumbPreviewUrl || "/thumbnails/intro.jpg";

  return (
    <div className="up-page">
      <div className="up-shell">
        <header className="up-topbar">
          <div className="up-brand">
            <img src="/logo.png" alt="Aspect" className="up-logo" />
            <div className="up-brand-text">
              <div className="up-brand-title">Creator Studio</div>
              <div className="up-brand-sub">Create a draft course, then add sections, content, and quiz.</div>
            </div>
          </div>

          <div className="up-actions">
            <button
              type="button"
              className="up-btn up-btn-aspect"
              onClick={() => navigate("/dashboard")}
              disabled={saving}
              title="Back to dashboard"
            >
              Back to Dashboard
            </button>
          </div>
        </header>

        {toast ? (
          <div className="up-toast" role="status" aria-live="polite">
            {toast}
          </div>
        ) : null}

        <div className="up-grid">
          <section className="up-card">
            <div className="up-card-head">
              <h1 className="up-h1">Create a Course</h1>
              <p className="up-muted">
                This creates a <strong>draft</strong> course. You’ll add sections, content, and quiz in the builder page.
              </p>
            </div>

            {pendingMode ? (
              <div className="up-warn">Your access is pending (role not assigned). You can’t create courses yet.</div>
            ) : null}

            {err ? (
              <div className="up-alert" role="alert">
                <div className="up-alert-title">Couldn’t create course</div>
                <div className="up-alert-body" style={{ whiteSpace: "pre-wrap" }}>
                  {err}
                </div>
              </div>
            ) : null}

            <form className="up-form" onSubmit={onCreateCourse}>
              <div className="up-field">
                <label className="up-label">
                  Title <span className="up-required">*</span>
                </label>
                <input
                  className="up-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Fire Door Checks – Weekly Procedure"
                  disabled={saving || pendingMode}
                  style={{ color: "#000" }}
                />
              </div>

              <div className="up-field">
                <label className="up-label">Description</label>
                <textarea
                  className="up-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary of what learners will achieve…"
                  disabled={saving || pendingMode}
                  style={{ color: "#000" }}
                />
              </div>

              <div className="up-row">
                <div className="up-field">
                  <label className="up-label">
                    Track <span className="up-required">*</span>
                  </label>
                  <select
                    className="up-select"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    disabled={saving || pendingMode}
                    style={{ color: "#000" }}
                  >
                    {TRACKS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="up-field">
                  <label className="up-label">
                    Category <span className="up-required">*</span>
                  </label>
                  <select
                    className="up-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={saving || pendingMode}
                    style={{ color: "#000" }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="up-field">
                <label className="up-label">
                  Subcategory <span className="up-required">*</span>
                </label>
                <select
                  className="up-select"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  disabled={saving || pendingMode}
                  style={{ color: "#000" }}
                >
                  {subsForCategory.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="up-field">
                <label className="up-label">Thumbnail (optional)</label>

                <div className="up-thumb-row">
                  <button
                    type="button"
                    className="up-btn up-btn-aspect"
                    onClick={onPickThumbClick}
                    disabled={saving || pendingMode}
                    title="Choose an image file"
                  >
                    Choose image
                  </button>

                  <div className="up-thumb-meta">
                    <div className="up-thumb-name">{thumbFile ? thumbFile.name : "No file selected"}</div>
                    <div className="up-help">PNG/JPG/WEBP • Up to 5MB • Uploaded to SharePoint after course creation</div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={onThumbChange}
                />
              </div>

              <div className="up-foot">
                <button type="submit" className="up-btn up-btn-aspect" disabled={saving || pendingMode}>
                  {saving ? "Creating…" : "Create course"}
                </button>

                <button
                  type="button"
                  className="up-btn up-btn-aspect-outline"
                  onClick={() => navigate("/dashboard")}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>

              <div className="up-note">
                Note: After creating the draft, use the builder page to add sections, videos/resources, and quiz questions.
              </div>
            </form>
          </section>

          <aside className="up-side">
            <div className="up-preview">
              <div className="up-preview-top">
                <div className="up-preview-label">Preview</div>
                <div className="up-preview-chip">Draft</div>
              </div>

              <div className="up-thumb-wrap">
                <img
                  src={previewThumb}
                  alt="Thumbnail preview"
                  className="up-thumb"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              <div className="up-preview-body">
                <div className="up-preview-title">{previewTitle}</div>
                <div className="up-preview-meta">
                  <span>{previewTrack}</span>
                  <span className="up-dot">•</span>
                  <span>{previewCat}</span>
                </div>
                <div className="up-preview-desc">{previewDesc}</div>
              </div>
            </div>

            <div className="up-tip">
              <div className="up-tip-title">Next steps</div>
              <ul className="up-tip-list">
                <li>Create the draft course</li>
                <li>Add sections</li>
                <li>Add content (videos, docs, links)</li>
                <li>Add quiz questions (optional)</li>
                <li>Publish when ready</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
