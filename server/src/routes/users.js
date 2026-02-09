import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { mapUser } from "../utils/mappers.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

router.use(authRequired);
router.get("/hearing-officers", async (req, res) => {
  const roles = req.user?.roles || [];
  const canAccess =
    roles.includes("registrar") ||
    roles.includes("admin") ||
    roles.includes("super_admin");
  if (!canAccess) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const officers = await User.find({ roles: "hearing_officer" }).sort({ full_name: 1, created_at: -1 });
  const payload = officers.map((user) => ({
    id: user._id.toString(),
    full_name: user.full_name || null,
    email: user.email || null,
    district: user.district || null,
  }));
  return res.json(payload);
});
router.use(requireRole(["admin", "super_admin"]));

const isSuperAdmin = (user) => (user?.roles || []).includes("super_admin");

router.get("/", async (req, res) => {
  const query = isSuperAdmin(req.user) ? {} : { roles: { $ne: "super_admin" } };
  const users = await User.find(query).sort({ created_at: -1 });
  return res.json(users.map(mapUser));
});

router.post("/", async (req, res) => {
  const { email, password, full_name, role, district, cnic } = req.body || {};

  if (!cnic || !password || !role) {
    return res.status(400).json({ message: "CNIC, password, and role are required." });
  }

  const normalizedCnic = String(cnic).trim();
  const existingByCnic = await User.findOne({ cnic: normalizedCnic });
  if (existingByCnic) {
    return res.status(409).json({ message: "User with this CNIC already exists." });
  }

  const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
  if (normalizedEmail) {
    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      return res.status(409).json({ message: "User with this email already exists." });
    }
  }
  if (role === "super_admin" && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    password_hash: passwordHash,
    full_name: full_name || null,
    roles: [role],
    district: district || null,
    cnic: normalizedCnic,
    created_by: req.user._id.toString(),
    updated_by: req.user._id.toString(),
  });

  await logAudit({
    action: "user.created",
    entityType: "user",
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { role, email: user.email || null, cnic: user.cnic || null },
  });

  return res.status(201).json(mapUser(user));
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { full_name, role, district, cnic } = req.body || {};

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  if (isSuperAdmin(user) && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (role === "super_admin" && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  user.full_name = full_name || null;
  if (role) {
    user.roles = [role];
  }
  if (district !== undefined) {
    user.district = district || null;
  }
  if (cnic !== undefined) {
    const normalizedCnic = String(cnic).trim();
    if (!normalizedCnic) {
      return res.status(400).json({ message: "CNIC is required." });
    }
    if (normalizedCnic !== user.cnic) {
      const existingByCnic = await User.findOne({ cnic: normalizedCnic });
      if (existingByCnic) {
        return res.status(409).json({ message: "User with this CNIC already exists." });
      }
    }
    user.cnic = normalizedCnic;
  }
  user.updated_by = req.user._id.toString();

  await user.save();
  await logAudit({
    action: "user.updated",
    entityType: "user",
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { role: user.roles?.[0] || null, district: user.district || null },
  });
  return res.json(mapUser(user));
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  if (isSuperAdmin(user) && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await user.deleteOne();
  await logAudit({
    action: "user.deleted",
    entityType: "user",
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { email: user.email },
  });
  return res.json({ success: true });
});

router.post("/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body || {};
  if (!new_password) {
    return res.status(400).json({ message: "New password is required." });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  if (isSuperAdmin(user) && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  user.password_hash = await bcrypt.hash(new_password, 10);
  user.updated_by = req.user._id.toString();
  await user.save();
  await logAudit({
    action: "user.password_reset",
    entityType: "user",
    entityId: user._id.toString(),
    user: req.user,
    req,
    details: { email: user.email },
  });
  return res.json({ success: true });
});

export default router;
