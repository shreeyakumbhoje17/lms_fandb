import { Link } from "react-router-dom";

export default function CourseCard({ course, locked = false, onLockedClick }) {
  // ✅ Make thumbnail absolute to Django backend
  const BACKEND = "http://127.0.0.1:8000";
  const thumb = course.thumbnail_url?.startsWith("/static/")
    ? `${BACKEND}${course.thumbnail_url}`
    : course.thumbnail_url;

  const card = (
    <article
      className="course-card"
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        background: "#fff",
        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        transition: "transform 0.2s",
        position: "relative",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onClick={locked ? onLockedClick : undefined}
      role={locked ? "button" : undefined}
      tabIndex={locked ? 0 : undefined}
      onKeyDown={
        locked
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onLockedClick?.();
            }
          : undefined
      }
    >
      {locked && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            zIndex: 2,
          }}
        >
          🔒 Locked
        </div>
      )}

      {/* ✅ Thumbnail now uses backend absolute URL */}
      <div
        className="course-thumb"
        style={{
          width: "100%",
          height: 135,
          backgroundImage: thumb ? `url(${thumb})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: locked ? "grayscale(35%)" : "none",
          opacity: locked ? 0.85 : 1,
        }}
      />

      <div className="course-body" style={{ padding: 14 }}>
        <div className="course-name" style={{ fontWeight: 800, fontSize: 15, color: "#000" }}>
          {course.title}
        </div>

        {locked && (
          <div style={{ fontSize: 12, color: "#6a6f73", fontWeight: 700, marginTop: 6 }}>
            Waiting for Admin Access..
          </div>
        )}
      </div>
    </article>
  );

  // Locked cards should NOT navigate
  if (locked) return card;

  return (
    <Link to={`/course/${course.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  );
}
