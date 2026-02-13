const base = import.meta.env.VITE_API_URL ?? "";

function withBase(url: string) {
  if (!(url.startsWith("/api") || url.startsWith("/uploads"))) {
    return url;
  }

  if (!base) {
    return url;
  }

  return `${base}${url}`;
}

export async function request(url: string, options: RequestInit = {}) {
  return fetch(withBase(url), options);
}

