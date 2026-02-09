import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { connectDb } from "./db.js";
import { config } from "./config.js";
import { ensureBootstrapUser } from "./utils/bootstrap.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import applicationRoutes from "./routes/applications.js";
import hearingRoutes from "./routes/hearings.js";
import publicRoutes from "./routes/public.js";
import reportRoutes from "./routes/reports.js";
import documentRoutes from "./routes/documents.js";
import categoryRoutes from "./routes/categories.js";
import violationRoutes from "./routes/violations.js";
import notificationRoutes from "./routes/notifications.js";
import auditLogRoutes from "./routes/auditLogs.js";
import { startHearingReminderJob } from "./jobs/hearingReminders.js";
import { startStaffNotificationJob } from "./jobs/staffNotifications.js";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = config.corsOrigin.includes(origin);
      return allowed ? callback(null, true) : callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/hearings", hearingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/violations", violationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const message = err?.message || "Server error";
  res.status(500).json({ message });
});

const start = async () => {
  await connectDb();
  const bootstrapUser = await ensureBootstrapUser();
  if (bootstrapUser) {
    console.log(`Bootstrap admin created: ${bootstrapUser.email}`);
  }
  if (config.jwtSecret === "dev-secret") {
    console.warn("Warning: JWT_SECRET is using the default value. Set a secure secret in production.");
  }
  if (config.adminPassword === "Admin123!") {
    console.warn("Warning: ADMIN_PASSWORD is using the default value. Set a secure password in production.");
  }
  startHearingReminderJob();
  startStaffNotificationJob();

  app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}`);
  });
};

start();
