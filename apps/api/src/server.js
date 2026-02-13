import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { config } from "./infrastructure/config/config.js";
import { createAuthRoutes } from "./presentation/http/routes/auth.js";
import { createApplicationRoutes } from "./presentation/http/routes/applications.js";
import { createPublicRoutes } from "./presentation/http/routes/public.js";
import { createDocumentRoutes } from "./presentation/http/routes/documents.js";
import userRoutes from "./presentation/http/routes/users.js";
import hearingRoutes from "./presentation/http/routes/hearings.js";
import reportRoutes from "./presentation/http/routes/reports.js";
import categoryRoutes from "./presentation/http/routes/categories.js";
import violationRoutes from "./presentation/http/routes/violations.js";
import notificationRoutes from "./presentation/http/routes/notifications.js";
import auditLogRoutes from "./presentation/http/routes/auditLogs.js";
import { apiLimiter } from "./presentation/http/middlewares/rateLimit.js";

export const createServer = ({ authController, applicationController, documentController, publicController }) => {
  const app = express();

  // HTTPS/TLS enforcement in production
  if (config.nodeEnv === 'production') {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(`https://${req.header('host')}${req.url}`);
      }
      next();
    });
  }

  // CORS configuration - strict whitelist only
  const corsOrigin = (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.corsOrigin.includes(origin)) {
      callback(null, true);
      return;
    }

    // Keep API responses functional while denying CORS for non-whitelisted origins.
    callback(null, false);
  };

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));

  // Comprehensive Security Headers
  app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    
    // Control referrer information
    res.setHeader("Referrer-Policy", "no-referrer");
    
    // Restrict feature access
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    
    // HSTS - enforce HTTPS
    if (config.nodeEnv === 'production') {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    
    // CSP - Content Security Policy
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    );
    
    // XSS Protection
    res.setHeader("X-XSS-Protection", "1; mode=block");
    
    // Cross-Origin policies
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    
    next();
  });

  // REMOVED: Public file serving is a security risk
  // app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", apiLimiter);

  app.use("/api/auth", createAuthRoutes(authController));
  app.use("/api/users", userRoutes);
  app.use("/api/applications", createApplicationRoutes(applicationController));
  app.use("/api/hearings", hearingRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/documents", createDocumentRoutes(documentController));
  app.use("/api/public", createPublicRoutes(publicController));
  app.use("/api/categories", categoryRoutes);
  app.use("/api/violations", violationRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/audit-logs", auditLogRoutes);

  app.use((err, _req, res, _next) => {
    console.error("Error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    
    const isDev = config.nodeEnv === 'development';
    const status = err.status || 500;
    
    // Don't leak internal details to client
    res.status(status).json({
      message: isDev ? err.message : "An error occurred",
      ...(isDev && { stack: err.stack }),
    });
  });

  return app;
};
