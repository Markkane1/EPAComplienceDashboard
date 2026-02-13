import { UnauthorizedError } from "../../../domain/errors/AuthErrors.js";
import { mapUserResponse } from "../../dtos/mapUserResponse.js";

export class RemoveProfileImageUseCase {
  constructor({ userRepository, auditLogger, publicBaseUrl }) {
    this.userRepository = userRepository;
    this.auditLogger = auditLogger;
    this.publicBaseUrl = publicBaseUrl;
  }

  async execute({ userId, request }) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Unauthorized");
    }

    const updatedUser = await this.userRepository.updateUser(user.id, {
      profile_image_path: null,
      updated_by: user.id,
    });

    await this.auditLogger.log({
      action: "user.profile_image_removed",
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
