import { Link } from "react-router-dom";
import "../../styles/coursecard.css";

/* ✅ helper to format large counts like 1.2K / 2.3M */
function formatCount(n) {
  if (n == null) return "0";
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  if (num < 1_000) return String(num);
  if (num < 1_000_000) return `${(num / 1_000).toFixed(num < 10_000 ? 1 : 0)}K`;
  if (num < 1_000_000_000) return `${(num / 1_000_000).toFixed(num < 10_000_000 ? 1 : 0)}M`;
  return `${(num / 1_000_000_000).toFixed(1)}B`;
}

/* ✅ best-effort creator extraction */
function getCreatorName(course) {
  const candidates = [
    course?.creator_name,
    course?.creator,
    course?.author,
    course?.instructor,
    course?.created_by_name,
    course?.created_by?.name,
    course?.created_by?.display_name,
    course?.created_by?.email,
  ];

  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s) return s;
  }
  return "Aspect University";
}

export default function CourseCard({ course, locked = false, onLockedClick }) {
  const FALLBACK_THUMB = "/thumbnails/intro.jpg";

  const initialThumb =
    course?.thumbnail_url && typeof course.thumbnail_url === "string"
      ? course.thumbnail_url
      : FALLBACK_THUMB;

  const creatorName = getCreatorName(course);

  const views = Number(course?.unique_viewers ?? 0) || 0;
  const attempted = Number(course?.attempted_times ?? 0) || 0;
  const completed = Number(course?.completed_times ?? 0) || 0;

  const card = (
    <article
      className={`ud-course-card ${locked ? "ud-course-card-locked" : ""}`}
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
      {locked && <div className="ud-course-lock">Locked</div>}

      <div className="ud-course-thumb">
        <img
          src={initialThumb}
          alt={course.title}
          className="ud-course-thumb-img"
          onError={(e) => {
            // ✅ graceful fallback (no hiding, no infinite retries)
            if (e.currentTarget.src !== FALLBACK_THUMB) {
              e.currentTarget.src = FALLBACK_THUMB;
            }
          }}
        />
      </div>

      <div className="ud-course-body">
        <div className="ud-course-title" title={course.title}>
          {course.title}
        </div>

        {course?.description ? (
          <div className="ud-course-desc" title={course.description}>
            {course.description}
          </div>
        ) : (
          <div className="ud-course-desc ud-course-desc-muted">Open module</div>
        )}

        <div className="ud-course-creator" title={creatorName}>
          {creatorName}
        </div>

        <div className="ud-course-metrics">
          <span className="ud-metric" title="Views">
            {formatCount(views)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7Z"
                fill="currentColor"
              />
              <circle cx="12" cy="12" r="3" fill="#fff" />
            </svg>
          </span>

          <span className="ud-metric" title="Attempts">
            {formatCount(attempted)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M17 2v4h-4" stroke="currentColor" strokeWidth="2" />
              <path d="M7 22v-4h4" stroke="currentColor" strokeWidth="2" />
              <path d="M21 12a9 9 0 0 0-15.5-6.36L3 8" stroke="currentColor" strokeWidth="2" />
              <path d="M3 12a9 9 0 0 0 15.5 6.36L21 16" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>

          <span className="ud-metric" title="Completed">
            {formatCount(completed)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );

  if (locked) return card;

  return (
    <Link to={`/course/${course.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  );
}
