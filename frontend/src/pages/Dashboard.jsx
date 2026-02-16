import "../styles/dashboard/main.css";
import "../styles/dashboard/navigation.css";
import "../styles/dashboard/popups.css";
import "../styles/dashboard/responsive.css";

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardHeader from "../components/Dashboard/DashboardHeader";
import CourseCard from "../components/Dashboard/CourseCard";
import { apiFetch } from "../api";

function normalizeRole(role) {
  if (!role) return null;
  if (role === "field_engineer") return "field";
  return role;
}

function roleLabel(role) {
  if (!role) return "";
  const r = String(role).toLowerCase();
  if (r === "office") return "Office Staff";
  if (r === "field" || r === "field_engineer") return "Field Staff";
  return role;
}

function pickFirstName(user) {
  const first = (user?.first_name || "").trim();
  if (first) return first;

  const display = (user?.display_name || user?.displayName || user?.name || "").trim();
  if (display) return display.split(/\s+/).filter(Boolean)[0] || "";

  const email = (user?.email || "").trim();
  if (email) {
    const local = email.split("@")[0] || "";
    const parts = local.split(/[._-]+/).filter(Boolean);
    return parts[0] || "";
  }
  return "";
}

function normTrack(t) {
  return String(t || "").trim().toLowerCase();
}

function normCategory(c) {
  return String(c || "").trim().toLowerCase();
}

function normSubcategory(s) {
  return String(s || "").trim().toLowerCase();
}

function normText(s) {
  return String(s || "").trim();
}

/* ✅ helper to format large counts like 1.2K / 2.3M */
function formatCount(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "0";
  if (num < 1_000) return String(num);
  if (num < 1_000_000) return `${(num / 1_000).toFixed(num < 10_000 ? 1 : 0)}K`;
  if (num < 1_000_000_000) return `${(num / 1_000_000).toFixed(num < 10_000_000 ? 1 : 0)}M`;
  return `${(num / 1_000_000_000).toFixed(1)}B`;
}

/**
 * ✅ Normalize `/api/my-learning/`
 * Output: [{ course, lastVideoId, lastVideoTitle, lastAccessed }]
 */
function normalizeMyLearningResponse(data) {
  const arr = Array.isArray(data) ? data : [];

  return arr
    .map((item) => {
      if (item?.id && item?.resume) {
        return {
          course: {
            id: item.id,
            title: item.title,
            description: item.description,
            track: item.track,
            thumbnail_url: item.thumbnail_url,
            category: item.category,
            subcategory: item.subcategory,
            unique_viewers: item.unique_viewers,
            attempted_times: item.attempted_times,
            completed_times: item.completed_times,
          },
          lastVideoId: item.resume?.video_id ?? null,
          lastVideoTitle: item.resume?.video_title ?? "",
          lastAccessed: item.last_accessed ?? null,
        };
      }

      if (item?.id && (item?.last_video || item?.last_accessed)) {
        return {
          course: item,
          lastVideoId: item?.last_video?.id ?? null,
          lastVideoTitle: item?.last_video?.video_title ?? "",
          lastAccessed: item?.last_accessed ?? null,
        };
      }

      if (item?.course && item.course.id) {
        return {
          course: item.course,
          lastVideoId: item.last_video_id ?? null,
          lastVideoTitle: item.last_video_title ?? "",
          lastAccessed: item.last_accessed ?? null,
        };
      }

      return null;
    })
    .filter(Boolean);
}

/**
 * ✅ Normalize `/api/search/?q=...`
 * Supports BOTH shapes:
 *  1) Old: [Course, Course, ...]
 *  2) New: [{ type, course, section?, video? }, ...]
 *
 * Output: [Course, Course, ...] (with optional __search meta attached)
 */
function normalizeSearchResponse(data) {
  const arr = Array.isArray(data) ? data : [];

  const looksLikeCourse = (x) => x && typeof x === "object" && x.id != null && x.title != null && !x.course;
  if (arr.length > 0 && arr.every(looksLikeCourse)) return arr;

  const byId = new Map();

  const rank = (t) => (t === "video" ? 3 : t === "section" ? 2 : 1);

  for (const item of arr) {
    const c = item?.course;
    if (!c?.id) continue;

    const cid = Number(c.id);
    const prev = byId.get(cid);

    const nextMeta = {
      type: item?.type || "course",
      sectionTitle: item?.section?.title || "",
      videoTitle: item?.video?.title || "",
      videoId: item?.video?.id ?? null,
    };

    if (!prev) {
      byId.set(cid, { ...c, __search: nextMeta });
      continue;
    }

    const prevRank = rank(prev.__search?.type);
    const nextRank = rank(nextMeta.type);

    if (nextRank > prevRank) {
      byId.set(cid, { ...prev, __search: nextMeta });
    }
  }

  return Array.from(byId.values());
}

export default function Dashboard() {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [myLearningEntries, setMyLearningEntries] = useState([]);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // ✅ Search state (ONLY for search bar)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not searching

  // ✅ Courses tabs (Udemy-style)
  const [coursesTab, setCoursesTab] = useState("trades");

  function showBlocked() {
    setToast("Waiting for Admin Access..");
    window.clearTimeout(window.__dashToastTimer);
    window.__dashToastTimer = window.setTimeout(() => setToast(""), 2000);
  }

  const params = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const activeCategory = useMemo(() => normCategory(params.get("category")), [params]);
  const activeSubcategory = useMemo(() => normSubcategory(params.get("subcategory")), [params]);
  const hasSelection = Boolean(activeCategory && activeSubcategory);

  const coursesById = useMemo(() => {
    const m = new Map();
    for (const c of courses || []) {
      if (c?.id != null) m.set(Number(c.id), c);
    }
    return m;
  }, [courses]);

  function mergeMyLearningWithStats(entries) {
    return (entries || []).map((e) => {
      const id = Number(e?.course?.id);
      const full = coursesById.get(id);
      if (full && e?.course) {
        return {
          ...e,
          course: {
            ...e.course,
            unique_viewers: full.unique_viewers ?? e.course.unique_viewers,
            attempted_times: full.attempted_times ?? e.course.attempted_times,
            completed_times: full.completed_times ?? e.course.completed_times,
            thumbnail_url: e.course.thumbnail_url || full.thumbnail_url,
            track: e.course.track || full.track,
            category: e.course.category || full.category,
            subcategory: e.course.subcategory || full.subcategory,
          },
        };
      }
      return e;
    });
  }

  async function loadMyLearning() {
    try {
      const res = await apiFetch("/api/my-learning/");
      if (!res.ok) {
        setMyLearningEntries([]);
        return;
      }
      const data = await res.json();
      setMyLearningEntries(normalizeMyLearningResponse(data));
    } catch {
      setMyLearningEntries([]);
    }
  }

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await apiFetch("/api/me/");
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Failed to load user (${res.status})`);
          return;
        }
        setUser(await res.json());
      } catch (e) {
        setError(String(e));
      }
    }
    loadMe();
  }, []);

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await apiFetch("/api/courses/");
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Failed to load courses (${res.status})`);
          return;
        }
        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(String(e));
      }
    }
    loadCourses();
  }, []);

  useEffect(() => {
    loadMyLearning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;

    loadMyLearning();

    const onFocus = () => loadMyLearning();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadMyLearning();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    let t = null;
    let cancelled = false;

    async function run() {
      const q = normText(searchQuery);
      if (!q) {
        setSearchResults(null);
        return;
      }

      try {
        const res = await apiFetch(`/api/courses/search/?q=${encodeURIComponent(q)}`);

        if (!res.ok) {
          if (!cancelled) setSearchResults([]);
          return;
        }

        const data = await res.json().catch(() => []);
        if (!cancelled) setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSearchResults([]);
      }
    }

    t = window.setTimeout(run, 250);

    return () => {
      cancelled = true;
      if (t) window.clearTimeout(t);
    };
  }, [searchQuery]);

  const role = useMemo(() => normalizeRole(user?.role), [user]);
  const pendingMode = role === null;

  const visibleCourses = useMemo(() => {
    const base = searchResults !== null ? normalizeSearchResponse(searchResults) : courses;

    if (pendingMode) return base;
    if (role === "field") return (base || []).filter((c) => c && normTrack(c.track) === "field");
    return base;
  }, [courses, role, pendingMode, searchResults]);

  const visibleMyLearning = useMemo(() => {
    const merged = mergeMyLearningWithStats(myLearningEntries);
    if (pendingMode) return merged;
    if (role === "field") return (merged || []).filter((e) => e && normTrack(e.course?.track) === "field");
    return merged;
  }, [myLearningEntries, role, pendingMode, coursesById]);

  const selectedCourses = useMemo(() => {
    if (!hasSelection) return [];
    return (visibleCourses || []).filter((c) => {
      return c && normCategory(c?.category) === activeCategory && normSubcategory(c?.subcategory) === activeSubcategory;
    });
  }, [visibleCourses, hasSelection, activeCategory, activeSubcategory]);

  const groupedGuides = useMemo(() => {
    const groups = { office: [], field: [], trades: [] };

    for (const c of visibleCourses || []) {
      if (!c) continue;
      const cat = normCategory(c?.category);
      if (cat === "office") groups.office.push(c);
      else if (cat === "field") groups.field.push(c);
      else if (cat === "trades") groups.trades.push(c);
      else groups.office.push(c);
    }

    return groups;
  }, [visibleCourses]);

  const hasAnyGuides =
    (groupedGuides.office?.length || 0) +
      (groupedGuides.field?.length || 0) +
      (groupedGuides.trades?.length || 0) >
    0;

  const welcomeFirst = useMemo(() => pickFirstName(user), [user]);
  const welcomeLine = useMemo(() => {
    if (!user) return "";
    if (pendingMode) return "Waiting for Admin Access";
    return roleLabel(user?.role);
  }, [user, pendingMode]);

  // ✅ DESIGN helpers (as-is)
  const pageWrapStyle = {
    width: "100%",
    background: "#fff",
  };

  const maxRowStyle = {
    width: "100%",
    maxWidth: 1440,
    margin: "0 auto",
    padding: "0 32px",
  };

  const roundedBoxStyle = {
    borderRadius: 22,
    padding: 18,
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  };

  const pillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.05)",
    border: "1px solid rgba(0,0,0,0.08)",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.2,
    color: "#1c1d1f",
  };

  // ✅ Udemy-like focus mode: search OR filter -> show ONLY results section
  // IMPORTANT: these hooks/values are ABOVE early returns to avoid hook-order crash.
  const normalizedQ = normText(searchQuery);
  const isSearching = Boolean(normalizedQ);
  const focusMode = isSearching || hasSelection;

  const focusCourses = isSearching ? visibleCourses : selectedCourses;

  const focusGrouped = useMemo(() => {
    const src = focusCourses || [];
    const groups = { office: [], field: [], trades: [] };

    for (const c of src) {
      if (!c) continue;
      const cat = normCategory(c?.category);
      if (cat === "office") groups.office.push(c);
      else if (cat === "field") groups.field.push(c);
      else if (cat === "trades") groups.trades.push(c);
      else groups.office.push(c);
    }

    return groups;
  }, [focusCourses]);

  useEffect(() => {
    if (!focusMode) return;

    const order = ["trades", "office", "field"];
    const currentHas = (focusGrouped[coursesTab] || []).length > 0;
    if (currentHas) return;

    const firstWith = order.find((k) => (focusGrouped[k] || []).length > 0);
    if (firstWith && firstWith !== coursesTab) setCoursesTab(firstWith);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode, focusGrouped, coursesTab]);

  const focusMeta = useMemo(() => {
    if (isSearching) return `Results for "${normalizedQ}"`;
    return `Showing: ${activeCategory} / ${activeSubcategory}`;
  }, [isSearching, normalizedQ, activeCategory, activeSubcategory]);

  // ✅ Early returns (keep AFTER all hooks to avoid hook-order crash)
  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!user) return <div style={{ padding: 20 }}>Loading user...</div>;

  const footerLinkStyle = {
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
    opacity: 0.95,
  };

  const footerHeadStyle = {
    color: "#F1FF28",
    fontWeight: 900,
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 1.15,
  };

  const footerLinksWrapStyle = { 
    display: "grid",
    gap: 8, 
    margin:0, 
    padding:0,
    lineHeight:1.45,
  }; 

  const socialCircleStyle = {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.72)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    lineHeight: 0,
  };

  return (
    <div className="ud-body">
      {/* ✅ Styling-only overrides: Upload button + footer blue/yellow */}
      <style>{`
        /* Try to catch the Upload button without changing any structure/functionality */
        .ud-body .ud-upload,
        .ud-body .upload-btn,
        .ud-body .dash-upload,
        .ud-body .ud-header-upload,
        .ud-body .topbar-upload,
        .ud-body button.ud-upload,
        .ud-body a.ud-upload,
        .ud-body button.upload-btn,
        .ud-body a.upload-btn {
          background: #285193 !important;
          border-color: #285193 !important;
        }
        .ud-body .ud-upload,
        .ud-body .upload-btn,
        .ud-body .dash-upload,
        .ud-body .ud-header-upload,
        .ud-body .topbar-upload {
          color: #fff !important;
        }
      `}</style>

      <DashboardHeader
        user={user}
        pendingMode={pendingMode}
        onBlockedAction={showBlocked}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {toast && (
        <div className="ud-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* ✅ Focus mode view (SEARCH/FILTER): ONLY courses list */}
      {focusMode ? (
        <>
          <main className="dash">
            <div style={pageWrapStyle}>
              <div style={maxRowStyle}>
                <section className="ud-courses-strip" style={{ marginTop: 18 }}>
                  <div className="ud-courses-head">
                    <div className="ud-courses-title">Courses</div>
                    <div className="ud-courses-meta">{focusMeta}</div>
                  </div>

                  <div className="ud-courses-tabs" role="tablist" aria-label="Course categories">
                    <button
                      type="button"
                      className={`ud-tab ${coursesTab === "trades" ? "is-active" : ""}`}
                      onClick={() => setCoursesTab("trades")}
                      role="tab"
                      aria-selected={coursesTab === "trades"}
                    >
                      Trades
                    </button>

                    <button
                      type="button"
                      className={`ud-tab ${coursesTab === "office" ? "is-active" : ""}`}
                      onClick={() => setCoursesTab("office")}
                      role="tab"
                      aria-selected={coursesTab === "office"}
                    >
                      Office Staff
                    </button>

                    <button
                      type="button"
                      className={`ud-tab ${coursesTab === "field" ? "is-active" : ""}`}
                      onClick={() => setCoursesTab("field")}
                      role="tab"
                      aria-selected={coursesTab === "field"}
                    >
                      Field Engineers
                    </button>
                  </div>

                  <div className="ud-courses-divider" />

                  <div className="learning-row" style={{ marginTop: 18 }}>
                    {(focusGrouped[coursesTab] || []).map((c) =>
                      c?.id != null ? (
                        <CourseCard key={c.id} course={c} locked={pendingMode} onLockedClick={showBlocked} />
                      ) : null
                    )}

                    {(focusGrouped[coursesTab] || []).length === 0 && (
                      <div className="empty-state" style={{ padding: "12px 0" }}>
                        No modules found.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </main>

          {/* ✅ FULL-WIDTH FOOTER (NEW) — end-to-end, no left/right/bottom padding; all items are links */}
          <footer
            style={{
              width: "100%",
              background: "#285193",
              color: "#fff",
              marginTop: 60,
              padding: 0,
            }}
          >
            {/* Inner container for columns (like your screenshot), footer itself is edge-to-edge */}
            <div style={{ maxWidth: 1440, margin: "0 auto", padding: "46px 56px 0" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
                  gap: 34,
                  alignItems: "start",
                }}
              >
                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Information
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/blog/" style={footerLinkStyle}>
                      Blog
                    </a>
                    <a href="https://www.aspect.co.uk/video-posts/" style={footerLinkStyle}>
                      Video posts
                    </a>
                    <a href="https://www.aspect.co.uk/local-to-you/" style={footerLinkStyle}>
                      Local to you
                    </a>
                    <a href="https://www.aspect.co.uk/reviews/" style={footerLinkStyle}>
                      Reviews
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Company
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/our-guarantee/" style={footerLinkStyle}>
                      Our guarantee
                    </a>
                    <a href="https://www.aspect.co.uk/accreditations/" style={footerLinkStyle}>
                      Accreditations
                    </a>
                    <a href="https://www.aspect.co.uk/recruitment/" style={footerLinkStyle}>
                      Careers
                    </a>
                    <a href="https://www.aspect.co.uk/about-us/" style={footerLinkStyle}>
                      About us
                    </a>
                    <a href="https://www.aspect.co.uk/contact-us/" style={footerLinkStyle}>
                      Contact us
                    </a>
                    <a href="https://www.aspect.co.uk/sitemap/" style={footerLinkStyle}>
                      Sitemap
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Our Services
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/trades/plumbing-and-cold-water/" style={footerLinkStyle}>
                      Plumbing
                    </a>
                    <a href="https://www.aspect.co.uk/trades/electrics/" style={footerLinkStyle}>
                      Electrics
                    </a>
                    <a href="https://www.aspect.co.uk/trades/heating-hot-water/" style={footerLinkStyle}>
                      Heating
                    </a>
                    <a href="https://www.aspect.co.uk/trades/damp-leaks/" style={footerLinkStyle}>
                      Damp and Leaks
                    </a>
                    <a href="https://www.aspect.co.uk/trades/drainage-services/" style={footerLinkStyle}>
                      Drainage Services
                    </a>
                    <a href="https://www.aspect.co.uk/trades/roofing/" style={footerLinkStyle}>
                      Roofing
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Other Services
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/trades/handyman-odd-jobs/" style={footerLinkStyle}>
                      Handyman
                    </a>
                    <a
                      href="https://www.aspect.co.uk/trades/air-conditioning-refrigeration/"
                      style={footerLinkStyle}
                    >
                      Air Conditioning
                    </a>
                    <a href="https://www.aspect.co.uk/trades/carpentry/" style={footerLinkStyle}>
                      Carpentry
                    </a>
                    <a href="https://www.aspect.co.uk/trades/painting-decorating/" style={footerLinkStyle}>
                      Painting and Decorating
                    </a>
                    <a href="https://www.aspect.co.uk/trades/pest-control/" style={footerLinkStyle}>
                      Pest Control
                    </a>
                    <a href="https://www.aspect.co.uk/trades/gardening/" style={footerLinkStyle}>
                      Gardening
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Legals
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/terms-and-conditions/" style={footerLinkStyle}>
                      Terms and conditions
                    </a>
                    <a href="https://www.aspect.co.uk/privacy-policy/" style={footerLinkStyle}>
                      Privacy policy
                    </a>
                    <a href="https://www.aspect.co.uk/#" style={footerLinkStyle}>
                      Cookie policy
                    </a>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                  <div style={footerHeadStyle}>Social</div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <a href="https://www.facebook.com/aspect.co.uk" aria-label="Facebook" style={socialCircleStyle}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M14 8.5V7.2c0-1 .8-1.7 1.7-1.7H17V3h-1.6C12.9 3 11 4.9 11 7.4V8.5H9v3h2V21h3v-9.5h2.4l.6-3H14Z"
                          fill="currentColor"
                        />
                      </svg>
                    </a>

                    <a
                      href="https://www.instagram.com/aspect_maintenance/"
                      aria-label="Instagram"
                      style={socialCircleStyle}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9A4.5 4.5 0 0 1 16.5 21h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 16.2A4.2 4.2 0 1 0 12 7.8a4.2 4.2 0 0 0 0 8.4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M17.6 6.4h.01"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </a>

                    <a
                      href="https://linkedin.com/company/aspect-maintenance-ltd"
                      aria-label="LinkedIn"
                      style={socialCircleStyle}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M6.5 9.5H4V20h2.5V9.5ZM5.25 4C4.56 4 4 4.56 4 5.25S4.56 6.5 5.25 6.5 6.5 5.94 6.5 5.25 5.94 4 5.25 4ZM20 20h-2.5v-5.7c0-1.36-.03-3.1-1.9-3.1-1.9 0-2.2 1.48-2.2 3v5.8H10.9V9.5h2.4v1.43h.03c.33-.62 1.16-1.28 2.4-1.28 2.56 0 3.03 1.69 3.03 3.88V20Z"
                          fill="currentColor"
                        />
                      </svg>
                    </a>
                  </div>

                  {/* ✅ Use footer logo image instead of yellow "A" patch */}
                  <img
                    src="/logofooter.png"
                    alt="Aspect"
                    style={{
                      marginTop: 8,
                      width: 170,
                      height: "auto",
                      display: "block",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 30, height: 1, background: "rgba(241,255,40,0.65)" }} />

              {/* ✅ Left-align phone + address under © Aspect 2026 */}
              <div
                style={{
                  marginTop: 18,
                  paddingBottom: 22,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div style={{ fontWeight: 700, opacity: 0.95 }}>© Aspect 2026</div>

                <a
                  href="tel:02035145635"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "14px 22px",
                    borderRadius: 10,
                    background: "#F1FF28",
                    color: "#285193",
                    fontWeight: 900,
                    textDecoration: "none",
                    width: "fit-content",
                  }}
                >
                  020 3514 5635
                </a>

                <div style={{ fontWeight: 600, opacity: 0.92, lineHeight: 1.55, maxWidth: 720 }}>
                  Aspect Maintenance Services Limited, E7 Barwell Business Park, Leatherhead Road, Chessington, London,
                  KT9 2NY
                </div>
              </div>
            </div>

            {/* Bottom bar with NO padding (left/right/bottom) — full width */}
            <div style={{ width: "100%", height: 18 }} />
          </footer>
        </>
      ) : (
        <>
          {/* ✅ HEADER SECTION (UNCHANGED) */}
          <div style={pageWrapStyle}>
            <div style={maxRowStyle}>
              <section
                style={{
                  width: "100%",
                  marginTop: 18,
                  borderRadius: 22,
                  overflow: "hidden",
                  backgroundImage: "url(/images/bg_loginpg.jpg)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  minHeight: 420,
                  position: "relative",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background:
                      "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 46%, rgba(0,0,0,0.25) 100%)",
                  }}
                />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ paddingTop: 54, paddingBottom: 34, paddingLeft: 28, paddingRight: 28 }}>
                    <div style={{ maxWidth: 820 }}>
                      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.6, color: "#fff" }}>
                        Knowledge Hub
                      </div>

                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ color: "rgba(255,255,255,0.92)", fontSize: 16 }}>
                          Hi, <strong style={{ color: "#fff" }}>{welcomeFirst || "User"}</strong>
                        </div>

                        {welcomeLine ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.92)",
                              color: "#111",
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {welcomeLine}
                          </span>
                        ) : null}

                        {pendingMode ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(255,210,0,0.95)",
                              color: "#111",
                              fontSize: 13,
                              fontWeight: 800,
                            }}
                          >
                            Limited access
                          </span>
                        ) : null}
                      </div>

                      <div style={{ marginTop: 14, color: "rgba(255,255,255,0.88)", fontSize: 15, maxWidth: 760 }}>
                        Search for a task, issue, or procedure and open the relevant module.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <main className="dash">
            <div style={pageWrapStyle}>
              <div style={maxRowStyle}>
                {/* ✅ Recently viewed (UNCHANGED) */}
                <section className="rv-shell" style={{ marginTop: 18 }}>
                  <div className="rv-left">
                    <div className="rv-title">Recently Viewed</div>
                  </div>

                  <div className="rv-right">
                    <div className="rv-grid">
                      {visibleMyLearning.slice(0, 3).map((entry) => {
                        const c = entry.course;
                        if (!c?.id) return null;

                        const thumb = c.thumbnail_url || "/thumbnails/intro.jpg";
                        const lastVideoId = entry.lastVideoId;
                        const lastVideoTitle = entry.lastVideoTitle;
                        const resumeUrl = lastVideoId ? `/course/${c.id}?v=${lastVideoId}` : `/course/${c.id}`;

                        const views = Number(c?.unique_viewers ?? 0) || 0;
                        const attempted = Number(c?.attempted_times ?? 0) || 0;
                        const completed = Number(c?.completed_times ?? 0) || 0;

                        const tile = (
                          <article className="rv-card">
                            <div className="rv-imgwrap">
                              <img
                                src={thumb}
                                alt={c.title}
                                className="rv-img"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}


                              />
                            </div>

                            <div className="rv-label">
                              <div className="rv-label-row">
                                <div className="rv-course-title" title={c.title}>
                                  {c.title}
                                </div>

                                <div className="rv-arrow" aria-hidden="true">
                                  →
                                </div>
                              </div>

                              <div className="rv-sub" title={lastVideoTitle || ""}>
                                {lastVideoTitle ? lastVideoTitle : "Open module"}
                              </div>

                              <div className="rv-stats" aria-hidden="true" style={{ display: "none" }}>
                                <span>{formatCount(views)} views</span>
                                <span>{formatCount(attempted)} attempts</span>
                                <span>{formatCount(completed)} completed</span>
                              </div>
                            </div>
                          </article>
                        );

                        if (pendingMode) {
                          return (
                            <div key={c.id} onClick={showBlocked} style={{ cursor: "pointer" }}>
                              {tile}
                            </div>
                          );
                        }

                        return (
                          <Link key={c.id} to={resumeUrl} style={{ textDecoration: "none", color: "inherit" }}>
                            {tile}
                          </Link>
                        );
                      })}
                    </div>

                    {visibleMyLearning.length === 0 && <div className="empty-state">No recent modules yet.</div>}
                  </div>
                </section>

                {/* ✅ NEW: Courses (Udemy-style) — NO big rounded container */}
                <section className="ud-courses-strip" style={{ marginTop: 42 }}>
                  <div className="ud-courses-head">
                    <div className="ud-courses-title">Courses</div>
                    <div className="ud-courses-meta">Choose a module to view steps, policies, and procedures</div>
                  </div>

                  <div className="ud-courses-tabs" role="tablist" aria-label="Course categories">
                    <button
                      type="button"
                      className={`ud-tab ${coursesTab === "trades" ? "is-active" : ""}`}
                      onClick={() => setCoursesTab("trades")}
                      role="tab"
                      aria-selected={coursesTab === "trades"}
                    >
                      Trades
                    </button>

                    <button
                      type="button"
                      className={`ud-tab ${coursesTab === "office" ? "is-active" : ""}`}
                      onClick={() => setCoursesTab("office")}
                      role="tab"
                      aria-selected={coursesTab === "office"}
                    >
                      Office Staff
                    </button>

                    <button
                      type="button"
                      className={`ud-tab ${coursesTab === "field" ? "is-active" : ""}`}
                      onClick={() => setCoursesTab("field")}
                      role="tab"
                      aria-selected={coursesTab === "field"}
                    >
                      Field Engineers
                    </button>
                  </div>

                  <div className="ud-courses-divider" />

                  <div className="learning-row" style={{ marginTop: 18 }}>
                    {(groupedGuides[coursesTab] || []).map((c) => (
                      <CourseCard key={c.id} course={c} locked={pendingMode} onLockedClick={showBlocked} />
                    ))}

                    {(groupedGuides[coursesTab] || []).length === 0 && (
                      <div className="empty-state" style={{ padding: "12px 0" }}>
                        No modules in this section yet.
                      </div>
                    )}
                  </div>

                  {!hasAnyGuides && (
                    <div className="empty-state" style={{ paddingTop: 12 }}>
                      No modules available yet. Create modules in Django admin and publish them.
                    </div>
                  )}
                </section>

                {/* ✅ Selected courses (UNCHANGED) */}
                {hasSelection && (
                  <section style={{ ...roundedBoxStyle, marginTop: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                      <div style={pillStyle}>◉ Selected</div>
                      <div style={{ height: 1, flex: 1, background: "rgba(0,0,0,0.08)" }} />
                    </div>

                    <div className="section-head">
                      <div className="section-meta" style={{ color: "rgba(0,0,0,0.62)" }}>
                        Showing modules for your selected category/subcategory
                      </div>
                    </div>

                    <div className="learning-row">
                      {selectedCourses.map((c) => (
                        <CourseCard key={`sel-${c.id}`} course={c} locked={pendingMode} onLockedClick={showBlocked} />
                      ))}

                      {selectedCourses.length === 0 && (
                        <div className="empty-state">No modules found for that selection yet.</div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </main>

          {/* ✅ FULL-WIDTH FOOTER (NEW) — end-to-end, no left/right/bottom padding; all items are links */}
          <footer
            style={{
              width: "100%",
              background: " #26549D",
              color: "#fff",
              marginTop: 60,
              padding: 0,
            }}
          >
            <div style={{ maxWidth: 1440, margin: "0 auto", padding: "46px 56px 0" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
                  gap: 34,
                  alignItems: "start",
                }}
              >
                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Information
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/blog/" style={footerLinkStyle}>
                      Blog
                    </a>
                    <a href="https://www.aspect.co.uk/video-posts/" style={footerLinkStyle}>
                      Video posts
                    </a>
                    <a href="https://www.aspect.co.uk/local-to-you/" style={footerLinkStyle}>
                      Local to you
                    </a>
                    <a href="https://www.aspect.co.uk/reviews/" style={footerLinkStyle}>
                      Reviews
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Company
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/our-guarantee/" style={footerLinkStyle}>
                      Our guarantee
                    </a>
                    <a href="https://www.aspect.co.uk/accreditations/" style={footerLinkStyle}>
                      Accreditations
                    </a>
                    <a href="https://www.aspect.co.uk/recruitment/" style={footerLinkStyle}>
                      Careers
                    </a>
                    <a href="https://www.aspect.co.uk/about-us/" style={footerLinkStyle}>
                      About us
                    </a>
                    <a href="https://www.aspect.co.uk/contact-us/" style={footerLinkStyle}>
                      Contact us
                    </a>
                    <a href="https://www.aspect.co.uk/sitemap/" style={footerLinkStyle}>
                      Sitemap
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Our Services
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/trades/plumbing-and-cold-water/" style={footerLinkStyle}>
                      Plumbing
                    </a>
                    <a href="https://www.aspect.co.uk/trades/electrics/" style={footerLinkStyle}>
                      Electrics
                    </a>
                    <a href="https://www.aspect.co.uk/trades/heating-hot-water/" style={footerLinkStyle}>
                      Heating
                    </a>
                    <a href="https://www.aspect.co.uk/trades/damp-leaks/" style={footerLinkStyle}>
                      Damp and Leaks
                    </a>
                    <a href="https://www.aspect.co.uk/trades/drainage-services/" style={footerLinkStyle}>
                      Drainage Services
                    </a>
                    <a href="https://www.aspect.co.uk/trades/roofing/" style={footerLinkStyle}>
                      Roofing
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Other Services
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/trades/handyman-odd-jobs/" style={footerLinkStyle}>
                      Handyman
                    </a>
                    <a
                      href="https://www.aspect.co.uk/trades/air-conditioning-refrigeration/"
                      style={footerLinkStyle}
                    >
                      Air Conditioning
                    </a>
                    <a href="https://www.aspect.co.uk/trades/carpentry/" style={footerLinkStyle}>
                      Carpentry
                    </a>
                    <a href="https://www.aspect.co.uk/trades/painting-decorating/" style={footerLinkStyle}>
                      Painting and Decorating
                    </a>
                    <a href="https://www.aspect.co.uk/trades/pest-control/" style={footerLinkStyle}>
                      Pest Control
                    </a>
                    <a href="https://www.aspect.co.uk/trades/gardening/" style={footerLinkStyle}>
                      Gardening
                    </a>
                  </div>
                </div>

                <div>
                  <a href="https://www.aspect.co.uk/#" style={{ ...footerHeadStyle, textDecoration: "none" }}>
                    Legals
                  </a>
                  <div style={footerLinksWrapStyle}>
                    <a href="https://www.aspect.co.uk/terms-and-conditions/" style={footerLinkStyle}>
                      Terms and conditions
                    </a>
                    <a href="https://www.aspect.co.uk/privacy-policy/" style={footerLinkStyle}>
                      Privacy policy
                    </a>
                    <a href="https://www.aspect.co.uk/#" style={footerLinkStyle}>
                      Cookie policy
                    </a>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                  <div style={footerHeadStyle}>Social</div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <a href="https://www.facebook.com/aspect.co.uk" aria-label="Facebook" style={socialCircleStyle}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M14 8.5V7.2c0-1 .8-1.7 1.7-1.7H17V3h-1.6C12.9 3 11 4.9 11 7.4V8.5H9v3h2V21h3v-9.5h2.4l.6-3H14Z"
                          fill="currentColor"
                        />
                      </svg>
                    </a>

                    <a
                      href="https://www.instagram.com/aspect_maintenance/"
                      aria-label="Instagram"
                      style={socialCircleStyle}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9A4.5 4.5 0 0 1 16.5 21h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 16.2A4.2 4.2 0 1 0 12 7.8a4.2 4.2 0 0 0 0 8.4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M17.6 6.4h.01"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </a>

                    <a
                      href="https://linkedin.com/company/aspect-maintenance-ltd"
                      aria-label="LinkedIn"
                      style={socialCircleStyle}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M6.5 9.5H4V20h2.5V9.5ZM5.25 4C4.56 4 4 4.56 4 5.25S4.56 6.5 5.25 6.5 6.5 5.94 6.5 5.25 5.94 4 5.25 4ZM20 20h-2.5v-5.7c0-1.36-.03-3.1-1.9-3.1-1.9 0-2.2 1.48-2.2 3v5.8H10.9V9.5h2.4v1.43h.03c.33-.62 1.16-1.28 2.4-1.28 2.56 0 3.03 1.69 3.03 3.88V20Z"
                          fill="currentColor"
                        />
                      </svg>
                    </a>
                  </div>

                  
                  <img
                    src="/logofooter.png"
                    alt="Aspect"
                    style={{
                      marginTop: 8,
                      width: 170,
                      height: "auto",
                      display: "block",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 30, height: 1, background: "rgba(241,255,40,0.65)" }} />

              {/* ✅ Left-align phone + address under © Aspect 2026 */}
              <div
                style={{
                  marginTop: 18,
                  paddingBottom: 22,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div style={{ fontWeight: 400, opacity: 0.95 }}>© Aspect 2026</div>

                <a
                  href="tel:02035145635"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "14px 22px",
                    borderRadius: 10,
                    background: "#F1FF28",
                    color:  "#26549D",
                    fontWeight: 900,
                    textDecoration: "none",
                    width: "fit-content",
                  }}
                >
                  020 3514 5635
                </a>

                <div style={{ fontWeight: 600, opacity: 0.92, lineHeight: 1.55, maxWidth: 720 }}>
                  Aspect Maintenance Services Limited, E7 Barwell Business Park, Leatherhead Road, Chessington, London,
                  KT9 2NY
                </div>
              </div>
            </div>

            {/* bottom edge-to-edge bar (no padding) */}
            <div style={{ width: "100%", height: 18 }} />
          </footer>
        </>
      )}
    </div>
  );
}
