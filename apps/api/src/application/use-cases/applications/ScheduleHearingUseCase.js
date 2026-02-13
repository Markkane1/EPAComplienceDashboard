import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { applyViolationType, CLOSED_STATUSES, isHearingOnlyUser } from "./utils.js";

export class ScheduleHearingUseCase {
  constructor({
    applicationRepository,
    hearingRepository,
    userRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
  }) {
    this.applicationRepository = applicationRepository;
    this.hearingRepository = hearingRepository;
    this.userRepository = userRepository;
    this.remarkRepository = remarkRepository;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.auditLogger = auditLogger;
  }

  async execute({ id, payload, user, request }) {
    const {
      hearing_datetime,
      hearing_type,
      hearing_officer_id,
      remarks,
      proceedings,
      violation_type,
      sub_violation,
    } = payload || {};

    if (!hearing_datetime) {
      return { status: 400, body: { message: "Hearing date is required." } };
    }
    const scheduledAt = new Date(hearing_datetime);
    if (Number.isNaN(scheduledAt.getTime())) {
      return { status: 400, body: { message: "Invalid hearing date." } };
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return { status: 400, body: { message: "Hearing date must be in the future." } };
    }

    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    const userRoles = user?.roles || [];
    const isRegistrar =
      userRoles.includes("registrar") &&
      !userRoles.includes("admin") &&
      !userRoles.includes("super_admin");
    const isHearingOfficer = userRoles.includes("hearing_officer");
    const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");

    if (CLOSED_STATUSES.includes(app.status)) {
      return { status: 400, body: { message: "Closed applications cannot be scheduled." } };
    }
    if (["submitted", "incomplete"].includes(app.status)) {
      return { status: 400, body: { message: "Application is not marked complete." } };
    }
    if (isHearingOnlyUser(userRoles) && user?.district) {
      if (app.description?.district !== user.district) {
        return { status: 403, body: { message: "Forbidden" } };
      }
    }

    const hearingCount = await this.hearingRepository.countByApplicationId(app.id);
    const isFirstHearing = hearingCount === 0;
    let selectedOfficer = null;

    if (isFirstHearing) {
      if (!isRegistrar && !isAdmin) {
        return { status: 403, body: { message: "Only the registrar or admin can schedule the first hearing." } };
      }
      if (app.status !== "complete") {
        return {
          status: 400,
          body: { message: "Application must be marked complete before scheduling the first hearing." },
        };
      }
      if (!hearing_officer_id) {
        return { status: 400, body: { message: "Hearing officer is required for the first hearing." } };
      }
      selectedOfficer = await this.userRepository.findById(String(hearing_officer_id));
      if (!selectedOfficer) {
        return { status: 404, body: { message: "Hearing officer not found." } };
      }
      const officerRoles = selectedOfficer.roles || [];
      if (!officerRoles.includes("hearing_officer")) {
        return { status: 400, body: { message: "Selected user is not a hearing officer." } };
      }
      const appDistrict = app.description?.district || null;
      if (appDistrict && selectedOfficer.district && selectedOfficer.district !== appDistrict) {
        return { status: 400, body: { message: "Hearing officer district does not match application district." } };
      }
    } else {
      if (!isHearingOfficer && !isAdmin) {
        return { status: 403, body: { message: "Only a hearing officer or admin can schedule subsequent hearings." } };
      }
      if (!isAdmin) {
        if (!app.assigned_hearing_officer_id) {
          return { status: 400, body: { message: "No hearing officer assigned to this application." } };
        }
        if (app.assigned_hearing_officer_id !== (user?._id?.toString?.() || user?.id)) {
          return { status: 403, body: { message: "Only the assigned hearing officer can schedule subsequent hearings." } };
        }
      }
    }

    await this.hearingRepository.updateMany({ application_id: app.id }, { is_active: false });
    const lastHearing = await this.hearingRepository.findLatestByApplicationId(app.id);
    const nextSequence = lastHearing ? lastHearing.sequence_no + 1 : 1;

    const hearing = await this.hearingRepository.createHearing({
      application_id: app.id,
      hearing_date: new Date(hearing_datetime),
      hearing_type: hearing_type || "initial",
      scheduled_by: user?._id?.toString?.() || user?.id || null,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
      is_active: true,
      sequence_no: nextSequence,
    });

    const wasOfficerUnassigned = !app.assigned_hearing_officer_id;
    const updates = {
      status: "hearing_scheduled",
      description: applyViolationType(app, violation_type, sub_violation),
      updated_by: user?._id?.toString?.() || user?.id || null,
    };
    if (isFirstHearing) {
      updates.assigned_hearing_officer_id = selectedOfficer?.id || null;
    } else if (wasOfficerUnassigned && isHearingOfficer) {
      updates.assigned_hearing_officer_id = user?._id?.toString?.() || user?.id || null;
    }

    const updated = await this.applicationRepository.updateById(app.id, updates);

    await this.remarkRepository.createRemark({
      application_id: updated.id,
      user_id: user?._id?.toString?.() || user?.id || null,
      remark: remarks || `Hearing scheduled (${hearing_type || "initial"}).`,
      proceedings: proceedings || null,
      remark_type: "hearing_scheduled",
      status_at_time: updated.status,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    await this.emailService.sendHearingScheduledEmail({
      email: updated.applicant_email,
      trackingId: updated.tracking_id,
      hearingDate: hearing.hearing_date.toISOString(),
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

    const hearingOfficerId =
      updated.assigned_hearing_officer_id || (isHearingOfficer ? (user?._id?.toString?.() || user?.id) : null);
    if (hearingOfficerId) {
      await this.notificationService.createNotification({
        recipientUserId: hearingOfficerId,
        applicationId: updated.id,
        title: "Hearing Scheduled",
        message: `${updated.tracking_id} scheduled for ${hearing.hearing_date.toLocaleString()}.`,
        type: "hearing_scheduled",
        link: `/dashboard/applications/${updated.id}`,
        dedupeKey: `hearing_scheduled:${hearing.id}`,
      });
    }

    await this.auditLogger.log({
      action: "application.hearing_scheduled",
      entityType: "hearing",
      entityId: hearing.id,
      user,
      req: request,
      details: {
        application_id: updated.id,
        tracking_id: updated.tracking_id,
        hearing_date: hearing.hearing_date.toISOString(),
        hearing_officer_id: updated.assigned_hearing_officer_id || null,
      },
    });

    return {
      status: 200,
      body: { hearing_id: hearing.id, application: mapApplicationResponse(updated) },
    };
  }
}
