import mongoose from "mongoose";

const applicationRemarkSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  user_id: { type: String, default: null },
  remark: { type: String, required: true },
  proceedings: { type: String, default: null },
  remark_type: { type: String, default: "general" },
  status_at_time: { type: String, required: true },
  created_by: { type: String, default: null },
  updated_by: { type: String, default: null },
  created_at: { type: Date, default: () => new Date() },
});

export default mongoose.model("ApplicationRemark", applicationRemarkSchema);
