import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";

const API_BASE = ""; // keep empty for vite proxy (/api -> :8000)

export default function AuthCallback() {
  const { instance } = useMsal();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Process redirect (may return null on subsequent loads)
        const result = await instance.handleRedirectPromise();
        console.log("handleRedirectPromise result:", result);

        // 2) Ensure active account
        if (result?.account) {
          instance.setActiveAccount(result.account);
        } else {
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) instance.setActiveAccount(accounts[0]);
        }

        const account = instance.getActiveAccount();
        console.log("active account:", account);

        if (!account) {
          if (!cancelled) navigate("/login", { replace: true });
          return;
        }

        // 3) Get an ID token for backend exchange
        // - Prefer redirect result idToken (only available right after redirect)
        // - Otherwise silently acquire (MSAL cache) to get idToken reliably
        let idToken = result?.idToken || null;

        if (!idToken) {
          try {
            const silent = await instance.acquireTokenSilent({
              account,
              // These scopes are enough to get a valid id_token for the signed-in user.
              // (We are NOT using the accessToken here.)
              scopes: ["openid", "profile", "email"],
            });
            idToken = silent?.idToken || null;
          } catch (e) {
            console.warn("acquireTokenSilent (idToken) failed:", e);
            if (!cancelled) navigate("/login", { replace: true });
            return;
          }
        }

        if (!idToken) {
          console.warn("No idToken available for backend exchange.");
          if (!cancelled) navigate("/login", { replace: true });
          return;
        }

        // 4) Exchange Entra id_token for Django SimpleJWT
        const loginRes = await fetch(`${API_BASE}/api/auth/microsoft/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: idToken }),
        });

        const loginData = await loginRes.json().catch(() => ({}));

        if (!loginRes.ok) {
          console.error("Backend /api/auth/microsoft/ failed:", loginRes.status, loginData);
          if (!cancelled) navigate("/login", { replace: true });
          return;
        }

        const backendAccess = loginData?.access || "";
        const backendRefresh = loginData?.refresh || "";

        if (!backendAccess) {
          console.error("Backend login succeeded but access token missing:", loginData);
          if (!cancelled) navigate("/login", { replace: true });
          return;
        }

        // 5) Store backend tokens (SimpleJWT)
        try {
          localStorage.setItem("access", backendAccess);
          if (backendRefresh) localStorage.setItem("refresh", backendRefresh);
          else localStorage.removeItem("refresh");
        } catch (e) {
          console.warn("localStorage unavailable:", e);
        }

        // Optional: store backend user payload
        if (loginData?.user) {
          try {
            localStorage.setItem("user", JSON.stringify(loginData.user));
          } catch {}
        }

        // 6) Done
        if (!cancelled) navigate("/dashboard", { replace: true });
      } catch (e) {
        console.error("Auth callback failed:", e);
        if (!cancelled) navigate("/login", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instance, navigate]);

  return <div>Signing you in...</div>;
}
