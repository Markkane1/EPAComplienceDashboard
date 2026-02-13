import path from "path";
import { config } from "../../../infrastructure/config/config.js";
import { applicantMatchesApplication, isApplicantOnlyUser, isHearingOnlyUser } from "../applications/utils.js";

export class DownloadDocumentUseCase {
  constructor({ documentRepository, applicationRepository, fileStorage }) {
    this.documentRepository = documentRepository;
    this.applicationRepository = applicationRepository;
    this.fileStorage = fileStorage;
  }

  async execute({ id, user }) {
    const doc = await this.documentRepository.findById(id);
    if (!doc) {
      return { status: 404, body: { message: "Document not found." } };
    }

    const app = await this.applicationRepository.findById(doc.application_id);
    if (!app) {
      return { status: 404, body: { message: "Application not found." } };
    }

    // Authorization checks
    const userRoles = user?.roles || [];
    const isApplicantOnly = isApplicantOnlyUser(userRoles);
    if (isApplicantOnly && !applicantMatchesApplication(user, app)) {
      return { status: 403, body: { message: "Forbidden" } };
    }

    const isHearingOnly =
      userRoles.includes("hearing_officer") &&
      !userRoles.includes("admin") &&
      !userRoles.includes("super_admin") &&
      !userRoles.includes("registrar");
    if (isHearingOnly && user?.district) {
      if (app.description?.district !== user.district) {
        return { status: 403, body: { message: "Forbidden" } };
      }
    }

    // SECURITY: Validate file path to prevent traversal attacks
    let filePath;
    try {
      // Normalize path to prevent traversal
      const normalizedStoredPath = path.normalize(doc.file_path);
      const uploadDirPath = path.normalize(config.secureUploadsDir);
      
      // Resolve to absolute path
      const resolvedPath = path.resolve(config.secureUploadsDir, normalizedStoredPath);
      
      // Ensure path is within secure uploads directory
      if (!resolvedPath.startsWith(uploadDirPath + path.sep) && resolvedPath !== uploadDirPath) {
        console.error(`[SECURITY] Path traversal attempt detected: ${resolvedPath}`);
        return { status: 403, body: { message: "Forbidden" } };
      }
      
      filePath = resolvedPath;
    } catch (error) {
      console.error(`[SECURITY] Invalid file path: ${error.message}`);
      return { status: 400, body: { message: "Invalid file path" } };
    }

    // Verify file exists
    if (!this.fileStorage.exists(filePath)) {
      return { status: 404, body: { message: "File not found." } };
    }

    return { 
      status: 200, 
      download: { 
        path: filePath, 
        filename: doc.file_name,
        mimetype: doc.file_mimetype || 'application/octet-stream'
      } 
    };
  }
}
