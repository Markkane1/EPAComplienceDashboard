import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: String, default: null },
    user_id: { type: String, default: null },
    user_email: { type: String, default: null },
    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

auditLogSchema.index({ entity_type: 1, entity_id: 1, created_at: -1 });
auditLogSchema.index({ user_id: 1, created_at: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
