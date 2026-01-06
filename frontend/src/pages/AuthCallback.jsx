import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";

const API_BASE = "";

export default function AuthCallback() {
  const { instance } = useMsal();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const result = await instance.handleRedirectPromise();
        console.log("handleRedirectPromise result:", result);

        if (result?.account) {
          instance.setActiveAccount(result.account);
        } else {
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) instance.setActiveAccount(accounts[0]);
        }

        const account = instance.getActiveAccount();
        console.log("active account:", account);

        if (!account) {
          navigate("/login", { replace: true });
          return;
        }

        let tokenResponse;
        try {
          tokenResponse = await instance.acquireTokenSilent({
            account,
            scopes: ["openid", "profile", "email"],
          });
        } catch {
          navigate("/dashboard", { replace: true });
          return;
        }

        const idToken = tokenResponse?.idToken;
        if (!idToken) {
          navigate("/dashboard", { replace: true });
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/api/auth/microsoft/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: idToken }),
          });

          if (res.ok) {
            const data = await res.json();

            // ✅ Save tokens
            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);

            // ✅ Normalize role for frontend UI logic
            const role = data.user.role === "office" ? "office" : "field";

            // ✅ Save normalized user object
            localStorage.setItem("user", JSON.stringify({
              email: data.user.email,
              first_name: data.user.first_name,
              last_name: data.user.last_name,
              role, // now matches UI config
            }));

            console.log("Stored ACCESS token ✔", localStorage.getItem("access")?.slice(0,20));
            console.log("Stored REFRESH token ✔", localStorage.getItem("refresh")?.slice(0,20));
            console.log("Stored ROLE ✔", role);
          }
        } catch (e) {
          console.error("Backend fetch failed:", e);
        }

        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [instance, navigate]);

  return <div>Signing you in...</div>;
}

