import { mapDocumentResponse } from "../../dtos/mapDocumentResponse.js";
import { applicantMatchesApplication, isApplicantOnlyUser, isHearingOnlyUser } from "./utils.js";

export class ListApplicationDocumentsUseCase {
  constructor({ applicationRepository, documentRepository }) {
    this.applicationRepository = applicationRepository;
    this.documentRepository = documentRepository;
  }

  async execute({ id, user, baseUrl }) {
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

    const documents = await this.documentRepository.findByApplicationId(id, { sort: { uploaded_at: 1 } });
    return { status: 200, body: documents.map((doc) => mapDocumentResponse(doc, baseUrl)) };
  }
}
