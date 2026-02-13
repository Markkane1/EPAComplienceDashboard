import bcrypt from "bcryptjs";
import User from "../db/mongoose/models/User.js";
import { config } from "../config/config.js";

export async function ensureBootstrapUser() {
  const count = await User.countDocuments();
  if (count > 0) return null;

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  const user = await User.create({
    email: config.adminEmail.toLowerCase(),
    password_hash: passwordHash,
    full_name: config.adminName,
    roles: ["admin", "super_admin"],
    ...(config.adminCnic ? { cnic: config.adminCnic.trim() } : {}),
  });

  if (!config.adminCnic) {
    console.warn("Warning: ADMIN_CNIC is not set. The bootstrap admin cannot sign in with CNIC.");
  }

  return user;
}

