import "../styles/login.css";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/msalConfig"; // ✅ use your backend API scope

export default function Login() {
  const { instance } = useMsal();

  async function handleMicrosoftLogin() {
    try {
      await instance.loginRedirect({
        ...loginRequest, // ✅ scopes: api://.../access_as_user
        prompt: "select_account",
      });
    } catch (e) {
      console.error("Microsoft login failed:", e);
      alert("Microsoft login failed. Check console for details.");
    }
  }

  return (
    <main className="auth">
      {/* LEFT: IMAGE */}
      <section className="auth-left" aria-hidden="true">
        <div
          className="auth-left-bg"
          style={{ backgroundImage: "url('/images/bg_loginpg.jpg')" }}
        />
        <div className="auth-left-overlay" />
      </section>

      {/* RIGHT: PANEL */}
      <section className="auth-right">
        <div className="auth-panel">
          <h1 className="auth-title">Log in</h1>
          <p className="auth-subtitle">
            Use your company Microsoft account to access your training.
          </p>

          <div className="auth-form">
            <button
              className="auth-submit"
              type="button"
              onClick={handleMicrosoftLogin}
            >
              Login with Microsoft
            </button>

            <div className="auth-row" style={{ justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: "#6a6f73" }}>
                You’ll be redirected to Microsoft to sign in.
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
