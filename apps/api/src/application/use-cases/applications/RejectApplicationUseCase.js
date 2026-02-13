import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { applyViolationType, CLOSED_STATUSES, isHearingOnlyUser } from "./utils.js";
import { createHearingOrderDocument, attachHearingOrderToLatest } from "./documentHelpers.js";
import { ensureApplicantUser, sendApplicantMagicLink } from "./applicantHelpers.js";

export class RejectApplicationUseCase {
  constructor({
    applicationRepository,
    hearingRepository,
    documentRepository,
    remarkRepository,
    userRepository,
    passwordHasher,
    tokenGenerator,
    tokenHasher,
    emailService,
    auditLogger,
    fileStorage,
    appBaseUrl,
  }) {
    this.applicationRepository = applicationRepository;
    this.hearingRepository = hearingRepository;
    this.documentRepository = documentRepository;
    this.remarkRepository = remarkRepository;
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenGenerator = tokenGenerator;
    this.tokenHasher = tokenHasher;
    this.emailService = emailService;
    this.auditLogger = auditLogger;
    this.fileStorage = fileStorage;
    this.appBaseUrl = appBaseUrl;
  }

  async execute({ id, payload, file, user, request }) {
    const { remarks, proceedings, violation_type, sub_violation } = payload || {};
    const cleanedRemarks = typeof remarks === "string" ? remarks.trim() : "";
    const cleanedProceedings = typeof proceedings === "string" ? proceedings.trim() : "";
    if (!file) {
      return { status: 400, body: { message: "Hearing order PDF is required." } };
    }
    if (cleanedRemarks.length < 10) {
      return { status: 400, body: { message: "Remarks must be at least 10 characters." } };
    }

    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    if (!["hearing_scheduled", "under_hearing"].includes(app.status)) {
      return { status: 400, body: { message: "Application is not under hearing." } };
    }

    if (CLOSED_STATUSES.includes(app.status)) {
      return { status: 400, body: { message: "Application is already closed." } };
    }
    if (isHearingOnlyUser(user?.roles || []) && user?.district) {
      if (app.description?.district !== user.district) {
        return { status: 403, body: { message: "Forbidden" } };
      }
    }

    const userRoles = user?.roles || [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
    const isHearingOfficer = userRoles.includes("hearing_officer");
    if (!isAdmin && isHearingOfficer) {
      if (!app.assigned_hearing_officer_id) {
        return { status: 400, body: { message: "No hearing officer assigned to this application." } };
      }
      if (app.assigned_hearing_officer_id !== (user?._id?.toString?.() || user?.id)) {
        return { status: 403, body: { message: "Only the assigned hearing officer can reject this application." } };
      }
      const latestHearing = await this.hearingRepository.findLatestByApplicationId(app.id);
      if (!latestHearing?.hearing_date) {
        return { status: 400, body: { message: "No hearing scheduled for this application." } };
      }
      const hearingTime = new Date(latestHearing.hearing_date).getTime();
      if (Number.isNaN(hearingTime)) {
        return { status: 400, body: { message: "Invalid hearing date." } };
      }
      if (hearingTime > Date.now()) {
        return { status: 400, body: { message: "Hearing has not occurred yet." } };
      }
    }

    const hearingOrderDoc = await createHearingOrderDocument({
      applicationId: app.id,
      file,
      userId: user?._id?.toString?.() || user?.id || null,
      applicationDocumentRepository: this.documentRepository,
      fileStorage: this.fileStorage,
    });
    await attachHearingOrderToLatest({
      applicationId: app.id,
      hearingRepository: this.hearingRepository,
      documentId: hearingOrderDoc?.id || null,
    });

    const updates = {
      status: "rejected_closed",
      closed_at: new Date(),
      closed_by: user?._id?.toString?.() || user?.id || null,
      hearing_officer_id: user?._id?.toString?.() || user?.id || null,
      description: applyViolationType(app, violation_type, sub_violation),
      updated_by: user?._id?.toString?.() || user?.id || null,
    };

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

    await this.hearingRepository.updateMany({ application_id: app.id }, { is_active: false });

    await this.remarkRepository.createRemark({
      application_id: finalApp.id,
      user_id: user?._id?.toString?.() || user?.id || null,
      remark: cleanedRemarks || "Rejected",
      proceedings: cleanedProceedings || null,
      remark_type: "rejected",
      status_at_time: finalApp.status,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    await this.emailService.sendStatusChangedEmail({
      email: finalApp.applicant_email,
      trackingId: finalApp.tracking_id,
      status: finalApp.status,
    });

    await this.auditLogger.log({
      action: "application.rejected",
      entityType: "application",
      entityId: finalApp.id,
      user,
      req: request,
      details: { status: finalApp.status, tracking_id: finalApp.tracking_id },
    });

    return { status: 200, body: mapApplicationResponse(finalApp) };
  }
}
