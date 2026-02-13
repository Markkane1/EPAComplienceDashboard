import { createApiClient } from "@/infrastructure/api/apiClient";
import { createAuthUseCases } from "@/application/use-cases/auth";
import { createApplicationUseCases } from "@/application/use-cases/applications";
import { createCategoryUseCases } from "@/application/use-cases/categories";
import { createViolationUseCases } from "@/application/use-cases/violations";
import { createHearingUseCases } from "@/application/use-cases/hearings";
import { createReportUseCases } from "@/application/use-cases/reports";
import { createNotificationUseCases } from "@/application/use-cases/notifications";
import { createAuditLogUseCases } from "@/application/use-cases/auditLogs";
import { createDocumentUseCases } from "@/application/use-cases/documents";
import { createPublicUseCases } from "@/application/use-cases/public";
import { createUserUseCases } from "@/application/use-cases/users";

const apiClient = createApiClient();

export const authUseCases = createAuthUseCases(apiClient);
export const applicationUseCases = createApplicationUseCases(apiClient);
export const categoryUseCases = createCategoryUseCases(apiClient);
export const violationUseCases = createViolationUseCases(apiClient);
export const hearingUseCases = createHearingUseCases(apiClient);
export const reportUseCases = createReportUseCases(apiClient);
export const notificationUseCases = createNotificationUseCases(apiClient);
export const auditLogUseCases = createAuditLogUseCases(apiClient);
export const documentUseCases = createDocumentUseCases(apiClient);
export const publicUseCases = createPublicUseCases(apiClient);
export const userUseCases = createUserUseCases(apiClient);


