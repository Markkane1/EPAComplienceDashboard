import { UnauthorizedError, ValidationError } from "../../../domain/errors/AuthErrors.js";
import { mapUserResponse } from "../../dtos/mapUserResponse.js";

export class UpdateProfileImageUseCase {
  constructor({ userRepository, auditLogger, publicBaseUrl }) {
    this.userRepository = userRepository;
    this.auditLogger = auditLogger;
    this.publicBaseUrl = publicBaseUrl;
  }

  async execute({ userId, profileImagePath, request }) {
    if (!profileImagePath) {
      throw new ValidationError("Profile image is required.");
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Unauthorized");
    }

    const updatedUser = await this.userRepository.updateUser(user.id, {
      profile_image_path: profileImagePath,
      updated_by: user.id,
    });

    await this.auditLogger.log({
      action: "user.profile_image_updated",
      entityType: "user",
      entityId: user.id,
      user: updatedUser,
      req: request,
    });

    return {
      status: 200,
      body: { user: mapUserResponse(updatedUser, this.publicBaseUrl) },
    };
  }
}
