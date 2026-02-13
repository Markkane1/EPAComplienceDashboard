import { UnauthorizedError } from "../../../domain/errors/AuthErrors.js";
import { mapUserResponse } from "../../dtos/mapUserResponse.js";

export class GetMeUseCase {
  constructor({ userRepository, publicBaseUrl }) {
    this.userRepository = userRepository;
    this.publicBaseUrl = publicBaseUrl;
  }

  async execute({ userId }) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Unauthorized");
    }
    return {
      status: 200,
      body: { user: mapUserResponse(user, this.publicBaseUrl) },
    };
  }
}
