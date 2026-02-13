import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { CLOSED_STATUSES } from "./utils.js";

export class MarkApplicationCompleteUseCase {
  constructor({
    applicationRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
  }) {
    this.applicationRepository = applicationRepository;
    this.remarkRepository = remarkRepository;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.auditLogger = auditLogger;
  }

  async execute({ id, remarks, user, request }) {
    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    if (CLOSED_STATUSES.includes(app.status)) {
      return { status: 400, body: { message: "Closed applications cannot be updated." } };
    }

    const wasRegistrarUnassigned = !app.assigned_registrar_id;
    const updates = {
      status: "complete",
      updated_by: user?._id?.toString?.() || user?.id || null,
    };
    if (wasRegistrarUnassigned) {
      updates.assigned_registrar_id = user?._id?.toString?.() || user?.id || null;
    }

    const updated = await this.applicationRepository.updateById(app.id, updates);

    if (remarks) {
      await this.remarkRepository.createRemark({
        application_id: updated.id,
        user_id: user?._id?.toString?.() || user?.id || null,
        remark: remarks,
        remark_type: "complete",
        status_at_time: updated.status,
      });
    }

    await this.emailService.sendStatusChangedEmail({
      email: updated.applicant_email,
      trackingId: updated.tracking_id,
      status: updated.status,
    });

    if (wasRegistrarUnassigned && updated.assigned_registrar_id === (user?._id?.toString?.() || user?.id)) {
      await this.notificationService.createNotification({
        recipientUserId: user?._id?.toString?.() || user?.id || null,
        applicationId: updated.id,
        title: "Application Assigned",
        message: `${updated.tracking_id} is assigned to you.`,
        type: "application_assigned",
        link: `/dashboard/applications/${updated.id}`,
        dedupeKey: `application_assigned:${updated.id}`,
      });
    }

    await this.auditLogger.log({
      action: "application.mark_complete",
      entityType: "application",
      entityId: updated.id,
      user,
      req: request,
      details: { status: updated.status, registrar_id: updated.assigned_registrar_id || null },
    });

    return { status: 200, body: mapApplicationResponse(updated) };
  }
}
