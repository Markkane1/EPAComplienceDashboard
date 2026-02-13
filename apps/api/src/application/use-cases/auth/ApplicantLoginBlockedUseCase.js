import { GoneError } from "../../../domain/errors/AuthErrors.js";

export class ApplicantLoginBlockedUseCase {
  constructor({ auditLogger }) {
    this.auditLogger = auditLogger;
  }

  async execute({ cnic, email, request }) {
    await this.auditLogger.log({
      action: "auth.applicant_login_blocked",
      entityType: "auth",
      req: request,
      details: {
        cnic: cnic || null,
        email: email || null,
      },
    });
    throw new GoneError("Applicant login is disabled. Request a magic link instead.");
  }
}
