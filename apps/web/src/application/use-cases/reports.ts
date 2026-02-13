import type { ApiClient } from "@/application/ports/ApiClient";

type QueryInput = string | URLSearchParams | null | undefined;

const withQuery = (path: string, query?: QueryInput) => {
  if (!query) return path;
  const queryString = typeof query === "string" ? query : query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const createReportUseCases = (api: ApiClient) => ({
  summary: (query?: QueryInput) => api.get(withQuery("/api/reports/summary", query)),
  summaryPdf: (query?: QueryInput) => api.get(withQuery("/api/reports/summary/pdf", query)),
  hearingOfficerWise: (query?: QueryInput) =>
    api.get(withQuery("/api/reports/hearing-officer-wise", query)),
  hearingOfficerWisePdf: (query?: QueryInput) =>
    api.get(withQuery("/api/reports/hearing-officer-wise/pdf", query)),
  registrarDisposal: (query?: QueryInput) =>
    api.get(withQuery("/api/reports/registrar-disposal", query)),
});
