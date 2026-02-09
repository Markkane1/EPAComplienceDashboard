import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient_user_id: { type: String, required: true },
    application_id: { type: String, default: null },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    type: { type: String, default: "general" },
    link: { type: String, default: null },
    dedupe_key: { type: String, default: null },
    is_read: { type: Boolean, default: false },
    read_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

notificationSchema.index({ recipient_user_id: 1, created_at: -1 });
notificationSchema.index({ recipient_user_id: 1, is_read: 1 });
notificationSchema.index({ recipient_user_id: 1, dedupe_key: 1 });

export default mongoose.model("Notification", notificationSchema);
