import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { CLOSED_STATUSES } from "./utils.js";
import { ensureApplicantUser, sendApplicantMagicLink } from "./applicantHelpers.js";

export class MarkApplicationIncompleteUseCase {
  constructor({
    applicationRepository,
    remarkRepository,
    userRepository,
    passwordHasher,
    tokenGenerator,
    tokenHasher,
    emailService,
    notificationService,
    auditLogger,
    appBaseUrl,
  }) {
    this.applicationRepository = applicationRepository;
    this.remarkRepository = remarkRepository;
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenGenerator = tokenGenerator;
    this.tokenHasher = tokenHasher;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.auditLogger = auditLogger;
    this.appBaseUrl = appBaseUrl;
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
      status: "incomplete",
      updated_by: user?._id?.toString?.() || user?.id || null,
    };
    if (wasRegistrarUnassigned) {
      updates.assigned_registrar_id = user?._id?.toString?.() || user?.id || null;
    }

    const updated = await this.applicationRepository.updateById(app.id, updates);

    const ensureResult = await ensureApplicantUser({
      application: updated,
      applicationRepository: this.applicationRepository,
      userRepository: this.userRepository,
      passwordHasher: this.passwordHasher,
      tokenGenerator: this.tokenGenerator,
    });
    const applicantUser = ensureResult?.applicantUser || null;
    const finalApp = ensureResult?.application || updated;

    await sendApplicantMagicLink({
      applicantUser,
      tokenGenerator: this.tokenGenerator,
      tokenHasher: this.tokenHasher,
      appBaseUrl: this.appBaseUrl,
      emailService: this.emailService,
      userRepository: this.userRepository,
    });

    await this.remarkRepository.createRemark({
      application_id: finalApp.id,
      user_id: user?._id?.toString?.() || user?.id || null,
      remark: remarks || "Marked incomplete",
      remark_type: "incomplete",
      status_at_time: finalApp.status,
    });

    await this.emailService.sendStatusChangedEmail({
      email: finalApp.applicant_email,
      trackingId: finalApp.tracking_id,
      status: finalApp.status,
    });

    if (wasRegistrarUnassigned && finalApp.assigned_registrar_id === (user?._id?.toString?.() || user?.id)) {
      await this.notificationService.createNotification({
        recipientUserId: user?._id?.toString?.() || user?.id || null,
        applicationId: finalApp.id,
        title: "Application Assigned",
        message: `${finalApp.tracking_id} is assigned to you.`,
        type: "application_assigned",
        link: `/dashboard/applications/${finalApp.id}`,
        dedupeKey: `application_assigned:${finalApp.id}`,
      });
    }

    await this.auditLogger.log({
      action: "application.mark_incomplete",
      entityType: "application",
      entityId: finalApp.id,
      user,
      req: request,
      details: { status: finalApp.status, registrar_id: finalApp.assigned_registrar_id || null },
    });

    return { status: 200, body: mapApplicationResponse(finalApp) };
  }
}
