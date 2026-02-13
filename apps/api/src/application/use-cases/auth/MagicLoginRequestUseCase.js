import { ValidationError } from "../../../domain/errors/AuthErrors.js";

export class MagicLoginRequestUseCase {
  constructor({ userRepository, tokenGenerator, tokenHasher, emailService, auditLogger, appBaseUrl }) {
    this.userRepository = userRepository;
    this.tokenGenerator = tokenGenerator;
    this.tokenHasher = tokenHasher;
    this.emailService = emailService;
    this.auditLogger = auditLogger;
    this.appBaseUrl = appBaseUrl;
  }

  async execute({ email, request }) {
    if (!email) {
      throw new ValidationError("Email is required.");
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      await this.auditLogger.log({
        action: "auth.magic_login_requested",
        entityType: "user",
        entityId: null,
        user: null,
        req: request,
        details: { email: normalizedEmail, user_found: false },
      });
      return {
        status: 200,
        body: { success: true },
      };
    }

    const magicToken = this.tokenGenerator(24);
    const tokenHash = this.tokenHasher(magicToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.userRepository.updateUser(user.id, {
      magic_login_token: tokenHash,
      magic_login_expires_at: expiresAt,
    });

    const magicUrl = `${this.appBaseUrl}/magic-login?token=${magicToken}`;
    await this.emailService.sendMagicLoginEmail({ email: user.email, loginUrl: magicUrl });

    await this.auditLogger.log({
      action: "auth.magic_login_requested",
      entityType: "user",
      entityId: user.id,
      user,
      req: request,
      details: { email: normalizedEmail, user_found: true },
    });

    return {
      status: 200,
      body: { success: true },
    };
  }
}
