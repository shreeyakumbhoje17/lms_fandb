const API_BASE = ""; // same-origin

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;

  const res = await fetch(`/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (data.access) {
    localStorage.setItem("access", data.access);
    return data.access;
  }
  return null;
}

export async function apiFetch(path, options = {}) {
  let access = localStorage.getItem("access");

  let res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });

  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (!newAccess) return res;

    res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${newAccess}`,
      },
    });
  }

  return res;
}

