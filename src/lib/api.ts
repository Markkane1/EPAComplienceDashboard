const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
const TOKEN_KEY = "phs_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = getToken();
  const headers = new Headers(options.headers || {});

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.blob();
}

export async function apiGet(path) {
  return apiRequest(path, { method: "GET" });
}

export async function apiPost(path, body) {
  return apiRequest(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function apiPut(path, body) {
  return apiRequest(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path) {
  return apiRequest(path, { method: "DELETE" });
}
