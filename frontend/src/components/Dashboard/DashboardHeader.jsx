import { useEffect, useRef, useState, useMemo } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useNavigate, Link } from "react-router-dom";

import MyLearningPop from "./MyLearningPop";
import { apiFetch } from "../../api";

function pickNameParts(user) {
  const first = (user?.first_name || "").trim();
  const last = (user?.last_name || "").trim();

  if (first || last) return { first, last };

  const display = (user?.display_name || user?.displayName || user?.name || "").trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    return {
      first: parts[0] || "",
      last: parts.length > 1 ? parts[parts.length - 1] : "",
    };
  }

  const email = (user?.email || "").trim();
  if (email) {
    const local = email.split("@")[0] || "";
    const chunks = local.split(/[._-]+/).filter(Boolean);
    return {
      first: chunks[0] || "",
      last: chunks.length > 1 ? chunks[chunks.length - 1] : "",
    };
  }

  return { first: "", last: "" };
}

function getInitials(user) {
  const { first, last } = pickNameParts(user);

  const f = (first || "").trim();
  const l = (last || "").trim();

  const email = (user?.email || "").trim();
  let inferredLast = "";
  if (email) {
    const local = (email.split("@")[0] || "").trim();
    const chunks = local.split(/[._-]+/).filter(Boolean);
    inferredLast = chunks.length > 1 ? chunks[chunks.length - 1] : "";
  }

  const finalLast = l.length <= 1 && inferredLast ? inferredLast : l;

  if (f || finalLast) {
    const a = (f.slice(0, 1) || "").toUpperCase();
    const b = (finalLast.slice(0, 1) || "").toUpperCase();
    return (a + b) || "US";
  }

  if (email) return email.slice(0, 2).toUpperCase();
  return "US";
}

export default function DashboardHeader({
  user,
  pendingMode = false,
  onBlockedAction,
  searchQuery = "",
  onSearchChange,
}) {
  const initials = useMemo(() => getInitials(user), [user]);

  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const [navItems, setNavItems] = useState([]);
  const [navError, setNavError] = useState("");

  const [openCat, setOpenCat] = useState(null);
  const closeTimer = useRef(null);

  // ✅ Trainer gate (now sourced from /api/me/ via user.can_upload)
  const [canUpload, setCanUpload] = useState(false);
  const [trainerStatusLoaded, setTrainerStatusLoaded] = useState(false);

  useEffect(() => {
    async function loadNav() {
      try {
        const res = await apiFetch("/api/navigation/");
        if (!res.ok) {
          const text = await res.text();
          setNavError(text || `Failed to load navigation (${res.status})`);
          setNavItems([]);
          return;
        }
        const data = await res.json();
        setNavItems(Array.isArray(data.categories) ? data.categories : []);
        setNavError("");
      } catch (e) {
        setNavError(String(e));
        setNavItems([]);
      }
    }
    loadNav();
  }, []);

  // ✅ PERMANENT: use backend /api/me/ as single source of truth
  useEffect(() => {
    setCanUpload(!!user?.can_upload);
    setTrainerStatusLoaded(true);
  }, [user?.can_upload]);

  function openDropdown(label) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenCat(label);
  }

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenCat(null), 140);
  }

  async function handleLogout() {
    try {
      setMenuOpen(false);
      await instance.logoutRedirect({
        postLogoutRedirectUri: `${window.location.origin}/login`,
      });
    } catch (e) {
      console.error("Logout failed:", e);
      navigate("/login");
    }
  }

  function handleUploadClick() {
    // Pending mode blocks everyone
    if (pendingMode) {
      onBlockedAction?.();
      return;
    }

    // Trainers-only gate
    if (!canUpload) {
      // if status hasn't loaded yet, still show blocked toast
      onBlockedAction?.();
      return;
    }

    navigate("/upload");
  }

  if (!isAuthenticated) return null;

  const uploadDisabled = pendingMode || !canUpload;

  return (
    <header className="ud-header">
      <div className="ud-header-inner">
        <div className="ud-left">
          <img src="/logo.png" alt="Aspect" className="ud-logo-img" />
        </div>

        <div className="ud-search" role="search">
          <span className="ud-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 18.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16.5 16.5 21 21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search guides, procedures, issues…"
            aria-label="Search guides, procedures, issues"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>

        {/* ✅ UPLOAD button (trainers only) */}
        <button
          type="button"
          onClick={handleUploadClick}
          title={
            pendingMode
              ? "Waiting for Admin Access.."
              : !trainerStatusLoaded
              ? "Checking permissions..."
              : !canUpload
              ? "Trainers only"
              : "Upload / Create content"
          }
          style={{
            marginLeft: 12,
            marginRight: 12,
            height: 38,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "#285193", 
            color: "#F1FF28", 
            fontWeight: 900,
            letterSpacing: 0.6,
            cursor: uploadDisabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            userSelect: "none",
            whiteSpace: "nowrap",
            opacity: uploadDisabled ? 0.45 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path
              d="M7 9l5-5 5 5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M4 20h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          UPLOAD
        </button>

        <nav className="ud-nav" aria-label="Primary">
          <a
            className="ud-link ud-link-small"
            href="https://www.aspect.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Aspect Business
          </a>

          <MyLearningPop pendingMode={pendingMode} onBlockedAction={onBlockedAction} />
        </nav>

        <div className="ud-actions">
          <div
            className="ud-profile-wrap"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="ud-profile-bubble" title={user?.email ?? "Profile"} style={{ cursor: "pointer" }}>
              {initials}
            </div>

            {menuOpen && (
              <div className="ud-profile-menu">
                <div className="ud-profile-email">{user?.email ?? "Signed in"}</div>

                <button type="button" onClick={handleLogout} className="ud-logout-btn">
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CATEGORY STRIP */}
      <div className="ud-catbar">
        <div className="ud-catbar-inner">
          {navError && (
            <div style={{ padding: 10, color: "#b00020", fontWeight: 800 }}>
              {navError}
            </div>
          )}

          {navItems.map((cat) => {
            const isOpen = openCat === cat.label;

            return (
              <div
                className="ud-cat-item"
                key={cat.key || cat.label}
                onMouseEnter={() => openDropdown(cat.label)}
                onMouseLeave={scheduleClose}
                style={{ position: "relative" }}
              >
                <button
                  type="button"
                  className="ud-cat"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                  onClick={() => {
                    if (pendingMode) onBlockedAction?.();
                    else setOpenCat(isOpen ? null : cat.label);
                  }}
                >
                  {cat.label} ▾
                </button>

                {isOpen && (
                  <div
                    className="ud-megabar"
                    onMouseEnter={() => openDropdown(cat.label)}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="ud-megabar-inner">
                      {(cat.subcategories || []).map((sub) =>
                        pendingMode ? (
                          <button
                            key={sub.key || sub.label}
                            type="button"
                            className="ud-mega-link"
                            onClick={onBlockedAction}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            {sub.label}
                          </button>
                        ) : (
                          <Link
                            className="ud-mega-link"
                            key={sub.key || sub.label}
                            to={`/dashboard?category=${encodeURIComponent(cat.key)}&subcategory=${encodeURIComponent(
                              sub.key
                            )}`}
                            onClick={() => setOpenCat(null)}
                          >
                            {sub.label}
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
