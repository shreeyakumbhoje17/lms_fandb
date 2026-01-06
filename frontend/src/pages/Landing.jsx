import "../styles/landing.css";
import { useNavigate } from "react-router-dom";
import LandingHeader from "../components/Landing/LandingHeader";
import LandingHero from "../components/Landing/LandingHero";
import WhyChoose from "../components/Landing/Landing_WhyChoose";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="ud-body">
      {/* If your header already has a login button, you can remove this extra one */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px" }}>
        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </div>

      <LandingHeader />
      <LandingHero />
      <WhyChoose />
    </div>
  );
}
