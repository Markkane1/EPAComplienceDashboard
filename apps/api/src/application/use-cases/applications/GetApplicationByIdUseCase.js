import { mapApplicationResponse } from "../../dtos/mapApplicationResponse.js";
import { applicantMatchesApplication, isApplicantOnlyUser, isHearingOnlyUser } from "./utils.js";

export class GetApplicationByIdUseCase {
  constructor({ applicationRepository }) {
    this.applicationRepository = applicationRepository;
  }

  async execute({ id, user }) {
    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    const userRoles = user?.roles || [];
    const isApplicantOnly = isApplicantOnlyUser(userRoles);
    if (isApplicantOnly && !applicantMatchesApplication(user, app)) {
      return { status: 403, body: { message: "Forbidden" } };
    }

    if (isHearingOnlyUser(userRoles) && user?.district) {
      if (app.description?.district !== user.district) {
        return { status: 403, body: { message: "Forbidden" } };
      }
    }

    return { status: 200, body: mapApplicationResponse(app) };
  }
}
