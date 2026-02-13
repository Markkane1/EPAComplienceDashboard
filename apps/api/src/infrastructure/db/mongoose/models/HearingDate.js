import mongoose from "mongoose";

const hearingDateSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  hearing_date: { type: Date, required: true },
  hearing_type: { type: String, default: "initial" },
  scheduled_by: { type: String, default: null },
  created_by: { type: String, default: null },
  updated_by: { type: String, default: null },
  reminder_sent: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  sequence_no: { type: Number, default: 1 },
  hearing_order_document_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ApplicationDocument",
    default: null,
  },
  created_at: { type: Date, default: () => new Date() },
});

// Add indexes for frequently queried fields
hearingDateSchema.index({ application_id: 1 });
hearingDateSchema.index({ application_id: 1, sequence_no: -1, hearing_date: -1 });
hearingDateSchema.index({ hearing_date: 1 });
hearingDateSchema.index({ is_active: 1 });
hearingDateSchema.index({ created_at: -1 });

export default mongoose.model("HearingDate", hearingDateSchema);
