import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, default: null },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    designation: { type: String, default: null },
    contact_number: { type: String, default: null },
    profile_image_path: { type: String, default: null },
    roles: { type: [String], default: [] },
    district: { type: String, default: null },
    cnic: { type: String, unique: true, sparse: true, trim: true, default: null },
    email_verified: { type: Boolean, default: false },
    email_verified_at: { type: Date, default: null },
    verification_token: { type: String, default: null },
    verification_expires_at: { type: Date, default: null },
    magic_login_token: { type: String, default: null },
    magic_login_expires_at: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    failedLoginAttemptsResetAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    last_login: { type: Date, default: null },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Add indexes for frequently queried fields
userSchema.index({ magic_login_token: 1, magic_login_expires_at: 1 });
userSchema.index({ verification_token: 1, verification_expires_at: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ created_at: -1 });

export default mongoose.model("User", userSchema);
