import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="ud-hero">
      {/* Promo image acts as the section container */}
      <div
        className="ud-hero-inner"
        style={{
          backgroundImage: "url(/promo.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderRadius: 18,
          padding: 20,
          position: "relative",
        }}
      >
        {/* Keep the card exactly where it was */}
        <div className="ud-hero-card">
          <h1 className="ud-hero-title">Welcome to Aspect University</h1>
          <p className="ud-hero-subtitle">
            Internal learning portal. Log in with your company email to access your training.
          </p>
          <Link to="/login">
            <button className="ud-btn ud-btn-solid ud-btn-lg" type="button">
              Log in to start
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
