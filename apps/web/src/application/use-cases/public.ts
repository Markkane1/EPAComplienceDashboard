import type { ApiClient } from "@/application/ports/ApiClient";

export const createPublicUseCases = (api: ApiClient) => ({
  getApplication: (trackingId: string) => api.get(`/api/public/applications/${trackingId}`),
  getHearings: (trackingId: string) =>
    api.get(`/api/public/applications/${trackingId}/hearings`),
});
