import type { ApiClient } from "@/application/ports/ApiClient";

type QueryInput = string | URLSearchParams | null | undefined;

const withQuery = (path: string, query?: QueryInput) => {
  if (!query) return path;
  const queryString = typeof query === "string" ? query : query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const createApplicationUseCases = (api: ApiClient) => ({
  list: (query?: QueryInput) => api.get(withQuery("/api/applications", query)),
  listIncomplete: () => api.get("/api/applications?status=incomplete"),
  getStats: () => api.get("/api/applications/stats"),
  getById: (id: string) => api.get(`/api/applications/${id}`),
  listDocuments: (id: string) => api.get(`/api/applications/${id}/documents`),
  listRemarks: (id: string) => api.get(`/api/applications/${id}/remarks`),
  listHearings: (id: string) => api.get(`/api/applications/${id}/hearings`),
  create: (payload: unknown) => api.post("/api/applications", payload),
  update: (id: string, payload: unknown) => api.put(`/api/applications/${id}`, payload),
  uploadDocument: (id: string, payload: FormData) =>
    api.post(`/api/applications/${id}/documents`, payload),
  markIncomplete: (id: string, remarks: string) =>
    api.post(`/api/applications/${id}/mark-incomplete`, { remarks }),
  markComplete: (id: string) => api.post(`/api/applications/${id}/mark-complete`, {}),
  scheduleHearing: (id: string, payload: unknown) =>
    api.post(`/api/applications/${id}/schedule`, payload),
  setViolation: (id: string, payload: unknown) =>
    api.post(`/api/applications/${id}/violation`, payload),
  adjourn: (id: string, payload: unknown) => api.post(`/api/applications/${id}/adjourn`, payload),
  approve: (id: string, payload: unknown) => api.post(`/api/applications/${id}/approve`, payload),
  reject: (id: string, payload: unknown) => api.post(`/api/applications/${id}/reject`, payload),
});
