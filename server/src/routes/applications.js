import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import Application from "../models/Application.js";
import ApplicationDocument from "../models/ApplicationDocument.js";
import ApplicationRemark from "../models/ApplicationRemark.js";
import HearingDate from "../models/HearingDate.js";
import { authRequired, requireRole, optionalAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { mapApplication, mapDocument } from "../utils/mappers.js";
import {
  sendApplicationSubmittedEmail,
  sendHearingScheduledEmail,
  sendStatusChangedEmail,
  sendMagicLoginEmail,
} from "../utils/email.js";
import { createNotification, notifyUsersByRole } from "../utils/notifications.js";
import { logAudit } from "../utils/audit.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateToken, hashToken } from "../utils/tokens.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const appId = req.params.id || "general";
    const dest = path.join(config.uploadDir, appId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF uploads are allowed."));
      return;
    }
    cb(null, true);
  },
});

const createHearingOrderDocument = async ({ applicationId, file, user }) => {
  const relativePath = path.relative(config.uploadDir, file.path).replace(/\\/g, "/");
  const fileName = `Hearing Order: ${file.originalname}`;
  return ApplicationDocument.create({
    application_id: applicationId,
    file_name: fileName,
    file_path: `uploads/${relativePath}`,
    file_type: file.mimetype,
    file_size: file.size,
    created_by: user?._id?.toString() || null,
    updated_by: user?._id?.toString() || null,
  });
};

const attachHearingOrderToLatest = async (applicationId, orderDocId) => {
  const latestHearing = await HearingDate.find({ application_id: applicationId })
    .sort({ sequence_no: -1, hearing_date: -1 })
    .limit(1);
  if (latestHearing.length) {
    latestHearing[0].hearing_order_document_id = orderDocId;
    await latestHearing[0].save();
  }
};

const CLOSED_STATUSES = ["approved_resolved", "rejected_closed"];
const HEARING_DIVISION_STATUSES = ["complete", "hearing_scheduled", "under_hearing"];

const isHearingOnlyUser = (roles = []) =>
  roles.includes("hearing_officer") &&
  !roles.includes("admin") &&
  !roles.includes("super_admin") &&
  !roles.includes("registrar");

const applyViolationType = (app, violationType, subViolation) => {
  if (!violationType && !subViolation) return;
  const description = app.description && typeof app.description === "object" ? app.description : {};
  app.description = {
    ...description,
    ...(violationType ? { violation_type: violationType } : {}),
    ...(subViolation ? { sub_violation: subViolation } : {}),
  };
};

const ensureApplicantUser = async (app) => {
  if (!app?.applicant_email) return null;
  const normalizedEmail = String(app.applicant_email).toLowerCase().trim();
  let applicantUser = await User.findOne({ email: normalizedEmail });
  if (!applicantUser) {
    const randomPassword = generateToken(16);
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    applicantUser = await User.create({
      email: normalizedEmail,
      password_hash: passwordHash,
      full_name: app.applicant_name || null,
      roles: ["applicant"],
      cnic: app.applicant_cnic || null,
      email_verified: false,
    });
  } else if (!applicantUser.cnic && app.applicant_cnic) {
    applicantUser.cnic = app.applicant_cnic;
    await applicantUser.save();
  }

  if (!app.applicant_user_id) {
    app.applicant_user_id = applicantUser._id.toString();
    app.updated_by = app.updated_by || applicantUser._id.toString();
    await app.save();
  }

  return applicantUser;
};

const sendApplicantMagicLink = async (applicantUser) => {
  if (!applicantUser?.email) return;
  const roles = applicantUser.roles || [];
  const isStaff = roles.some((role) =>
    ["admin", "super_admin", "registrar", "hearing_officer"].includes(role)
  );
  const isApplicantOnly = roles.includes("applicant") && !isStaff;
  if (!isApplicantOnly) {
    return;
  }
  const magicToken = generateToken(24);
  applicantUser.magic_login_token = hashToken(magicToken);
  applicantUser.magic_login_expires_at = new Date(Date.now() + 60 * 60 * 1000);
  await applicantUser.save();

  const magicUrl = `${config.appBaseUrl}/magic-login?token=${magicToken}`;
  await sendMagicLoginEmail({ email: applicantUser.email, loginUrl: magicUrl });
};

router.post("/", optionalAuth, async (req, res) => {
  const {
    applicant_name,
    applicant_email,
    applicant_phone,
    company_name,
    company_address,
    application_type,
    description,
  } = req.body || {};

  if (!applicant_name || !applicant_email || !application_type) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  const applicantCnic = description?.cnic ? String(description.cnic).trim() : null;
  if (req.user?.roles?.includes("applicant")) {
    if (!req.user.cnic || !applicantCnic || req.user.cnic !== applicantCnic) {
      return res.status(400).json({ message: "Applicant CNIC does not match profile." });
    }
  }

  const app = await Application.create({
    applicant_name,
    applicant_email: String(applicant_email).toLowerCase().trim(),
    applicant_phone: applicant_phone || null,
    applicant_cnic: applicantCnic,
    applicant_user_id: req.user?._id?.toString() || null,
    company_name: company_name || null,
    company_address: company_address || null,
    application_type,
    description: description || null,
    created_by: req.user?._id?.toString() || null,
    updated_by: req.user?._id?.toString() || null,
  });

  const applicantUser = await ensureApplicantUser(app);
  await sendApplicantMagicLink(applicantUser);

  await sendApplicationSubmittedEmail({
    email: app.applicant_email,
    trackingId: app.tracking_id,
    applicantName: app.applicant_name,
  });

  await notifyUsersByRole("registrar", {
    applicationId: app._id.toString(),
    title: "New Application Submitted",
    message: `${app.tracking_id} submitted by ${app.applicant_name}.`,
    type: "application_submitted",
    link: `/dashboard/applications/${app._id.toString()}`,
    dedupeKey: `application_submitted:${app._id.toString()}`,
  });

  await logAudit({
    action: "application.submitted",
    entityType: "application",
    entityId: app._id.toString(),
    user: req.user || null,
    req,
    details: {
      tracking_id: app.tracking_id,
      applicant_email: app.applicant_email,
      applicant_name: app.applicant_name,
    },
  });

  return res.status(201).json(mapApplication(app));
});

router.get("/stats", authRequired, async (_req, res) => {
  const userRoles = _req.user?.roles || [];
  const isHearingOnly = isHearingOnlyUser(userRoles);
  const query = {};
  if (isHearingOnly) {
    if (_req.user?.district) {
      query["description.district"] = _req.user.district;
    } else {
      query["description.district"] = "__none__";
    }
  }
  const applications = await Application.find(query, { status: 1 });
  const counts = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === "submitted").length,
    hearing_scheduled: applications.filter((a) => a.status === "hearing_scheduled").length,
    approved: applications.filter((a) => a.status === "approved_resolved").length,
    incomplete: applications.filter((a) => a.status === "incomplete").length,
  };
  return res.json(counts);
});

router.get("/:id", authRequired, async (req, res) => {
  const app = await Application.findById(req.params.id);
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

  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  return res.json(mapApplication(app));
});

router.get("/:id/hearings", authRequired, async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const hearings = await HearingDate.find({ application_id: app._id }).sort({ hearing_date: 1 });
  const hearingOrderIds = hearings
    .map((hearing) => hearing.hearing_order_document_id)
    .filter(Boolean);
  const hearingOrderDocs = hearingOrderIds.length
    ? await ApplicationDocument.find({ _id: { $in: hearingOrderIds } })
    : [];
  const hearingOrderMap = new Map(
    hearingOrderDocs.map((doc) => [doc._id.toString(), { id: doc._id.toString(), file_name: doc.file_name }])
  );
  return res.json(
    hearings.map((hearing) => ({
      id: hearing._id.toString(),
      hearing_date: hearing.hearing_date?.toISOString() || null,
      hearing_type: hearing.hearing_type,
      is_active: hearing.is_active,
      sequence_no: hearing.sequence_no,
      hearing_order_document:
        hearing.hearing_order_document_id && hearingOrderMap.has(hearing.hearing_order_document_id.toString())
          ? hearingOrderMap.get(hearing.hearing_order_document_id.toString())
          : null,
      created_at: hearing.created_at?.toISOString() || null,
    }))
  );
});

router.post("/:id/violation", authRequired, requireRole(["hearing_officer", "admin", "super_admin"]), async (req, res) => {
  const { violation_type, sub_violation } = req.body || {};
  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  applyViolationType(app, violation_type, sub_violation);
  app.updated_by = req.user._id.toString();
  await app.save();

  await logAudit({
    action: "application.violation_set",
    entityType: "application",
    entityId: app._id.toString(),
    user: req.user,
    req,
    details: { violation_type, sub_violation },
  });

  return res.json(mapApplication(app));
});

router.get("/", authRequired, async (req, res) => {
  const { status, status_in: statusIn, search, limit, page } = req.query;

  const query = {};
  const userRoles = req.user?.roles || [];
  const isHearingOnly = isHearingOnlyUser(userRoles);
  const isApplicantOnly =
    userRoles.includes("applicant") &&
    !userRoles.includes("admin") &&
    !userRoles.includes("super_admin") &&
    !userRoles.includes("registrar") &&
    !userRoles.includes("hearing_officer");

  let requestedStatuses = null;
  if (statusIn) {
    const statuses = String(statusIn)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses.length) {
      requestedStatuses = statuses;
    }
  } else if (status && status !== "all") {
    if (status === "closed") {
      requestedStatuses = CLOSED_STATUSES;
    } else {
      requestedStatuses = [String(status)];
    }
  }

  if (isApplicantOnly) {
    const applicantId = req.user?._id?.toString();
    const applicantEmail = req.user?.email;
    const applicantCnic = req.user?.cnic;
    const cnicValue = applicantCnic ? String(applicantCnic).trim() : null;
    query.$or = [
      { applicant_user_id: applicantId || "__none__" },
      ...(applicantEmail ? [{ applicant_email: String(applicantEmail).toLowerCase().trim() }] : []),
      ...(cnicValue ? [{ applicant_cnic: cnicValue }] : []),
      ...(cnicValue ? [{ "description.cnic": cnicValue }] : []),
    ];
    if (requestedStatuses) {
      query.status = { $in: requestedStatuses };
    }
  } else if (isHearingOnly) {
    const allowedOpen = HEARING_DIVISION_STATUSES;
    const allowedClosed = CLOSED_STATUSES;
    const filtered = requestedStatuses
      ? requestedStatuses.filter((value) => [...allowedOpen, ...allowedClosed].includes(value))
      : allowedOpen;
    const wantsClosed = filtered.some((value) => allowedClosed.includes(value));
    const wantsOpen = filtered.some((value) => allowedOpen.includes(value));

    if (wantsOpen && wantsClosed) {
      query.$or = [
        { status: { $in: filtered.filter((value) => allowedOpen.includes(value)) } },
        {
          status: { $in: filtered.filter((value) => allowedClosed.includes(value)) },
          hearing_officer_id: req.user?._id?.toString() || "__none__",
        },
      ];
    } else if (wantsClosed) {
      query.status = { $in: filtered.filter((value) => allowedClosed.includes(value)) };
      query.hearing_officer_id = req.user?._id?.toString() || "__none__";
    } else {
      query.status = { $in: filtered };
    }

    if (req.user?.district) {
      query["description.district"] = req.user.district;
    } else {
      query["description.district"] = "__none__";
    }
  } else if (requestedStatuses) {
    query.status = { $in: requestedStatuses };
  }

  if (search) {
    const term = String(search).trim();
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { tracking_id: regex },
        { applicant_name: regex },
        { applicant_email: regex },
      ];
    }
  }

  const pageSize = limit ? Number(limit) : null;
  const pageNumber = page ? Math.max(1, Number(page)) : null;

  if (pageSize && pageNumber) {
    const total = await Application.countDocuments(query);
    const results = await Application.find(query)
      .sort({ created_at: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    return res.json({
      items: results.map(mapApplication),
      total,
      page: pageNumber,
      limit: pageSize,
    });
  }

  const results = await Application.find(query).sort({ created_at: -1 }).limit(pageSize || 0);
  return res.json(results.map(mapApplication));
});

router.put("/:id", authRequired, async (req, res) => {
  const userRoles = req.user?.roles || [];
  const isApplicantOnly =
    userRoles.includes("applicant") &&
    !userRoles.includes("admin") &&
    !userRoles.includes("super_admin") &&
    !userRoles.includes("registrar") &&
    !userRoles.includes("hearing_officer");

  if (!isApplicantOnly) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  if (app.applicant_user_id !== req.user._id.toString()) {
    const matchesEmail =
      req.user?.email && app.applicant_email === String(req.user.email).toLowerCase().trim();
    const userCnic = req.user?.cnic ? String(req.user.cnic).trim() : null;
    const matchesCnic = userCnic && app.applicant_cnic === userCnic;
    const matchesDescriptionCnic = userCnic && app.description?.cnic === userCnic;
    if (!matchesEmail && !matchesCnic && !matchesDescriptionCnic) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  if (app.status !== "incomplete") {
    return res.status(400).json({ message: "Only incomplete applications can be updated." });
  }

  const {
    applicant_name,
    applicant_email,
    applicant_phone,
    company_name,
    company_address,
    description,
  } = req.body || {};

  const applicantCnic = description?.cnic ? String(description.cnic).trim() : null;
  if (req.user?.cnic && applicantCnic && req.user.cnic !== applicantCnic) {
    return res.status(400).json({ message: "Applicant CNIC does not match profile." });
  }

  if (applicant_name) app.applicant_name = applicant_name;
  if (applicant_email) app.applicant_email = String(applicant_email).toLowerCase().trim();
  if (applicant_phone !== undefined) app.applicant_phone = applicant_phone || null;
  if (company_name !== undefined) app.company_name = company_name || null;
  if (company_address !== undefined) app.company_address = company_address || null;
  if (description !== undefined) app.description = description || null;
  if (!app.applicant_user_id) app.applicant_user_id = req.user._id.toString();

  app.status = "submitted";
  app.updated_by = req.user._id.toString();
  await app.save();

  await ApplicationRemark.create({
    application_id: app._id,
    user_id: req.user._id.toString(),
    remark: "Application updated by applicant",
    remark_type: "resubmitted",
    status_at_time: app.status,
    created_by: req.user._id.toString(),
    updated_by: req.user._id.toString(),
  });

  await sendStatusChangedEmail({
    email: app.applicant_email,
    trackingId: app.tracking_id,
    status: app.status,
  });

  await notifyUsersByRole("registrar", {
    applicationId: app._id.toString(),
    title: "Application Resubmitted",
    message: `${app.tracking_id} updated by ${app.applicant_name}.`,
    type: "application_resubmitted",
    link: `/dashboard/applications/${app._id.toString()}`,
    dedupeKey: `application_resubmitted:${app._id.toString()}`,
  });

  await logAudit({
    action: "application.resubmitted",
    entityType: "application",
    entityId: app._id.toString(),
    user: req.user,
    req,
    details: { tracking_id: app.tracking_id },
  });

  return res.json(mapApplication(app));
});

router.get("/:id/documents", authRequired, async (req, res) => {
  const app = await Application.findById(req.params.id);
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

  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const documents = await ApplicationDocument.find({ application_id: req.params.id }).sort({ uploaded_at: 1 });
  const baseUrl = config.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
  return res.json(documents.map((doc) => mapDocument(doc, baseUrl)));
});

router.get("/:id/remarks", authRequired, async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const remarks = await ApplicationRemark.find({ application_id: app._id }).sort({ created_at: 1 });
  return res.json(
    remarks.map((remark) => ({
      id: remark._id.toString(),
      remark: remark.remark,
      proceedings: remark.proceedings || null,
      remark_type: remark.remark_type || "general",
      status_at_time: remark.status_at_time,
      created_at: remark.created_at?.toISOString() || null,
    }))
  );
});

router.post("/:id/documents", optionalAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File is required." });
  }

  const app = await Application.findById(req.params.id);
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

  if (req.user) {
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

  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
      if (app.description?.district !== req.user.district) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
  } else {
    const createdAt = app.created_at ? new Date(app.created_at) : null;
    const windowMs = 15 * 60 * 1000;
    if (!createdAt || Date.now() - createdAt.getTime() > windowMs) {
      return res.status(403).json({ message: "Please sign in to upload documents." });
    }
  }

  const { doc_type } = req.body || {};
  const relativePath = path.relative(config.uploadDir, req.file.path).replace(/\\/g, "/");
  const fileName = doc_type ? `${doc_type}: ${req.file.originalname}` : req.file.originalname;

  const doc = await ApplicationDocument.create({
    application_id: req.params.id,
    file_name: fileName,
    file_path: `uploads/${relativePath}`,
    file_type: req.file.mimetype,
    file_size: req.file.size,
    created_by: req.user?._id?.toString() || null,
    updated_by: req.user?._id?.toString() || null,
  });

  const baseUrl = config.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
  await logAudit({
    action: "application.document_uploaded",
    entityType: "application_document",
    entityId: doc._id.toString(),
    user: req.user || null,
    req,
    details: {
      application_id: req.params.id,
      file_name: fileName,
      file_size: req.file.size,
    },
  });
  return res.status(201).json(mapDocument(doc, baseUrl));
});

router.post("/:id/mark-incomplete", authRequired, requireRole(["registrar", "admin", "super_admin"]), async (req, res) => {
  const { remarks } = req.body || {};
  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  if (CLOSED_STATUSES.includes(app.status)) {
    return res.status(400).json({ message: "Closed applications cannot be updated." });
  }

  const wasRegistrarUnassigned = !app.assigned_registrar_id;
  if (wasRegistrarUnassigned) {
    app.assigned_registrar_id = req.user._id.toString();
  }
  app.status = "incomplete";
  app.updated_by = req.user._id.toString();
  await app.save();

  const applicantUser = await ensureApplicantUser(app);
  await sendApplicantMagicLink(applicantUser);

  await ApplicationRemark.create({
    application_id: app._id,
    user_id: req.user._id.toString(),
    remark: remarks || "Marked incomplete",
    remark_type: "incomplete",
    status_at_time: app.status,
  });

  await sendStatusChangedEmail({
    email: app.applicant_email,
    trackingId: app.tracking_id,
    status: app.status,
  });

  if (wasRegistrarUnassigned && app.assigned_registrar_id === req.user._id.toString()) {
    await createNotification({
      recipientUserId: req.user._id.toString(),
      applicationId: app._id.toString(),
      title: "Application Assigned",
      message: `${app.tracking_id} is assigned to you.`,
      type: "application_assigned",
      link: `/dashboard/applications/${app._id.toString()}`,
      dedupeKey: `application_assigned:${app._id.toString()}`,
    });
  }

  await logAudit({
    action: "application.mark_incomplete",
    entityType: "application",
    entityId: app._id.toString(),
    user: req.user,
    req,
    details: { status: app.status, registrar_id: app.assigned_registrar_id || null },
  });

  return res.json(mapApplication(app));
});

router.post("/:id/mark-complete", authRequired, requireRole(["registrar", "admin", "super_admin"]), async (req, res) => {
  const { remarks } = req.body || {};
  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  if (CLOSED_STATUSES.includes(app.status)) {
    return res.status(400).json({ message: "Closed applications cannot be updated." });
  }

  const wasRegistrarUnassigned = !app.assigned_registrar_id;
  if (wasRegistrarUnassigned) {
    app.assigned_registrar_id = req.user._id.toString();
  }
  app.status = "complete";
  app.updated_by = req.user._id.toString();
  await app.save();

  if (remarks) {
    await ApplicationRemark.create({
      application_id: app._id,
      user_id: req.user._id.toString(),
      remark: remarks,
      remark_type: "complete",
      status_at_time: app.status,
    });
  }

  await sendStatusChangedEmail({
    email: app.applicant_email,
    trackingId: app.tracking_id,
    status: app.status,
  });

  if (wasRegistrarUnassigned && app.assigned_registrar_id === req.user._id.toString()) {
    await createNotification({
      recipientUserId: req.user._id.toString(),
      applicationId: app._id.toString(),
      title: "Application Assigned",
      message: `${app.tracking_id} is assigned to you.`,
      type: "application_assigned",
      link: `/dashboard/applications/${app._id.toString()}`,
      dedupeKey: `application_assigned:${app._id.toString()}`,
    });
  }

  await logAudit({
    action: "application.mark_complete",
    entityType: "application",
    entityId: app._id.toString(),
    user: req.user,
    req,
    details: { status: app.status, registrar_id: app.assigned_registrar_id || null },
  });

  return res.json(mapApplication(app));
});

router.post("/:id/schedule", authRequired, async (req, res) => {
  const {
    hearing_datetime,
    hearing_type,
    hearing_officer_id,
    remarks,
    proceedings,
    violation_type,
    sub_violation,
  } = req.body || {};
  if (!hearing_datetime) {
    return res.status(400).json({ message: "Hearing date is required." });
  }
  const scheduledAt = new Date(hearing_datetime);
  if (Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ message: "Invalid hearing date." });
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Hearing date must be in the future." });
  }

  const app = await Application.findById(req.params.id);
  if (!app) {
    return res.status(404).json({ message: "Application not found." });
  }

  const userRoles = req.user?.roles || [];
  const isRegistrar =
    userRoles.includes("registrar") &&
    !userRoles.includes("admin") &&
    !userRoles.includes("super_admin");
  const isHearingOfficer = userRoles.includes("hearing_officer");
  const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");

  if (CLOSED_STATUSES.includes(app.status)) {
    return res.status(400).json({ message: "Closed applications cannot be scheduled." });
  }
  if (["submitted", "incomplete"].includes(app.status)) {
    return res.status(400).json({ message: "Application is not marked complete." });
  }
  if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
    if (app.description?.district !== req.user.district) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const hearingCount = await HearingDate.countDocuments({ application_id: app._id });
  const isFirstHearing = hearingCount === 0;
  let selectedOfficer = null;

  if (isFirstHearing) {
    if (!isRegistrar && !isAdmin) {
      return res.status(403).json({ message: "Only the registrar or admin can schedule the first hearing." });
    }
    if (app.status !== "complete") {
      return res.status(400).json({ message: "Application must be marked complete before scheduling the first hearing." });
    }
    if (!hearing_officer_id) {
      return res.status(400).json({ message: "Hearing officer is required for the first hearing." });
    }
    selectedOfficer = await User.findById(String(hearing_officer_id));
    if (!selectedOfficer) {
      return res.status(404).json({ message: "Hearing officer not found." });
    }
    const officerRoles = selectedOfficer.roles || [];
    if (!officerRoles.includes("hearing_officer")) {
      return res.status(400).json({ message: "Selected user is not a hearing officer." });
    }
    const appDistrict = app.description?.district || null;
    if (appDistrict && selectedOfficer.district && selectedOfficer.district !== appDistrict) {
      return res.status(400).json({ message: "Hearing officer district does not match application district." });
    }
  } else {
    if (!isHearingOfficer && !isAdmin) {
      return res.status(403).json({ message: "Only a hearing officer or admin can schedule subsequent hearings." });
    }
    if (!isAdmin) {
      if (!app.assigned_hearing_officer_id) {
        return res.status(400).json({ message: "No hearing officer assigned to this application." });
      }
      if (app.assigned_hearing_officer_id !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the assigned hearing officer can schedule subsequent hearings." });
      }
    }
  }

  await HearingDate.updateMany({ application_id: app._id }, { is_active: false });
  const lastHearing = await HearingDate.find({ application_id: app._id })
    .sort({ sequence_no: -1 })
    .limit(1);
  const nextSequence = lastHearing.length ? lastHearing[0].sequence_no + 1 : 1;

  const hearing = await HearingDate.create({
    application_id: app._id,
    hearing_date: new Date(hearing_datetime),
    hearing_type: hearing_type || "initial",
    scheduled_by: req.user._id.toString(),
    created_by: req.user._id.toString(),
    updated_by: req.user._id.toString(),
    is_active: true,
    sequence_no: nextSequence,
  });

  const wasOfficerUnassigned = !app.assigned_hearing_officer_id;
  if (isFirstHearing) {
    app.assigned_hearing_officer_id = selectedOfficer?._id.toString();
  } else if (wasOfficerUnassigned && isHearingOfficer) {
    app.assigned_hearing_officer_id = req.user._id.toString();
  }
  app.status = "hearing_scheduled";
  applyViolationType(app, violation_type, sub_violation);
  app.updated_by = req.user._id.toString();
  await app.save();

  await ApplicationRemark.create({
    application_id: app._id,
    user_id: req.user._id.toString(),
    remark: remarks || `Hearing scheduled (${hearing_type || "initial"}).`,
    proceedings: proceedings || null,
    remark_type: "hearing_scheduled",
    status_at_time: app.status,
    created_by: req.user._id.toString(),
    updated_by: req.user._id.toString(),
  });

  await sendHearingScheduledEmail({
    email: app.applicant_email,
    trackingId: app.tracking_id,
    hearingDate: hearing.hearing_date.toISOString(),
  });

  await sendStatusChangedEmail({
    email: app.applicant_email,
    trackingId: app.tracking_id,
    status: app.status,
  });

  if (wasOfficerUnassigned && app.assigned_hearing_officer_id === req.user._id.toString()) {
    await createNotification({
      recipientUserId: req.user._id.toString(),
      applicationId: app._id.toString(),
      title: "Application Assigned",
      message: `${app.tracking_id} is assigned to you.`,
      type: "application_assigned",
      link: `/dashboard/applications/${app._id.toString()}`,
      dedupeKey: `application_assigned:${app._id.toString()}`,
    });
  }

  const hearingOfficerId = app.assigned_hearing_officer_id || (isHearingOfficer ? req.user._id.toString() : null);
  if (hearingOfficerId) {
    await createNotification({
      recipientUserId: hearingOfficerId,
      applicationId: app._id.toString(),
      title: "Hearing Scheduled",
      message: `${app.tracking_id} scheduled for ${hearing.hearing_date.toLocaleString()}.`,
      type: "hearing_scheduled",
      link: `/dashboard/applications/${app._id.toString()}`,
      dedupeKey: `hearing_scheduled:${hearing._id.toString()}`,
    });
  }

  await logAudit({
    action: "application.hearing_scheduled",
    entityType: "hearing",
    entityId: hearing._id.toString(),
    user: req.user,
    req,
    details: {
      application_id: app._id.toString(),
      tracking_id: app.tracking_id,
      hearing_date: hearing.hearing_date.toISOString(),
      hearing_officer_id: app.assigned_hearing_officer_id || null,
    },
  });

  return res.json({ hearing_id: hearing._id.toString(), application: mapApplication(app) });
});

router.post(
  "/:id/adjourn",
  authRequired,
  requireRole(["hearing_officer", "admin", "super_admin"]),
  upload.single("hearing_order"),
  async (req, res) => {
    const { remarks, new_hearing_datetime, proceedings, violation_type, sub_violation } = req.body || {};
    const cleanedRemarks = typeof remarks === "string" ? remarks.trim() : "";
    const cleanedProceedings = typeof proceedings === "string" ? proceedings.trim() : "";
    if (!req.file) {
      return res.status(400).json({ message: "Hearing order PDF is required." });
    }
    if (cleanedRemarks.length < 10) {
      return res.status(400).json({ message: "Remarks must be at least 10 characters." });
    }
    if (!new_hearing_datetime) {
      return res.status(400).json({ message: "New hearing date is required." });
    }
    const adjournDate = new Date(new_hearing_datetime);
    if (Number.isNaN(adjournDate.getTime())) {
      return res.status(400).json({ message: "Invalid hearing date." });
    }
    if (adjournDate.getTime() <= Date.now()) {
      return res.status(400).json({ message: "Hearing date must be in the future." });
    }

    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: "Application not found." });
    }

    if (!["hearing_scheduled", "under_hearing"].includes(app.status)) {
      return res.status(400).json({ message: "Application is not under hearing." });
    }

    if (CLOSED_STATUSES.includes(app.status)) {
      return res.status(400).json({ message: "Closed applications cannot be adjourned." });
    }
    if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
      if (app.description?.district !== req.user.district) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
    const isHearingOfficer = userRoles.includes("hearing_officer");
    if (!isAdmin && isHearingOfficer) {
      if (!app.assigned_hearing_officer_id) {
        return res.status(400).json({ message: "No hearing officer assigned to this application." });
      }
      if (app.assigned_hearing_officer_id !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the assigned hearing officer can adjourn this hearing." });
      }
    }

    const hearingCount = await HearingDate.countDocuments({ application_id: app._id });
    if (hearingCount === 0) {
      return res.status(400).json({ message: "No hearing scheduled for this application." });
    }

    await HearingDate.updateMany({ application_id: app._id, is_active: true }, { is_active: false });
    const lastHearing = await HearingDate.find({ application_id: app._id })
      .sort({ sequence_no: -1 })
      .limit(1);
    const nextSequence = lastHearing.length ? lastHearing[0].sequence_no + 1 : 1;

    const hearingOrderDoc = await createHearingOrderDocument({ applicationId: app._id, file: req.file, user: req.user });

    const hearing = await HearingDate.create({
      application_id: app._id,
      hearing_date: new Date(new_hearing_datetime),
      hearing_type: "extension",
      scheduled_by: req.user._id.toString(),
      created_by: req.user._id.toString(),
      updated_by: req.user._id.toString(),
      is_active: true,
      sequence_no: nextSequence,
      hearing_order_document_id: hearingOrderDoc?._id || null,
    });

    const wasOfficerUnassigned = !app.assigned_hearing_officer_id;
    if (wasOfficerUnassigned) {
      app.assigned_hearing_officer_id = req.user._id.toString();
    }
    app.status = "under_hearing";
    applyViolationType(app, violation_type, sub_violation);
    app.updated_by = req.user._id.toString();
    await app.save();

    await ApplicationRemark.create({
      application_id: app._id,
      user_id: req.user._id.toString(),
      remark: cleanedRemarks || "Hearing adjourned",
      proceedings: cleanedProceedings || null,
      remark_type: "adjourned",
      status_at_time: app.status,
      created_by: req.user._id.toString(),
      updated_by: req.user._id.toString(),
    });

    await sendStatusChangedEmail({
      email: app.applicant_email,
      trackingId: app.tracking_id,
      status: app.status,
    });

    if (wasOfficerUnassigned && app.assigned_hearing_officer_id === req.user._id.toString()) {
      await createNotification({
        recipientUserId: req.user._id.toString(),
        applicationId: app._id.toString(),
        title: "Application Assigned",
        message: `${app.tracking_id} is assigned to you.`,
        type: "application_assigned",
        link: `/dashboard/applications/${app._id.toString()}`,
        dedupeKey: `application_assigned:${app._id.toString()}`,
      });
    }

    await logAudit({
      action: "application.adjourned",
      entityType: "hearing",
      entityId: hearing._id.toString(),
      user: req.user,
      req,
      details: {
        application_id: app._id.toString(),
        tracking_id: app.tracking_id,
        hearing_date: hearing.hearing_date.toISOString(),
      },
    });

    return res.json(mapApplication(app));
  }
);

router.post(
  "/:id/approve",
  authRequired,
  requireRole(["hearing_officer", "admin", "super_admin"]),
  upload.single("hearing_order"),
  async (req, res) => {
    const { remarks, proceedings, violation_type, sub_violation } = req.body || {};
    const cleanedRemarks = typeof remarks === "string" ? remarks.trim() : "";
    const cleanedProceedings = typeof proceedings === "string" ? proceedings.trim() : "";
    if (!req.file) {
      return res.status(400).json({ message: "Hearing order PDF is required." });
    }
    if (cleanedRemarks.length < 10) {
      return res.status(400).json({ message: "Remarks must be at least 10 characters." });
    }
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: "Application not found." });
    }

    if (!["hearing_scheduled", "under_hearing"].includes(app.status)) {
      return res.status(400).json({ message: "Application is not under hearing." });
    }

    if (CLOSED_STATUSES.includes(app.status)) {
      return res.status(400).json({ message: "Application is already closed." });
    }
    if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
      if (app.description?.district !== req.user.district) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
    const isHearingOfficer = userRoles.includes("hearing_officer");
    if (!isAdmin && isHearingOfficer) {
      if (!app.assigned_hearing_officer_id) {
        return res.status(400).json({ message: "No hearing officer assigned to this application." });
      }
      if (app.assigned_hearing_officer_id !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the assigned hearing officer can approve this application." });
      }
    }

    app.status = "approved_resolved";
    app.closed_at = new Date();
    app.closed_by = req.user._id.toString();
    app.hearing_officer_id = req.user._id.toString();
    const hearingOrderDoc = await createHearingOrderDocument({ applicationId: app._id, file: req.file, user: req.user });
    await attachHearingOrderToLatest(app._id, hearingOrderDoc?._id || null);

    applyViolationType(app, violation_type, sub_violation);
    app.updated_by = req.user._id.toString();
    await app.save();

    const applicantUser = await ensureApplicantUser(app);
    await sendApplicantMagicLink(applicantUser);

    await HearingDate.updateMany({ application_id: app._id }, { is_active: false });

    await ApplicationRemark.create({
      application_id: app._id,
      user_id: req.user._id.toString(),
      remark: cleanedRemarks || "Approved",
      proceedings: cleanedProceedings || null,
      remark_type: "approved",
      status_at_time: app.status,
      created_by: req.user._id.toString(),
      updated_by: req.user._id.toString(),
    });

    await sendStatusChangedEmail({
      email: app.applicant_email,
      trackingId: app.tracking_id,
      status: app.status,
    });

    await logAudit({
      action: "application.approved",
      entityType: "application",
      entityId: app._id.toString(),
      user: req.user,
      req,
      details: { status: app.status, tracking_id: app.tracking_id },
    });

    return res.json(mapApplication(app));
  }
);

router.post(
  "/:id/reject",
  authRequired,
  requireRole(["hearing_officer", "admin", "super_admin"]),
  upload.single("hearing_order"),
  async (req, res) => {
    const { remarks, proceedings, violation_type, sub_violation } = req.body || {};
    const cleanedRemarks = typeof remarks === "string" ? remarks.trim() : "";
    const cleanedProceedings = typeof proceedings === "string" ? proceedings.trim() : "";
    if (!req.file) {
      return res.status(400).json({ message: "Hearing order PDF is required." });
    }
    if (cleanedRemarks.length < 10) {
      return res.status(400).json({ message: "Remarks must be at least 10 characters." });
    }
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: "Application not found." });
    }

    if (!["hearing_scheduled", "under_hearing"].includes(app.status)) {
      return res.status(400).json({ message: "Application is not under hearing." });
    }

    if (CLOSED_STATUSES.includes(app.status)) {
      return res.status(400).json({ message: "Application is already closed." });
    }
    if (isHearingOnlyUser(req.user?.roles) && req.user?.district) {
      if (app.description?.district !== req.user.district) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
    const isHearingOfficer = userRoles.includes("hearing_officer");
    if (!isAdmin && isHearingOfficer) {
      if (!app.assigned_hearing_officer_id) {
        return res.status(400).json({ message: "No hearing officer assigned to this application." });
      }
      if (app.assigned_hearing_officer_id !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the assigned hearing officer can reject this application." });
      }
    }

    app.status = "rejected_closed";
    app.closed_at = new Date();
    app.closed_by = req.user._id.toString();
    app.hearing_officer_id = req.user._id.toString();
    const hearingOrderDoc = await createHearingOrderDocument({ applicationId: app._id, file: req.file, user: req.user });
    await attachHearingOrderToLatest(app._id, hearingOrderDoc?._id || null);

    applyViolationType(app, violation_type, sub_violation);
    app.updated_by = req.user._id.toString();
    await app.save();

    const applicantUser = await ensureApplicantUser(app);
    await sendApplicantMagicLink(applicantUser);

    await HearingDate.updateMany({ application_id: app._id }, { is_active: false });

    await ApplicationRemark.create({
      application_id: app._id,
      user_id: req.user._id.toString(),
      remark: cleanedRemarks || "Rejected",
      proceedings: cleanedProceedings || null,
      remark_type: "rejected",
      status_at_time: app.status,
      created_by: req.user._id.toString(),
      updated_by: req.user._id.toString(),
    });

    await sendStatusChangedEmail({
      email: app.applicant_email,
      trackingId: app.tracking_id,
      status: app.status,
    });

    await logAudit({
      action: "application.rejected",
      entityType: "application",
      entityId: app._id.toString(),
      user: req.user,
      req,
      details: { status: app.status, tracking_id: app.tracking_id },
    });

    return res.json(mapApplication(app));
  }
);

export default router;
