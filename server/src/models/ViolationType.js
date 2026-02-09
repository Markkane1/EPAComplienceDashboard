import mongoose from "mongoose";

const subViolationSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const violationTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    subviolations: { type: [subViolationSchema], default: [] },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.model("ViolationType", violationTypeSchema);
