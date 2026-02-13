import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { ensureApplicantUser, sendApplicantMagicLink } from "./applicantHelpers.js";

export class CreateApplicationUseCase {
  constructor({
    applicationRepository,
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
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenGenerator = tokenGenerator;
    this.tokenHasher = tokenHasher;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.auditLogger = auditLogger;
    this.appBaseUrl = appBaseUrl;
  }

  async execute({ payload, user, request }) {
    const {
      applicant_name,
      applicant_email,
      applicant_phone,
      company_name,
      company_address,
      application_type,
      description,
    } = payload || {};

    if (!applicant_name || !applicant_email || !application_type) {
      return { status: 400, body: { message: "Missing required fields." } };
    }

    const applicantCnic = description?.cnic ? String(description.cnic).trim() : null;
    if (user?.roles?.includes("applicant")) {
      if (!user.cnic || !applicantCnic || user.cnic !== applicantCnic) {
        return { status: 400, body: { message: "Applicant CNIC does not match profile." } };
      }
    }

    const created = await this.applicationRepository.createApplication({
      applicant_name,
      applicant_email: String(applicant_email).toLowerCase().trim(),
      applicant_phone: applicant_phone || null,
      applicant_cnic: applicantCnic,
      applicant_user_id: user?._id?.toString?.() || user?.id || null,
      company_name: company_name || null,
      company_address: company_address || null,
      application_type,
      description: description || null,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    const ensureResult = await ensureApplicantUser({
      application: created,
      applicationRepository: this.applicationRepository,
      userRepository: this.userRepository,
      passwordHasher: this.passwordHasher,
      tokenGenerator: this.tokenGenerator,
    });
    const applicantUser = ensureResult?.applicantUser || null;
    const finalApp = ensureResult?.application || created;

    await sendApplicantMagicLink({
      applicantUser,
      tokenGenerator: this.tokenGenerator,
      tokenHasher: this.tokenHasher,
      appBaseUrl: this.appBaseUrl,
      emailService: this.emailService,
      userRepository: this.userRepository,
    });

    await this.emailService.sendApplicationSubmittedEmail({
      email: finalApp.applicant_email,
      trackingId: finalApp.tracking_id,
      applicantName: finalApp.applicant_name,
    });

    await this.notificationService.notifyUsersByRole("registrar", {
      applicationId: finalApp.id,
      title: "New Application Submitted",
      message: `${finalApp.tracking_id} submitted by ${finalApp.applicant_name}.`,
      type: "application_submitted",
      link: `/dashboard/applications/${finalApp.id}`,
      dedupeKey: `application_submitted:${finalApp.id}`,
    });

    await this.auditLogger.log({
      action: "application.submitted",
      entityType: "application",
      entityId: finalApp.id,
      user: user || null,
      req: request,
      details: {
        tracking_id: finalApp.tracking_id,
        applicant_email: finalApp.applicant_email,
        applicant_name: finalApp.applicant_name,
      },
    });

    return { status: 201, body: mapApplicationResponse(finalApp) };
  }
}
