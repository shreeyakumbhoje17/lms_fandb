import { Link } from "react-router-dom";

export default function LandingHeader() {
  return (
    <header className="ud-header">
      <div className="ud-header-inner">
        <div className="ud-left">
          <img src="/logo.png" alt="Aspect University Logo" className="ud-logo-img" />
        </div>

        <div className="ud-search" role="search">
          <span className="ud-search-icon" aria-hidden="true">🔎</span>
          <input type="text" placeholder="Search for anything" aria-label="Search for anything" />
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

          <a className="ud-link" href="http://127.0.0.1:8000/">
            Aspect Learning
          </a>
        </nav>

        <div className="ud-actions">
          <Link to="/login">
            <button className="ud-btn nav-login-btn"  type="button">Log in</button>
          </Link>
          <button className="ud-icon-btn" aria-label="Language" type="button">🌐</button>
        </div>
      </div>
    </header>
  );
}
