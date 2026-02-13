import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { applicantMatchesApplication, isApplicantOnlyUser } from "./utils.js";

export class UpdateApplicationUseCase {
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

  async execute({ id, payload, user, request }) {
    const userRoles = user?.roles || [];
    const isApplicantOnly = isApplicantOnlyUser(userRoles);
    if (!isApplicantOnly) {
      return { status: 403, body: { message: "Forbidden" } };
    }

    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    if (!applicantMatchesApplication(user, app)) {
      return { status: 403, body: { message: "Forbidden" } };
    }

    if (app.status !== "incomplete") {
      return { status: 400, body: { message: "Only incomplete applications can be updated." } };
    }

    const {
      applicant_name,
      applicant_email,
      applicant_phone,
      company_name,
      company_address,
      description,
    } = payload || {};

    const applicantCnic = description?.cnic ? String(description.cnic).trim() : null;
    if (user?.cnic && applicantCnic && user.cnic !== applicantCnic) {
      return { status: 400, body: { message: "Applicant CNIC does not match profile." } };
    }

    const updates = {};
    if (applicant_name) updates.applicant_name = applicant_name;
    if (applicant_email) updates.applicant_email = String(applicant_email).toLowerCase().trim();
    if (applicant_phone !== undefined) updates.applicant_phone = applicant_phone || null;
    if (company_name !== undefined) updates.company_name = company_name || null;
    if (company_address !== undefined) updates.company_address = company_address || null;
    if (description !== undefined) updates.description = description || null;
    if (!app.applicant_user_id) updates.applicant_user_id = user?._id?.toString?.() || user?.id || null;

    updates.status = "submitted";
    updates.updated_by = user?._id?.toString?.() || user?.id || null;

    const updated = await this.applicationRepository.updateById(app.id, updates);

    await this.remarkRepository.createRemark({
      application_id: updated.id,
      user_id: user?._id?.toString?.() || user?.id || null,
      remark: "Application updated by applicant",
      remark_type: "resubmitted",
      status_at_time: updated.status,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    await this.emailService.sendStatusChangedEmail({
      email: updated.applicant_email,
      trackingId: updated.tracking_id,
      status: updated.status,
    });

    await this.notificationService.notifyUsersByRole("registrar", {
      applicationId: updated.id,
      title: "Application Resubmitted",
      message: `${updated.tracking_id} updated by ${updated.applicant_name}.`,
      type: "application_resubmitted",
      link: `/dashboard/applications/${updated.id}`,
      dedupeKey: `application_resubmitted:${updated.id}`,
    });

    await this.auditLogger.log({
      action: "application.resubmitted",
      entityType: "application",
      entityId: updated.id,
      user,
      req: request,
      details: { tracking_id: updated.tracking_id },
    });

    return { status: 200, body: mapApplicationResponse(updated) };
  }
}
