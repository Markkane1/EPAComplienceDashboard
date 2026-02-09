import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import { mapUser } from "../utils/mappers.js";
import { sendMagicLoginEmail, sendVerificationEmail } from "../utils/email.js";
import { generateToken, hashToken } from "../utils/tokens.js";
import { logAudit } from "../utils/audit.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

const profileStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.user?._id?.toString() || "general";
    const dest = path.join(config.uploadDir, "profiles", userId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    cb(null, true);
  },
});

const normalizeContact = (value) => String(value || "").replace(/[\s-]/g, "");
const isValidPkContact = (value) => {
  if (!value) return true;
  const normalized = normalizeContact(value);
  return /^(\+92|0)3\d{9}$/.test(normalized);
};

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${req.body?.cnic || req.body?.email || ""}`,
});

const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip,
});

router.post("/login", authLimiter, async (req, res) => {
  const { cnic, password } = req.body || {};
  if (!cnic || !password) {
    return res.status(400).json({ message: "CNIC and password are required." });
  }

  const normalizedCnic = String(cnic).trim();
  const user = await User.findOne({ cnic: normalizedCnic });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const roles = user.roles || [];
  const isApplicantOnly =
    roles.includes("applicant") &&
    !roles.includes("admin") &&
    !roles.includes("super_admin") &&
    !roles.includes("registrar") &&
    !roles.includes("hearing_officer");
  if (isApplicantOnly && user.email && !user.email_verified) {
    return res.status(403).json({ message: "Please verify your email first." });
  }

  const token = jwt.sign({ userId: user._id.toString() }, config.jwtSecret, {
    expiresIn: "7d",
  });

  await logAudit({
    action: "auth.login",
    entityType: "user",
    entityId: user._id.toString(),
    user,
    req,
    details: { cnic: user.cnic, email: user.email || null },
  });

  return res.json({
    token,
    user: mapUser(user),
  });
});

router.post("/applicant-login", authLimiter, async (req, res) => {
  const { cnic, password } = req.body || {};
  if (!cnic || !password) {
    return res.status(400).json({ message: "CNIC and password are required." });
  }

  const normalizedCnic = String(cnic).trim();
  const user = await User.findOne({ cnic: normalizedCnic });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const roles = user.roles || [];
  const isApplicantOnly =
    roles.includes("applicant") &&
    !roles.includes("admin") &&
    !roles.includes("super_admin") &&
    !roles.includes("registrar") &&
    !roles.includes("hearing_officer");

  if (!isApplicantOnly) {
    return res.status(403).json({ message: "Applicant access only." });
  }
  if (user.email && !user.email_verified) {
    return res.status(403).json({ message: "Please verify your email first." });
  }

  const token = jwt.sign({ userId: user._id.toString() }, config.jwtSecret, {
    expiresIn: "7d",
  });

  await logAudit({
    action: "auth.login.applicant",
    entityType: "user",
    entityId: user._id.toString(),
    user,
    req,
    details: { cnic: user.cnic, email: user.email || null },
  });

  return res.json({
    token,
    user: mapUser(user),
  });
});

router.get("/magic", tokenLimiter, async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ message: "Token is required." });
  }

  const user = await User.findOne({
    magic_login_token: hashToken(String(token)),
    magic_login_expires_at: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }

  user.email_verified = true;
  user.email_verified_at = user.email_verified_at || new Date();
  user.magic_login_token = null;
  user.magic_login_expires_at = null;
  await user.save();

  const jwtToken = jwt.sign({ userId: user._id.toString() }, config.jwtSecret, {
    expiresIn: "7d",
  });

  await logAudit({
    action: "auth.magic_login",
    entityType: "user",
    entityId: user._id.toString(),
    user,
    req,
  });

  return res.json({ token: jwtToken, user: mapUser(user) });
});

router.post("/magic/request", authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(404).json({ message: "No account found for this email." });
  }

  const magicToken = generateToken(24);
  user.magic_login_token = hashToken(magicToken);
  user.magic_login_expires_at = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const magicUrl = `${config.appBaseUrl}/magic-login?token=${magicToken}`;
  await sendMagicLoginEmail({ email: user.email, loginUrl: magicUrl });

  await logAudit({
    action: "auth.magic_login_requested",
    entityType: "user",
    entityId: user._id.toString(),
    user,
    req,
  });

  return res.json({ success: true });
});

router.post("/signup", authLimiter, async (req, res) => {
  const { email, password, full_name, cnic } = req.body || {};
  const normalizedCnic = String(cnic || "").trim();
  if (!normalizedCnic || !password) {
    return res.status(400).json({ message: "CNIC and password are required." });
  }

  let normalizedEmail = email ? String(email).toLowerCase().trim() : null;
  if (normalizedEmail === "") {
    normalizedEmail = null;
  }
  const existingByCnic = await User.findOne({ cnic: normalizedCnic });
  if (existingByCnic) {
    if (existingByCnic.roles?.includes("applicant") && !existingByCnic.email_verified && existingByCnic.email) {
      const verificationToken = generateToken(24);
      existingByCnic.verification_token = hashToken(verificationToken);
      existingByCnic.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await existingByCnic.save();

      const verifyUrl = `${config.appBaseUrl}/verify-email?token=${verificationToken}`;
      await sendVerificationEmail({ email: existingByCnic.email, verifyUrl });
      return res.json({ success: true, message: "Verification email sent." });
    }
    return res.status(409).json({ message: "User already exists." });
  }

  if (normalizedEmail) {
    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      if (existingByEmail.roles?.includes("applicant") && !existingByEmail.email_verified) {
        const verificationToken = generateToken(24);
        existingByEmail.verification_token = hashToken(verificationToken);
        existingByEmail.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await existingByEmail.save();

        const verifyUrl = `${config.appBaseUrl}/verify-email?token=${verificationToken}`;
        await sendVerificationEmail({ email: existingByEmail.email, verifyUrl });
        return res.json({ success: true, message: "Verification email sent." });
      }
      return res.status(409).json({ message: "User already exists." });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const shouldVerifyEmail = Boolean(normalizedEmail);
  const verificationToken = shouldVerifyEmail ? generateToken(24) : null;
  const userPayload = {
    password_hash: passwordHash,
    full_name: full_name || null,
    roles: ["applicant"],
    cnic: normalizedCnic,
    email_verified: shouldVerifyEmail ? false : true,
    verification_token: shouldVerifyEmail ? hashToken(verificationToken) : null,
    verification_expires_at: shouldVerifyEmail
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null,
    created_by: null,
    updated_by: null,
  };
  if (normalizedEmail) {
    userPayload.email = normalizedEmail;
  }

  const user = await User.create(userPayload);

  await logAudit({
    action: "auth.signup",
    entityType: "user",
    entityId: user._id.toString(),
    user,
    req,
    details: { email: user.email || null, cnic: user.cnic, role: "applicant" },
  });

  if (shouldVerifyEmail) {
    const verifyUrl = `${config.appBaseUrl}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail({ email: user.email, verifyUrl });
    return res.status(201).json({ success: true, message: "Verification email sent." });
  }

  return res.status(201).json({ success: true, message: "Account created. You can now sign in." });
});

router.get("/verify-email", tokenLimiter, async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ message: "Token is required." });
  }

  const user = await User.findOne({
    verification_token: hashToken(String(token)),
    verification_expires_at: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }

  user.email_verified = true;
  user.email_verified_at = new Date();
  user.verification_token = null;
  user.verification_expires_at = null;
  await user.save();

  await logAudit({
    action: "auth.email_verified",
    entityType: "user",
    entityId: user._id.toString(),
    user,
    req,
  });

  return res.json({ success: true });
});

router.get("/me", authRequired, (req, res) => {
  return res.json({ user: mapUser(req.user) });
});

router.put("/profile", authRequired, async (req, res) => {
  const { first_name, last_name, designation, contact_number, email, cnic } = req.body || {};
  if (cnic !== undefined && cnic !== req.user.cnic) {
    return res.status(400).json({ message: "CNIC cannot be updated." });
  }
  if (first_name !== undefined) {
    req.user.first_name = first_name ? String(first_name).trim() : null;
  }
  if (last_name !== undefined) {
    req.user.last_name = last_name ? String(last_name).trim() : null;
  }
  if (designation !== undefined) {
    req.user.designation = designation ? String(designation).trim() : null;
  }
  if (contact_number !== undefined) {
    if (!isValidPkContact(contact_number)) {
      return res.status(400).json({ message: "Contact number must be a valid Pakistani mobile number." });
    }
    const normalizedContact = normalizeContact(contact_number);
    req.user.contact_number = normalizedContact || null;
  }
  if (email !== undefined) {
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
    if (normalizedEmail && normalizedEmail !== req.user.email) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing && existing._id.toString() !== req.user._id.toString()) {
        return res.status(400).json({ message: "Email already in use." });
      }
    }
    if (normalizedEmail !== req.user.email) {
      req.user.email = normalizedEmail;
      req.user.email_verified = false;
      req.user.email_verified_at = null;
    }
  }
  const fullName = [req.user.first_name, req.user.last_name].filter(Boolean).join(" ").trim();
  req.user.full_name = fullName || req.user.full_name || null;
  req.user.updated_by = req.user._id.toString();
  await req.user.save();
  await logAudit({
    action: "user.profile_updated",
    entityType: "user",
    entityId: req.user._id.toString(),
    user: req.user,
    req,
  });
  return res.json({ user: mapUser(req.user) });
});

router.post("/profile-picture", authRequired, profileUpload.single("profile_image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Profile image is required." });
  }

  if (req.user.profile_image_path) {
    const existingPath = path.join(process.cwd(), req.user.profile_image_path);
    if (fs.existsSync(existingPath)) {
      fs.unlinkSync(existingPath);
    }
  }

  const relativePath = path
    .relative(config.uploadDir, req.file.path)
    .replace(/\\/g, "/");
  req.user.profile_image_path = `uploads/${relativePath}`;
  req.user.updated_by = req.user._id.toString();
  await req.user.save();

  await logAudit({
    action: "user.profile_image_updated",
    entityType: "user",
    entityId: req.user._id.toString(),
    user: req.user,
    req,
  });

  return res.json({ user: mapUser(req.user) });
});

router.delete("/profile-picture", authRequired, async (req, res) => {
  if (req.user.profile_image_path) {
    const existingPath = path.join(process.cwd(), req.user.profile_image_path);
    if (fs.existsSync(existingPath)) {
      fs.unlinkSync(existingPath);
    }
  }
  req.user.profile_image_path = null;
  req.user.updated_by = req.user._id.toString();
  await req.user.save();

  await logAudit({
    action: "user.profile_image_removed",
    entityType: "user",
    entityId: req.user._id.toString(),
    user: req.user,
    req,
  });

  return res.json({ user: mapUser(req.user) });
});

router.post("/change-password", authRequired, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ message: "Current and new password are required." });
  }
  const valid = await bcrypt.compare(current_password, req.user.password_hash);
  if (!valid) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  req.user.password_hash = await bcrypt.hash(new_password, 10);
  req.user.updated_by = req.user._id.toString();
  await req.user.save();
  await logAudit({
    action: "user.password_changed",
    entityType: "user",
    entityId: req.user._id.toString(),
    user: req.user,
    req,
  });
  return res.json({ success: true });
});

export default router;
