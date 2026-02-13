import { ValidationError } from "../../../domain/errors/AuthErrors.js";
import { mapUserResponse } from "../../dtos/mapUserResponse.js";

export class MagicLoginUseCase {
  constructor({ userRepository, tokenService, tokenHasher, auditLogger, publicBaseUrl }) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.tokenHasher = tokenHasher;
    this.auditLogger = auditLogger;
    this.publicBaseUrl = publicBaseUrl;
  }

  async execute({ token, request }) {
    if (!token) {
      throw new ValidationError("Token is required.");
    }

    const tokenHash = this.tokenHasher(String(token));
    const user = await this.userRepository.findByMagicLoginToken(tokenHash, new Date());
    if (!user) {
      throw new ValidationError("Invalid or expired token.");
    }

    const verifiedAt = user.email_verified_at || new Date();
    const updatedUser = await this.userRepository.updateUser(user.id, {
      email_verified: true,
      email_verified_at: verifiedAt,
      magic_login_token: null,
      magic_login_expires_at: null,
    });

    const jwtToken = this.tokenService.signToken({ userId: user.id }, { expiresIn: "7d" });

    await this.auditLogger.log({
      action: "auth.magic_login",
      entityType: "user",
      entityId: user.id,
      user: updatedUser,
      req: request,
    });

    return {
      status: 200,
      body: {
        token: jwtToken,
        user: mapUserResponse(updatedUser, this.publicBaseUrl),
      },
    };
  }
}
