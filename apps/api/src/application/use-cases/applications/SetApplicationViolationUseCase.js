import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { applyViolationType, isHearingOnlyUser } from "./utils.js";

export class SetApplicationViolationUseCase {
  constructor({ applicationRepository, auditLogger }) {
    this.applicationRepository = applicationRepository;
    this.auditLogger = auditLogger;
  }

  async execute({ id, violation_type, sub_violation, user, request }) {
    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    if (isHearingOnlyUser(user?.roles || []) && user?.district) {
      if (app.description?.district !== user.district) {
        return { status: 403, body: { message: "Forbidden" } };
      }
    }

    const description = applyViolationType(app, violation_type, sub_violation);
    const updated = await this.applicationRepository.updateById(app.id, {
      description,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    await this.auditLogger.log({
      action: "application.violation_set",
      entityType: "application",
      entityId: updated.id,
      user,
      req: request,
      details: { violation_type, sub_violation },
    });

    return { status: 200, body: mapApplicationResponse(updated) };
  }
}
