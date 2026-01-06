import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="ud-hero">
      <div className="ud-hero-inner">
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

        <div className="ud-hero-visual" aria-hidden="true">
          <img src="/peoplerb.png" alt="" className="ud-hero-img" />
        </div>
      </div>
    </section>
  );
}
