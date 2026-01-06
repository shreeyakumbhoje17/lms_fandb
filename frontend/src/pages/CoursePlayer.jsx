import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";

export default function CoursePlayer() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourse() {
      try {
        const token = localStorage.getItem("access");
        if (!token) {
          setError("No access token found. Please log in again.");
          return;
        }

        const res = await apiFetch(`/api/courses/${courseId}/`);

        if (!res.ok) {
          const text = await res.text();

          if (res.status === 401) {
            setError("Session expired. Please log in again.");
          } else {
            setError(text);
          }
          return;
        }

        const data = await res.json();
        setCourse(data);
        setActiveIndex(0);
      } catch (e) {
        setError(String(e));
      }
    }

    loadCourse();
  }, [courseId]);

  if (error) return <div style={{ padding: 20 }}>Error: {error}</div>;
  if (!course) return <div style={{ padding: 20 }}>Loading course...</div>;

  const videos = course.videos ?? [];
  const activeVideo = videos[activeIndex];

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 6 }}>{course.title}</h1>
      <p style={{ marginBottom: 16, color: "#6a6f73" }}>{course.description}</p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          {activeVideo ? (
            <iframe
              src={activeVideo.embed_url}
              title={activeVideo.video_title}
              frameBorder="0"
              allowFullScreen
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div style={{ color: "#fff", padding: 16 }}>No videos in this course yet.</div>
          )}
        </div>

        <div
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <h3 style={{ marginBottom: 10 }}>Lessons</h3>

          {videos.length === 0 ? (
            <div style={{ color: "#6a6f73" }}>Add videos in Django admin.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {videos.map((v, idx) => (
                <button
                  key={v.order}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  style={{
                    color: "#000", // ✅ FIXED: text now black
                    textAlign: "left",
                    padding: "10px 10px",
                    borderRadius: 10,
                    border: idx === activeIndex ? "2px solid #244a9b" : "1px solid rgba(0,0,0,0.15)",
                    background: idx === activeIndex ? "rgba(36,74,155,0.08)" : "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {v.order}. {v.video_title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
