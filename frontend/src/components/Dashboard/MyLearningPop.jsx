import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api";

export default function MyLearningPop({ pendingMode = false, onBlockedAction }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setErr("");
        const res = await apiFetch("/api/my-learning/");
        if (!res.ok) {
          setItems([]);
          return;
        }
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(String(e));
        setItems([]);
      }
    }
    load();
  }, []);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="ud-link ud-link-small"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
        onClick={() => {
          if (pendingMode) onBlockedAction?.();
          else setOpen((v) => !v);
        }}
      >
        My Learning ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "120%",
            width: 320,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 12,
            boxShadow: "0 16px 40px rgba(0,0,0,0.12)",
            padding: 10,
            zIndex: 9999,
          }}
        >
          <div style={{ fontWeight: 900, padding: "6px 8px", color: "#111" }}>
            Recent Courses
          </div>

          {pendingMode ? (
            <button
              type="button"
              onClick={onBlockedAction}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                padding: "10px 8px",
                cursor: "pointer",
                color: "#6a6f73",
                fontWeight: 800,
              }}
            >
              Waiting for Admin Access…
            </button>
          ) : items.slice(0, 3).length ? (
            <div style={{ display: "grid", gap: 8, padding: "6px 4px 4px" }}>
              {items.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  to={`/course/${c.id}`}
                  onClick={() => setOpen(false)}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "grid",
                    gridTemplateColumns: "64px 1fr",
                    gap: 10,
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 44,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#f3f4f6",
                      position: "relative",
                    }}
                  >
                    <img
                      src={c.thumbnail_url || "/thumbnails/intro.jpg"}
                      alt={c.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => (e.currentTarget.src = "/thumbnails/intro.jpg")}
                    />
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.92)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                          fontSize: 11,
                          border: "1px solid rgba(0,0,0,0.10)",
                        }}
                      >
                        ▶
                      </div>
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 13,
                        fontWeight: 900,
                        color: "#111",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.title}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ padding: "10px 8px", color: "#6a6f73", fontWeight: 700 }}>
              No recent learning yet.
            </div>
          )}

          {err ? (
            <div style={{ padding: "8px", color: "#b00020", fontWeight: 800, fontSize: 12 }}>
              {err}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
