import type { ApiClient } from "@/application/ports/ApiClient";

export const createNotificationUseCases = (api: ApiClient) => ({
  list: (limit = 8) => api.get(`/api/notifications?limit=${limit}`),
  markRead: (id: string) => api.post(`/api/notifications/${id}/read`, {}),
  markAllRead: () => api.post("/api/notifications/read-all", {}),
});
