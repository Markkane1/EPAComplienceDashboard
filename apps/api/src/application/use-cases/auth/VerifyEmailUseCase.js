import { ValidationError } from "../../../domain/errors/AuthErrors.js";

export class VerifyEmailUseCase {
  constructor({ userRepository, tokenHasher, auditLogger }) {
    this.userRepository = userRepository;
    this.tokenHasher = tokenHasher;
    this.auditLogger = auditLogger;
  }

  async execute({ token, request }) {
    if (!token) {
      throw new ValidationError("Token is required.");
    }

    const tokenHash = this.tokenHasher(String(token));
    const user = await this.userRepository.findByVerificationToken(tokenHash, new Date());
    if (!user) {
      throw new ValidationError("Invalid or expired token.");
    }

    const updatedUser = await this.userRepository.updateUser(user.id, {
      email_verified: true,
      email_verified_at: new Date(),
      verification_token: null,
      verification_expires_at: null,
    });

    await this.auditLogger.log({
      action: "auth.email_verified",
      entityType: "user",
      entityId: user.id,
      user: updatedUser,
      req: request,
    });

    return {
      status: 200,
      body: { success: true },
    };
  }
}
