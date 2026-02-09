import mongoose from "mongoose";

const applicationDocumentSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  file_name: { type: String, required: true },
  file_path: { type: String, required: true },
  file_type: { type: String, default: null },
  file_size: { type: Number, default: null },
  created_by: { type: String, default: null },
  updated_by: { type: String, default: null },
  uploaded_at: { type: Date, default: () => new Date() },
});

export default mongoose.model("ApplicationDocument", applicationDocumentSchema);
