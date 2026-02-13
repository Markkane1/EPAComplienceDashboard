import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../src/infrastructure/db/mongoose/db.js";
import { config } from "../src/infrastructure/config/config.js";
import User from "../src/infrastructure/db/mongoose/models/User.js";

const log = (message) => console.log(`[seed-admin-password] ${message}`);
const warn = (message) => console.warn(`[seed-admin-password] ${message}`);

const normalizeEmail = (value) => (value ? value.toLowerCase().trim() : "");
const normalizeCnic = (value) => (value ? value.trim() : "");

async function findTargetUser() {
  const adminEmail = normalizeEmail(config.adminEmail);
  const adminCnic = normalizeCnic(config.adminCnic);

  const byEmail = adminEmail ? await User.findOne({ email: adminEmail }) : null;
  const byCnic = adminCnic ? await User.findOne({ cnic: adminCnic }) : null;

  if (byEmail && byCnic && String(byEmail._id) !== String(byCnic._id)) {
    throw new Error("ADMIN_EMAIL and ADMIN_CNIC match different users. Resolve the conflict first.");
  }

  return byEmail || byCnic || null;
}

async function findSoleSuperAdmin() {
  const superAdmins = await User.find({ roles: "super_admin" });
  if (superAdmins.length === 1) return superAdmins[0];
  if (superAdmins.length > 1) {
    throw new Error(
      "Multiple super_admin users found and no matching ADMIN_EMAIL/ADMIN_CNIC. Aborting."
    );
  }
  return null;
}

async function ensureIdentifiers(target) {
  const adminEmail = normalizeEmail(config.adminEmail);
  const adminCnic = normalizeCnic(config.adminCnic);

  if (adminEmail && target.email !== adminEmail) {
    const existing = await User.findOne({ email: adminEmail });
    if (existing && String(existing._id) !== String(target._id)) {
      throw new Error("ADMIN_EMAIL already belongs to a different user.");
    }
    target.email = adminEmail;
  }

  if (adminCnic && target.cnic !== adminCnic) {
    const existing = await User.findOne({ cnic: adminCnic });
    if (existing && String(existing._id) !== String(target._id)) {
      throw new Error("ADMIN_CNIC already belongs to a different user.");
    }
    target.cnic = adminCnic;
  }
}

function ensureRoles(target) {
  const roles = new Set(target.roles || []);
  roles.add("admin");
  roles.add("super_admin");
  target.roles = Array.from(roles);
}

async function createAdminUser(passwordHash) {
  const adminEmail = normalizeEmail(config.adminEmail);
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is not set. Cannot create a new admin user.");
  }

  const adminCnic = normalizeCnic(config.adminCnic);
  const user = await User.create({
    email: adminEmail,
    password_hash: passwordHash,
    full_name: config.adminName,
    roles: ["admin", "super_admin"],
    ...(adminCnic ? { cnic: adminCnic } : {}),
  });

  if (!adminCnic) {
    warn("ADMIN_CNIC is not set. The bootstrap admin cannot sign in with CNIC.");
  }

  return user;
}

async function run() {
  await connectDb();
  try {
    if (!config.adminPassword) {
      throw new Error("ADMIN_PASSWORD is not set.");
    }

    if (config.adminPassword === "Admin123!") {
      warn("ADMIN_PASSWORD is using the default value. Set a secure password in production.");
    }
    if (!normalizeCnic(config.adminCnic)) {
      warn("ADMIN_CNIC is not set. The admin cannot sign in with CNIC.");
    }

    const passwordHash = await bcrypt.hash(config.adminPassword, 10);

    let target = await findTargetUser();
    if (!target) {
      target = await findSoleSuperAdmin();
    }

    if (target) {
      await ensureIdentifiers(target);
      ensureRoles(target);
      target.password_hash = passwordHash;
      await target.save();
      log(`Updated password for user ${target.email || target.cnic || target._id}.`);
      return;
    }

    const created = await createAdminUser(passwordHash);
    log(`Created admin user ${created.email || created._id}.`);
  } finally {
    await disconnectDb();
  }
}

run().catch((error) => {
  console.error("[seed-admin-password] Failed:", error.message);
  process.exit(1);
});
