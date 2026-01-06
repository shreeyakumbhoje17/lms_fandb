import { useEffect, useRef, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useNavigate, Link } from "react-router-dom";

import MyLearningPop from "./MyLearningPop";
import WishlistPop from "./WishlistPop";
import { apiFetch } from "../../api";

function getInitials(user) {
  const f = (user?.first_name || "").trim();
  const l = (user?.last_name || "").trim();

  if (f || l) {
    return `${f.slice(0, 1) || ""}${l.slice(0, 1) || ""}`.toUpperCase() || "US";
  }

  // fallback: from email
  const email = (user?.email || "").trim();
  if (email) return email.slice(0, 2).toUpperCase();

  return "US";
}

export default function DashboardHeader({ user, pendingMode = false, onBlockedAction }) {
  const initials = getInitials(user);

  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const [navItems, setNavItems] = useState([]);
  const [navError, setNavError] = useState("");

  // dropdown control for category strip
  const [openCat, setOpenCat] = useState(null);
  const closeTimer = useRef(null);

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
        setNavItems(Array.isArray(data.items) ? data.items : []);
        setNavError("");
      } catch (e) {
        setNavError(String(e));
        setNavItems([]);
      }
    }
    loadNav();
  }, []);

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

  if (!isAuthenticated) return null;

  return (
    <header className="ud-header">
      <div className="ud-header-inner">
        <div className="ud-left">
          <img src="/logo.png" alt="Aspect University Logo" className="ud-logo-img" />
          {/* ✅ Explore removed */}
        </div>

        <div className="ud-search" role="search">
          <span className="ud-search-icon" aria-hidden="true">🔎</span>
          <input type="text" placeholder="Search for anything" aria-label="Search for anything" />
        </div>

        <nav className="ud-nav" aria-label="Primary">
          <a
            className="ud-link ud-link-small"
            href="https://www.aspect.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Aspect Business
          </a>

          {/* ✅ My learning back */}
          <MyLearningPop pendingMode={pendingMode} onBlockedAction={onBlockedAction} />
        </nav>

        <div className="ud-actions">
          {/* ✅ Heart dropdown (same style behavior as MyLearningPop) */}
          <WishlistPop pendingMode={pendingMode} onBlockedAction={onBlockedAction} />

          {/* PROFILE DROPDOWN */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="ud-profile-bubble" title={user.email ?? "Profile"} style={{ cursor: "pointer" }}>
              {initials}
            </div>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  width: 300,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.12)",
                  padding: 12,
                  zIndex: 9999,
                }}
              >
                <div style={{ padding: "6px 8px", fontSize: 13, color: "#6a6f73" }}>
                  {user.email ?? "Signed in"}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "90%",
                    height: 44,
                    borderRadius: 10,
                    border: "none",
                    background: "#244a9b",
                    color: "#e6ff2a",
                    fontWeight: 900,
                    cursor: "pointer",
                    marginTop: 10,
                    textShadow: "0 0 8px rgba(230,255,42,0.7)",
                  }}
                >
                  Log Out
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
                key={cat.label}
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
                      {cat.sub.map((item) =>
                        pendingMode ? (
                          <button
                            key={item.label}
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
                            {item.label}
                          </button>
                        ) : (
                          <Link
                            className="ud-mega-link"
                            key={item.label}
                            to={item.to}
                            onClick={() => setOpenCat(null)}
                          >
                            {item.label}
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
