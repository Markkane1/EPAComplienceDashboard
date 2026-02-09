import { Router } from "express";
import path from "path";
import fs from "fs";
import ApplicationDocument from "../models/ApplicationDocument.js";
import Application from "../models/Application.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/:id/download", authRequired, async (req, res) => {
  const doc = await ApplicationDocument.findById(req.params.id);
  if (!doc) {
    return res.status(404).json({ message: "Document not found." });
  }

  const app = await Application.findById(doc.application_id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  const userRoles = req.user?.roles || [];
  const isApplicantOnly =
    userRoles.includes("applicant") &&
    !userRoles.includes("admin") &&
    !userRoles.includes("super_admin") &&
    !userRoles.includes("registrar") &&
    !userRoles.includes("hearing_officer");

  if (isApplicantOnly) {
    const matchesEmail =
      req.user?.email && app.applicant_email === String(req.user.email).toLowerCase().trim();
    const userCnic = req.user?.cnic ? String(req.user.cnic).trim() : null;
    const matchesCnic = userCnic && app.applicant_cnic === userCnic;
    const matchesDescriptionCnic = userCnic && app.description?.cnic === userCnic;
    const matchesUserId = app.applicant_user_id === req.user._id.toString();
    if (!matchesUserId && !matchesEmail && !matchesCnic && !matchesDescriptionCnic) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const isHearingOnly =
    userRoles.includes("hearing_officer") &&
    !userRoles.includes("admin") &&
    !userRoles.includes("super_admin") &&
    !userRoles.includes("registrar");
  if (isHearingOnly && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const filePath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found." });
  }

  return res.download(filePath, doc.file_name);
});

export default router;
