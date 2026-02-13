import { request } from "@/infrastructure/api/httpClient";
import type { ApiClient, ApiResponse } from "@/application/ports/ApiClient";

const TOKEN_KEY = "phs_token";

export class HttpApiClient implements ApiClient {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});

    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await request(path, {
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

  async get<T = unknown>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  async put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async delete<T = unknown>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const createApiClient = () => new HttpApiClient();

