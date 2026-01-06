import "../styles/dashboard/main.css";
import "../styles/dashboard/navigation.css";
import "../styles/dashboard/popups.css";
import "../styles/dashboard/responsive.css";

import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "../components/Dashboard/DashboardHeader";
import CourseCard from "../components/Dashboard/CourseCard";
import { apiFetch } from "../api";

function normalizeRole(role) {
  if (!role) return null;
  if (role === "field_engineer") return "field";
  return role; // "field" | "office"
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  function showBlocked() {
    setToast("Waiting for Admin Access..");
    window.clearTimeout(window.__dashToastTimer);
    window.__dashToastTimer = window.setTimeout(() => setToast(""), 2000);
  }

  // ✅ user from Django (source of truth)
  useEffect(() => {
    async function loadMe() {
      try {
        const res = await apiFetch("/api/me/");
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Failed to load /api/me/ (${res.status}). Please login again.`);
          return;
        }
        const data = await res.json();
        setUser(data);
      } catch (e) {
        setError(String(e));
      }
    }
    loadMe();
  }, []);

  // ✅ courses from Django
  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await apiFetch("/api/courses/");
        if (!res.ok) {
          const text = await res.text();
          setError(text || `Failed to load /api/courses/ (${res.status})`);
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

  const role = useMemo(() => normalizeRole(user?.role), [user]);
  const pendingMode = role === null;

  // ✅ filter courses by role
  const visibleCourses = useMemo(() => {
    if (pendingMode) return courses; // pending sees all, but locked
    if (role === "field") return courses.filter((c) => c.track === "field");
    return courses; // office sees all
  }, [courses, role, pendingMode]);

  // cards count for the bottom section
  const cardCount = pendingMode ? 6 : role === "office" ? 6 : 3;

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!user) return <div style={{ padding: 20 }}>Loading user...</div>;

  const initials =
    (user.first_name?.slice(0, 1) ?? "U") + (user.last_name?.slice(0, 1) ?? "S");

  return (
    <div className="ud-body">
      <DashboardHeader user={user} pendingMode={pendingMode} onBlockedAction={showBlocked} />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 800,
            zIndex: 99999,
          }}
        >
          {toast}
        </div>
      )}

      <main className="dash">
        <div className="dash-container">
          {/* ✅ WELCOME SECTION (restored) */}
          <section className="welcome">
            <div className="welcome-left">
              <div className="welcome-avatar">{initials}</div>

              <div className="welcome-text">
                <h1 className="welcome-title">
                  Welcome back,{" "}
                  <span className="welcome-name">{user.first_name ?? "User"}</span>
                </h1>

                <div className="welcome-sub">
                  <span className="welcome-role">
                    {pendingMode
                      ? "Pending Access"
                      : role === "office"
                      ? "Office Staff"
                      : "Field Engineer"}
                  </span>

                  
                </div>
              </div>
            </div>
          </section>

          {/* ✅ PROMO BANNER (restored) */}
          <section className="promo">
            

            <div className="promo-card">
              <h2>Start Learning Today</h2>
              <p className="ud-section-text">
                Welcome to your company’s dedicated learning platform. Access structured training
                programs designed to enhance skills, boost productivity, and support professional
                growth across teams.
              </p>
            </div>

            <div className="promo-bg" aria-hidden="true" />

            
          </section>

          {/* ✅ AVAILABLE COURSES (restored area) */}
          <section className="learning">
            <div className="learning-head">
              <h2 className="learning-title">Available Courses</h2>

              
            </div>

            <div className="learning-row">
              {visibleCourses.slice(0, cardCount).map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  locked={pendingMode}
                  onLockedClick={showBlocked}
                />
              ))}

              {visibleCourses.length === 0 && (
                <div style={{ color: "#6a6f73" }}>
                  No courses found. Create courses in Django admin and publish them.
                </div>
              )}
            </div>
          </section>

          {/* (rest of your sections can stay here as-is, if you have more) */}
        </div>
      </main>
    </div>
  );
}
