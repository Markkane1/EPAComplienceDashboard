import { UnauthorizedError, ValidationError } from "../../../domain/errors/AuthErrors.js";
import { validatePasswordStrength } from "../../../presentation/http/validators/schemas.js";

export class ChangePasswordUseCase {
  constructor({ userRepository, passwordHasher, auditLogger }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.auditLogger = auditLogger;
  }

  async execute({ userId, current_password, new_password, request }) {
    if (!current_password || !new_password) {
      throw new ValidationError("Current and new password are required.");
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Unauthorized");
    }

    const valid = await this.passwordHasher.compare(current_password, user.password_hash);
    if (!valid) {
      throw new ValidationError("Current password is incorrect.");
    }

    try {
      validatePasswordStrength(new_password);
    } catch (error) {
      throw new ValidationError(error.message);
    }

    const passwordHash = await this.passwordHasher.hash(new_password, 10);
    await this.userRepository.updateUser(user.id, {
      password_hash: passwordHash,
      updated_by: user.id,
    });

    await this.auditLogger.log({
      action: "user.password_changed",
      entityType: "user",
      entityId: user.id,
      user,
      req: request,
    });

    return {
      status: 200,
      body: { success: true },
    };
  }
}
