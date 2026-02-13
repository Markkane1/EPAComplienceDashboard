import type { ApiClient } from "@/application/ports/ApiClient";

export type CategoryInput = {
  name: string;
  subcategories?: Array<{ name: string }>;
};

export const createCategoryUseCases = (api: ApiClient) => ({
  list: () => api.get("/api/categories"),
  create: (payload: CategoryInput) => api.post("/api/categories", payload),
  update: (id: string, payload: CategoryInput) => api.put(`/api/categories/${id}`, payload),
  remove: (id: string) => api.delete(`/api/categories/${id}`),
});
