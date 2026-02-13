import type { ApiClient } from "@/application/ports/ApiClient";

type QueryInput = string | URLSearchParams | null | undefined;

const withQuery = (path: string, query?: QueryInput) => {
  if (!query) return path;
  const queryString = typeof query === "string" ? query : query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const createHearingUseCases = (api: ApiClient) => ({
  list: () => api.get("/api/hearings"),
  report: (query?: QueryInput) => api.get(withQuery("/api/hearings/report", query)),
  reportPdf: (query?: QueryInput) => api.get(withQuery("/api/hearings/report/pdf", query)),
});
