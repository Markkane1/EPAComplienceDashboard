import { mapDocumentResponse } from "../../dtos/mapDocumentResponse.js";
import { applicantMatchesApplication, isApplicantOnlyUser, isHearingOnlyUser } from "./utils.js";

export class UploadApplicationDocumentUseCase {
  constructor({ applicationRepository, documentRepository, auditLogger, fileStorage }) {
    this.applicationRepository = applicationRepository;
    this.documentRepository = documentRepository;
    this.auditLogger = auditLogger;
    this.fileStorage = fileStorage;
  }

  async execute({ id, user, file, doc_type, request, baseUrl }) {
    if (!file) {
      return { status: 400, body: { message: "File is required." } };
    }

    const app = await this.applicationRepository.findById(id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    const userRoles = user?.roles || [];
    const isApplicantOnly = isApplicantOnlyUser(userRoles);

    if (user) {
      if (isApplicantOnly && !applicantMatchesApplication(user, app)) {
        return { status: 403, body: { message: "Forbidden" } };
      }
      if (isHearingOnlyUser(userRoles) && user?.district) {
        if (app.description?.district !== user.district) {
          return { status: 403, body: { message: "Forbidden" } };
        }
      }
    } else {
      const createdAt = app.created_at ? new Date(app.created_at) : null;
      const windowMs = 15 * 60 * 1000;
      if (!createdAt || Date.now() - createdAt.getTime() > windowMs) {
        return { status: 403, body: { message: "Please sign in to upload documents." } };
      }
    }

    const relativePath = this.fileStorage.relativeToUploadDir(file.path);
    const fileName = doc_type ? `${doc_type}: ${file.originalname}` : file.originalname;

    const doc = await this.documentRepository.createDocument({
      application_id: id,
      file_name: fileName,
      file_path: `uploads/${relativePath}`,
      file_type: file.mimetype,
      file_size: file.size,
      created_by: user?._id?.toString?.() || user?.id || null,
      updated_by: user?._id?.toString?.() || user?.id || null,
    });

    await this.auditLogger.log({
      action: "application.document_uploaded",
      entityType: "application_document",
      entityId: doc.id,
      user: user || null,
      req: request,
      details: {
        application_id: id,
        file_name: fileName,
        file_size: file.size,
      },
    });

    return { status: 201, body: mapDocumentResponse(doc, baseUrl) };
  }
}
