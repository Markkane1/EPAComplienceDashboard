import { GoneError } from "../../../domain/errors/AuthErrors.js";

export class SignupBlockedUseCase {
  constructor({ auditLogger }) {
    this.auditLogger = auditLogger;
  }

  async execute({ email, request }) {
    await this.auditLogger.log({
      action: "auth.signup_blocked",
      entityType: "auth",
      req: request,
      details: {
        email: email || null,
      },
    });
    throw new GoneError("Applicant signup is disabled. Submit an application to receive a magic link.");
  }
}
