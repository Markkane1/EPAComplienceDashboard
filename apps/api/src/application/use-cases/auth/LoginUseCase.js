import { ForbiddenError, UnauthorizedError, ValidationError } from "../../../domain/errors/AuthErrors.js";
import { mapUserResponse } from "../../dtos/mapUserResponse.js";
import { 
  isAccountLocked, 
  recordFailedAttempt, 
  clearFailedAttempts,
  getLockoutRemainingMinutes 
} from "../../../infrastructure/services/accountLockout.js";
import { logFailedLogin, logSuccessfulLogin } from "../../../infrastructure/services/securityAudit.js";

export class LoginUseCase {
  constructor({ userRepository, passwordHasher, tokenService, auditLogger, publicBaseUrl }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.auditLogger = auditLogger;
    this.publicBaseUrl = publicBaseUrl;
  }

  async execute({ email, password, request }) {
    if (!email || !password) {
      throw new ValidationError("Email and password are required.");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);
    
    if (!user) {
      // Log failed login attempt (user not found)
      await logFailedLogin(normalizedEmail, request?.ip, request);
      throw new UnauthorizedError("Invalid credentials.");
    }

    // Check if account is locked
    if (isAccountLocked(user)) {
      const remainingMinutes = getLockoutRemainingMinutes(user);
      await logFailedLogin(normalizedEmail, request?.ip, request);
      throw new ForbiddenError(
        `Account is temporarily locked due to too many failed login attempts. ` +
        `Please try again in ${remainingMinutes} minutes.`
      );
    }

    // Verify password
    const valid = await this.passwordHasher.compare(password, user.password_hash);
    
    if (!valid) {
      // Record failed attempt and check if should lock
      const attemptResult = recordFailedAttempt(user);
      await this.userRepository.updateUser(user.id, {
        failedLoginAttempts: user.failedLoginAttempts,
        failedLoginAttemptsResetAt: user.failedLoginAttemptsResetAt,
        lockedUntil: user.lockedUntil,
      });

      await logFailedLogin(normalizedEmail, request?.ip, request);

      const message = attemptResult.isLocked 
        ? `Too many failed login attempts. Account locked for ${getLockoutRemainingMinutes(user)} minutes.`
        : `Invalid credentials. ${attemptResult.maxAttempts - attemptResult.attempts} attempts remaining.`;

      throw new UnauthorizedError(message);
    }

    // Valid credentials - check user role
    const roles = user.roles || [];
    const isStaff = roles.some((role) =>
      ["admin", "super_admin", "registrar", "hearing_officer"].includes(role)
    );
    
    if (!isStaff) {
      await logFailedLogin(normalizedEmail, request?.ip, request);
      throw new ForbiddenError("Applicant login is disabled. Request a magic link instead.");
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(user);
    await this.userRepository.updateUser(user.id, {
      failedLoginAttempts: 0,
      failedLoginAttemptsResetAt: null,
      lockedUntil: null,
      last_login: new Date(),
    });

    const token = this.tokenService.signToken({ userId: user.id }, { expiresIn: "7d" });

    // Log successful login
    await logSuccessfulLogin(user.id, user.email, request?.ip, request);

    await this.auditLogger.log({
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      user,
      req: request,
      details: { email: user.email || null },
    });

    return {
      status: 200,
      body: {
        token,
        user: mapUserResponse(user, this.publicBaseUrl),
      },
    };
  }
}
