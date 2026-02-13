export type ApiResponse<T> = T | Blob | null;

export interface ApiClient {
  request<T = unknown>(path: string, options?: RequestInit): Promise<ApiResponse<T>>;
  get<T = unknown>(path: string): Promise<ApiResponse<T>>;
  post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  put<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  delete<T = unknown>(path: string): Promise<ApiResponse<T>>;
  getToken(): string | null;
  setToken(token: string | null): void;
}

