import AuditLog from "../db/mongoose/models/AuditLog.js";

export const logAudit = async ({ action, entityType, entityId = null, user = null, req = null, details = null }) => {
  if (!action || !entityType) return;
  try {
    await AuditLog.create({
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: user?._id?.toString() || null,
      user_email: user?.email || null,
      ip_address: req?.ip || null,
      user_agent: req?.get?.("user-agent") || null,
      details,
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
};

