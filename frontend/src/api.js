// src/api.js

// Prefer Vite env, fallback to "" (same-origin)
const RAW_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "";

// Normalize: remove trailing slash so `${API_BASE}/api/...` is safe
const API_BASE = String(RAW_BASE || "").replace(/\/+$/, "");

// ✅ Safe storage helpers (prevents Tracking Prevention crashes)
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ✅ Make a "Response-like" object when fetch throws (offline / CORS / DNS / etc)
function offlineResponse(err) {
  return {
    ok: false,
    status: 0,
    statusText: "OFFLINE",
    url: "",
    __offline: true,
    __error: err ? String(err) : "offline",
    async json() {
      return { detail: "offline", error: err ? String(err) : "offline" };
    },
    async text() {
      return err ? String(err) : "offline";
    },
  };
}

// Join base + path safely
function buildUrl(path) {
  const p = String(path || "");
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (!API_BASE) return p; // same-origin
  // ensure path starts with /
  return `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}

async function refreshAccessToken() {
  const refresh = safeGet("refresh");
  if (!refresh) return null;

  try {
    const res = await fetch(buildUrl("/api/token/refresh/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;

    const access = data?.access || null;
    if (access) safeSet("access", access);
    return access;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);

  const makeHeaders = (token) => ({
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  let access = safeGet("access");

  // First attempt
  let res;
  try {
    res = await fetch(url, { ...options, headers: makeHeaders(access) });
  } catch (e) {
    return offlineResponse(e);
  }

  // If unauthorized, try refresh ONCE
  if (res.status === 401) {
    const fresh = await refreshAccessToken();

    if (!fresh) {
      // tokens invalid -> clear and let UI redirect to login if needed
      safeRemove("access");
      safeRemove("refresh");
      return res;
    }

    try {
      res = await fetch(url, { ...options, headers: makeHeaders(fresh) });
    } catch (e) {
      return offlineResponse(e);
    }
  }

  return res;
}

// Optional helper if you want: always return JSON or throw
export async function apiFetchJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data?.detail ||
      (typeof data === "string" ? data : null) ||
      (await res.text().catch(() => "")) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
