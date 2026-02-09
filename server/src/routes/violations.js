import { Router } from "express";
import ViolationType from "../models/ViolationType.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

router.get("/", async (_req, res) => {
  const violations = await ViolationType.find().sort({ name: 1 });
  return res.json(
    violations.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      subviolations: item.subviolations.map((sub) => ({
        id: sub._id.toString(),
        name: sub.name,
      })),
    }))
  );
});

router.post("/", authRequired, requireRole(["admin", "super_admin", "registrar"]), async (req, res) => {
  const { name, subviolations } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Violation type is required." });
  }

  const violation = await ViolationType.create({
    name: String(name).trim(),
    subviolations: Array.isArray(subviolations)
      ? subviolations
          .map((sub) => ({ name: String(sub).trim() }))
          .filter((sub) => sub.name)
      : [],
    created_by: req.user._id.toString(),
    updated_by: req.user._id.toString(),
  });

  await logAudit({
    action: "violation.created",
    entityType: "violation_type",
    entityId: violation._id.toString(),
    user: req.user,
    req,
    details: { name: violation.name },
  });

  return res.status(201).json({
    id: violation._id.toString(),
    name: violation.name,
    subviolations: violation.subviolations.map((sub) => ({
      id: sub._id.toString(),
      name: sub.name,
    })),
  });
});

router.put("/:id", authRequired, requireRole(["admin", "super_admin", "registrar"]), async (req, res) => {
  const { name, subviolations } = req.body || {};
  const violation = await ViolationType.findById(req.params.id);
  if (!violation) {
    return res.status(404).json({ message: "Violation type not found." });
  }

  if (name) {
    violation.name = String(name).trim();
  }

  if (Array.isArray(subviolations)) {
    violation.subviolations = subviolations
      .map((sub) => ({ name: String(sub).trim() }))
      .filter((sub) => sub.name);
  }

  violation.updated_by = req.user._id.toString();
  await violation.save();

  await logAudit({
    action: "violation.updated",
    entityType: "violation_type",
    entityId: violation._id.toString(),
    user: req.user,
    req,
    details: { name: violation.name },
  });

  return res.json({
    id: violation._id.toString(),
    name: violation.name,
    subviolations: violation.subviolations.map((sub) => ({
      id: sub._id.toString(),
      name: sub.name,
    })),
  });
});

router.delete("/:id", authRequired, requireRole(["admin", "super_admin", "registrar"]), async (req, res) => {
  const violation = await ViolationType.findById(req.params.id);
  if (!violation) {
    return res.status(404).json({ message: "Violation type not found." });
  }

  await violation.deleteOne();
  await logAudit({
    action: "violation.deleted",
    entityType: "violation_type",
    entityId: violation._id.toString(),
    user: req.user,
    req,
    details: { name: violation.name },
  });
  return res.json({ success: true });
});

export default router;
