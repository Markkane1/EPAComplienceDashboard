import dotenv from "dotenv";
import path from "path";

dotenv.config();

const rootDir = process.cwd();

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/punjab_compliance",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  corsOrigin: envOrigins.length ? envOrigins : defaultOrigins,
  uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, "uploads"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8080",
  adminEmail: process.env.ADMIN_EMAIL || "admin@local.test",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin123!",
  adminName: process.env.ADMIN_NAME || "System Admin",
  adminCnic: process.env.ADMIN_CNIC || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "no-reply@example.com",
};
