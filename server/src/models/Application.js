import mongoose from "mongoose";
import { generateTrackingId } from "../utils/tracking.js";

const applicationSchema = new mongoose.Schema(
  {
    tracking_id: { type: String, unique: true, default: generateTrackingId },
    applicant_name: { type: String, required: true },
    applicant_email: { type: String, required: true },
    applicant_phone: { type: String, default: null },
    applicant_cnic: { type: String, default: null },
    applicant_user_id: { type: String, default: null },
    company_name: { type: String, default: null },
    company_address: { type: String, default: null },
    application_type: { type: String, required: true },
    description: { type: mongoose.Schema.Types.Mixed, default: null },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "submitted",
        "complete",
        "incomplete",
        "hearing_scheduled",
        "under_hearing",
        "approved_resolved",
        "rejected_closed",
      ],
      default: "submitted",
    },
    assigned_registrar_id: { type: String, default: null },
    assigned_hearing_officer_id: { type: String, default: null },
    closed_at: { type: Date, default: null },
    closed_by: { type: String, default: null },
    hearing_officer_id: { type: String, default: null },
    registrar_id: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.model("Application", applicationSchema);
