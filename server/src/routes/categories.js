import { Router } from "express";
import IndustryCategory from "../models/IndustryCategory.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

router.get("/", async (_req, res) => {
  const categories = await IndustryCategory.find().sort({ name: 1 });
  return res.json(
    categories.map((cat) => ({
      id: cat._id.toString(),
      name: cat.name,
      subcategories: cat.subcategories.map((sub) => ({
        id: sub._id.toString(),
        name: sub.name,
      })),
    }))
  );
});

router.post("/", authRequired, requireRole(["admin", "super_admin"]), async (req, res) => {
  const { name, subcategories } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Category name is required." });
  }

  const category = await IndustryCategory.create({
    name: String(name).trim(),
    subcategories: Array.isArray(subcategories)
      ? subcategories
          .map((sub) => ({ name: String(sub).trim() }))
          .filter((sub) => sub.name)
      : [],
    created_by: req.user._id.toString(),
    updated_by: req.user._id.toString(),
  });

  await logAudit({
    action: "category.created",
    entityType: "industry_category",
    entityId: category._id.toString(),
    user: req.user,
    req,
    details: { name: category.name },
  });

  return res.status(201).json({
    id: category._id.toString(),
    name: category.name,
    subcategories: category.subcategories.map((sub) => ({
      id: sub._id.toString(),
      name: sub.name,
    })),
  });
});

router.put("/:id", authRequired, requireRole(["admin", "super_admin"]), async (req, res) => {
  const { name, subcategories } = req.body || {};
  const category = await IndustryCategory.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found." });
  }

  if (name) {
    category.name = String(name).trim();
  }

  if (Array.isArray(subcategories)) {
    category.subcategories = subcategories
      .map((sub) => ({ name: String(sub).trim() }))
      .filter((sub) => sub.name);
  }

  category.updated_by = req.user._id.toString();
  await category.save();

  await logAudit({
    action: "category.updated",
    entityType: "industry_category",
    entityId: category._id.toString(),
    user: req.user,
    req,
    details: { name: category.name },
  });

  return res.json({
    id: category._id.toString(),
    name: category.name,
    subcategories: category.subcategories.map((sub) => ({
      id: sub._id.toString(),
      name: sub.name,
    })),
  });
});

router.delete("/:id", authRequired, requireRole(["admin", "super_admin"]), async (req, res) => {
  const category = await IndustryCategory.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found." });
  }

  await category.deleteOne();
  await logAudit({
    action: "category.deleted",
    entityType: "industry_category",
    entityId: category._id.toString(),
    user: req.user,
    req,
    details: { name: category.name },
  });
  return res.json({ success: true });
});

export default router;
