import { ConflictError, ValidationError } from "../../../domain/errors/AuthErrors.js";
import { validatePasswordStrength } from "../../../presentation/http/validators/schemas.js";

export class SignupUseCase {
  constructor({
    userRepository,
    passwordHasher,
    tokenGenerator,
    tokenHasher,
    emailService,
    auditLogger,
    appBaseUrl,
  }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenGenerator = tokenGenerator;
    this.tokenHasher = tokenHasher;
    this.emailService = emailService;
    this.auditLogger = auditLogger;
    this.appBaseUrl = appBaseUrl;
  }

  async execute({ email, password, full_name, cnic, request }) {
    const normalizedCnic = String(cnic || "").trim();
    if (!normalizedCnic || !password) {
      throw new ValidationError("CNIC and password are required.");
    }

    // Validate password strength BEFORE checking existing users
    try {
      validatePasswordStrength(password);
    } catch (error) {
      throw new ValidationError(error.message);
    }

    let normalizedEmail = email ? String(email).toLowerCase().trim() : null;
    if (normalizedEmail === "") {
      normalizedEmail = null;
    }

    const existingByCnic = await this.userRepository.findByCnic(normalizedCnic);
    if (existingByCnic) {
      if (existingByCnic.roles?.includes("applicant") && !existingByCnic.email_verified && existingByCnic.email) {
        const verificationToken = this.tokenGenerator(24);
        await this.userRepository.updateUser(existingByCnic.id, {
          verification_token: this.tokenHasher(verificationToken),
          verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const verifyUrl = `${this.appBaseUrl}/verify-email?token=${verificationToken}`;
        await this.emailService.sendVerificationEmail({ email: existingByCnic.email, verifyUrl });
        return {
          status: 200,
          body: { success: true, message: "Verification email sent." },
        };
      }
      throw new ConflictError("User already exists.");
    }

    if (normalizedEmail) {
      const existingByEmail = await this.userRepository.findByEmail(normalizedEmail);
      if (existingByEmail) {
        if (existingByEmail.roles?.includes("applicant") && !existingByEmail.email_verified) {
          const verificationToken = this.tokenGenerator(24);
          await this.userRepository.updateUser(existingByEmail.id, {
            verification_token: this.tokenHasher(verificationToken),
            verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });

          const verifyUrl = `${this.appBaseUrl}/verify-email?token=${verificationToken}`;
          await this.emailService.sendVerificationEmail({ email: existingByEmail.email, verifyUrl });
          return {
            status: 200,
            body: { success: true, message: "Verification email sent." },
          };
        }
        throw new ConflictError("User already exists.");
      }
    }

    const passwordHash = await this.passwordHasher.hash(password, 10);
    const shouldVerifyEmail = Boolean(normalizedEmail);
    const verificationToken = shouldVerifyEmail ? this.tokenGenerator(24) : null;

    const userPayload = {
      password_hash: passwordHash,
      full_name: full_name || null,
      roles: ["applicant"],
      cnic: normalizedCnic,
      email_verified: shouldVerifyEmail ? false : true,
      verification_token: shouldVerifyEmail ? this.tokenHasher(verificationToken) : null,
      verification_expires_at: shouldVerifyEmail ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      created_by: null,
      updated_by: null,
    };
    if (normalizedEmail) {
      userPayload.email = normalizedEmail;
    }

    const user = await this.userRepository.createUser(userPayload);

    await this.auditLogger.log({
      action: "auth.signup",
      entityType: "user",
      entityId: user.id,
      user,
      req: request,
      details: { email: user.email || null, cnic: user.cnic, role: "applicant" },
    });

    if (shouldVerifyEmail) {
      const verifyUrl = `${this.appBaseUrl}/verify-email?token=${verificationToken}`;
      await this.emailService.sendVerificationEmail({ email: user.email, verifyUrl });
      return {
        status: 201,
        body: { success: true, message: "Verification email sent." },
      };
    }

    return {
      status: 201,
      body: { success: true, message: "Account created. You can now sign in." },
    };
  }
}
