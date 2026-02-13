import type { ApiClient } from "@/application/ports/ApiClient";

export type LoginInput = {
  email: string;
  password: string;
};

export type MagicLoginRequestInput = {
  email: string;
};

export type UpdateProfileInput = {
  first_name: string;
  last_name: string;
  designation: string;
  contact_number: string;
  email: string;
};

export type ChangePasswordInput = {
  current_password: string;
  new_password: string;
};

export const createAuthUseCases = (api: ApiClient) => ({
  getToken: () => api.getToken(),
  setToken: (token: string | null) => api.setToken(token),
  login: (input: LoginInput) => api.post("/api/auth/login", input),
  signup: (payload: unknown) => api.post("/api/auth/signup", payload),
  signupLegacy: (payload: unknown) => api.post("/api/auth/signup-legacy", payload),
  getMe: () => api.get("/api/auth/me"),
  magicLoginRequest: (input: MagicLoginRequestInput) => api.post("/api/auth/magic/request", input),
  magicLogin: (token: string) => api.get(`/api/auth/magic?token=${encodeURIComponent(token)}`),
  verifyEmail: (token: string) => api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),
  updateProfile: (input: UpdateProfileInput) => api.put("/api/auth/profile", input),
  changePassword: (input: ChangePasswordInput) => api.post("/api/auth/change-password", input),
  uploadProfileImage: (payload: FormData) => api.post("/api/auth/profile-picture", payload),
  removeProfileImage: () => api.delete("/api/auth/profile-picture"),
});
