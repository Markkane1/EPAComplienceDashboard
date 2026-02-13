import dotenv from "dotenv";
import path from "path";

dotenv.config();

const rootDir = process.cwd();
const isProd = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV !== 'production';

// Validate JWT Secret
const validateJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const msg = 'FATAL: JWT_SECRET environment variable is not set. Set a strong, random secret before starting the application.';
    if (isProd) throw new Error(msg);
    console.warn('⚠️ WARNING:', msg);
    return 'dev-secret-change-me';
  }
  if (secret === 'dev-secret' && isProd) {
    throw new Error('FATAL: Default JWT secret detected in production! Set a unique JWT_SECRET.');
  }
  if (secret.length < 32 && isProd) {
    console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters long');
  }
  return secret;
};

// Validate Admin Password
const validateAdminPassword = () => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const msg = 'FATAL: ADMIN_PASSWORD must be set before startup';
    if (isProd) throw new Error(msg);
    console.warn('⚠️ WARNING:', msg);
    return 'TempPassword123!Change-Me';
  }
  if (password === 'Admin123!' && isProd) {
    throw new Error('FATAL: Default admin password detected in production!');
  }
  if (password.length < 12) {
    console.warn('⚠️ WARNING: Admin password should be at least 12 characters');
  }
  return password;
};

// Only allow localhost in development, explicit whitelist in production
const defaultOrigins = isDev ? [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
] : [];

const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Warn about public tunnel services
if (envOrigins.some(o => o.includes('.free.pinggy.link'))) {
  console.warn('⚠️ WARNING: Public tunneling service detected in CORS origins. Remove for production!');
}

const corsOrigins = envOrigins.length ? envOrigins : defaultOrigins;
if (isProd && !corsOrigins.length) {
  throw new Error('FATAL: CORS_ORIGIN must be configured for production');
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/punjab_compliance",
  jwtSecret: validateJwtSecret(),
  corsOrigin: corsOrigins,
  uploadDir: process.env.UPLOAD_DIR || path.join(rootDir, "uploads"),
  secureUploadsDir: process.env.SECURE_UPLOADS_DIR || path.join(rootDir, "..", "secure-uploads"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8080",
  adminEmail: process.env.ADMIN_EMAIL || "admin@local.test",
  adminPassword: validateAdminPassword(),
  adminName: process.env.ADMIN_NAME || "System Admin",
  adminCnic: process.env.ADMIN_CNIC || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "no-reply@example.com",
};
