import type { ApiClient } from "@/application/ports/ApiClient";

export const createDocumentUseCases = (api: ApiClient) => ({
  download: (id: string) => api.get(`/api/documents/${id}/download`),
});
