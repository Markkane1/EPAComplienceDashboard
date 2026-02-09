import { Router } from "express";
import AuditLog from "../models/AuditLog.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authRequired);
router.use(requireRole(["admin", "super_admin"]));

router.get("/", async (req, res) => {
  const { entity_type, entity_id, user_id, limit } = req.query;
  const query = {};
  if (entity_type) query.entity_type = String(entity_type);
  if (entity_id) query.entity_id = String(entity_id);
  if (user_id) query.user_id = String(user_id);

  const pageLimit = Number(limit) > 0 ? Number(limit) : 50;
  const logs = await AuditLog.find(query).sort({ created_at: -1 }).limit(pageLimit);

  return res.json(
    logs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      user_id: log.user_id,
      user_email: log.user_email,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      details: log.details,
      created_at: log.created_at?.toISOString() || null,
    }))
  );
});

export default router;
