export default function Toast({ message }) {
  if (!message) return null;

  return (
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
      {message}
    </div>
  );
}
