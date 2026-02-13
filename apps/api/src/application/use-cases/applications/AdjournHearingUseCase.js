import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { applyViolationType, CLOSED_STATUSES, isHearingOnlyUser } from "./utils.js";
import { createHearingOrderDocument } from "./documentHelpers.js";

export class AdjournHearingUseCase {
  constructor({
    applicationRepository,
    hearingRepository,
    documentRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
    fileStorage,
  }) {
    this.applicationRepository = applicationRepository;
    this.hearingRepository = hearingRepository;
    this.documentRepository = documentRepository;
    this.remarkRepository = remarkRepository;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.auditLogger = auditLogger;
    this.fileStorage = fileStorage;
  }

  async execute({ id, payload, file, user, request }) {
    const { remarks, new_hearing_datetime, proceedings, violation_type, sub_violation } = payload || {};
    const cleanedRemarks = typeof remarks === "string" ? remarks.trim() : "";
    const cleanedProceedings = typeof proceedings === "string" ? proceedings.trim() : "";
    if (!file) {
      return { status: 400, body: { message: "Hearing order PDF is required." } };
    }
    if (cleanedRemarks.length < 10) {
      return { status: 400, body: { message: "Remarks must be at least 10 characters." } };
    }
    if (!new_hearing_datetime) {
      return { status: 400, body: { message: "New hearing date is required." } };
    }
    const adjournDate = new Date(new_hearing_datetime);
    if (Number.isNaN(adjournDate.getTime())) {
      return { status: 400, body: { message: "Invalid hearing date." } };
    }
    if (adjournDate.getTime() <= Date.now()) {
      return { status: 400, body: { message: "Hearing date must be in the future." } };
    }

    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    if (!["hearing_scheduled", "under_hearing"].includes(app.status)) {
      return { status: 400, body: { message: "Application is not under hearing." } };
    }

    if (CLOSED_STATUSES.includes(app.status)) {
      return { status: 400, body: { message: "Closed applications cannot be adjourned." } };
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
        return { status: 403, body: { message: "Only the assigned hearing officer can adjourn this hearing." } };
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

    const hearingCount = await this.hearingRepository.countByApplicationId(app.id);
    if (hearingCount === 0) {
      return { status: 400, body: { message: "No hearing scheduled for this application." } };
    }

    await this.hearingRepository.updateMany({ application_id: app.id, is_active: true }, { is_active: false });
    const lastHearing = await this.hearingRepository.findLatestByApplicationId(app.id);
    const nextSequence = lastHearing ? lastHearing.sequence_no + 1 : 1;

    const hearingOrderDoc = await createHearingOrderDocument({
      applicationId: app.id,
      file,
      userId: user?._id?.toString?.() || user?.id || null,
      applicationDocumentRepository: this.documentRepository,
      fileStorage: this.fileStorage,
    });

    const hearing = await this.hearingRepository.createHearing({
      application_id: app.id,
      hearing_date: new Date(new_hearing_datetime),
      hearing_type: "extension",
      scheduled_by: user?._id?.toString?.() || user?.id || null,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
      is_active: true,
      sequence_no: nextSequence,
      hearing_order_document_id: hearingOrderDoc?.id || null,
    });

    const wasOfficerUnassigned = !app.assigned_hearing_officer_id;
    const updates = {
      status: "under_hearing",
      description: applyViolationType(app, violation_type, sub_violation),
      updated_by: user?._id?.toString?.() || user?.id || null,
    };
    if (wasOfficerUnassigned) {
      updates.assigned_hearing_officer_id = user?._id?.toString?.() || user?.id || null;
    }

    const updated = await this.applicationRepository.updateById(app.id, updates);

    await this.remarkRepository.createRemark({
      application_id: updated.id,
      user_id: user?._id?.toString?.() || user?.id || null,
      remark: cleanedRemarks || "Hearing adjourned",
      proceedings: cleanedProceedings || null,
      remark_type: "adjourned",
      status_at_time: updated.status,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    await this.emailService.sendStatusChangedEmail({
      email: updated.applicant_email,
      trackingId: updated.tracking_id,
      status: updated.status,
    });

    if (wasOfficerUnassigned && updated.assigned_hearing_officer_id === (user?._id?.toString?.() || user?.id)) {
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
      action: "application.adjourned",
      entityType: "hearing",
      entityId: hearing.id,
      user,
      req: request,
      details: {
        application_id: updated.id,
        tracking_id: updated.tracking_id,
        hearing_date: hearing.hearing_date.toISOString(),
      },
    });

    return { status: 200, body: mapApplicationResponse(updated) };
  }
}
