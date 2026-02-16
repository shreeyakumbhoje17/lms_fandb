import { Link } from "react-router-dom";

export default function LandingHeader() {
  return (
    <header className="ud-header">
      <div className="ud-header-inner">
        <div className="ud-left">
          <img src="/logo.png" alt="Aspect University Logo" className="ud-logo-img" />
        </div>

        

        <nav className="ud-nav">
          <a
            className="ud-link ud-link-small"
            href="https://www.aspect.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Aspect Business
          </a>

          
        </nav>

        <div className="ud-actions">
          <Link to="/login">
            <button className="ud-btn nav-login-btn" type="button">Log in</button>
          </Link>

          <button className="ud-icon-btn" aria-label="Language" type="button">🌐</button>
        </div>
      </div>
    </header>
  );
}
