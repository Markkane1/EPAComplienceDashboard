import type { ApiClient } from "@/application/ports/ApiClient";

export type ViolationInput = {
  name: string;
  description?: string | null;
};

export const createViolationUseCases = (api: ApiClient) => ({
  list: () => api.get("/api/violations"),
  create: (payload: ViolationInput) => api.post("/api/violations", payload),
  update: (id: string, payload: ViolationInput) => api.put(`/api/violations/${id}`, payload),
  remove: (id: string) => api.delete(`/api/violations/${id}`),
});
