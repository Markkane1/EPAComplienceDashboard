import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authRequired } from "../middlewares/auth.js";
import { config } from "../../../infrastructure/config/config.js";
import { authLimiter, registrationLimiter, passwordChangeLimiter } from "../middlewares/rateLimit.js";

export const createAuthRoutes = (authController) => {
  const router = Router();

  const profileStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = req.user?._id?.toString() || "general";
      const dest = path.join(config.uploadDir, "profiles", userId);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  });

  const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        cb(new Error("Only image uploads are allowed."));
        return;
      }
      cb(null, true);
    },
  });

  // CRITICAL: Use strict rate limiting on auth endpoints
  router.post("/applicant-login", authLimiter, authController.applicantLogin);
  router.post("/login", authLimiter, authController.login);
  router.get("/magic", authLimiter, authController.magicLogin);
  router.post("/magic/request", authLimiter, authController.magicRequest);
  
  // Registration endpoint with moderate rate limiting
  router.post("/signup", registrationLimiter, authController.signup);
  router.post("/signup-legacy", registrationLimiter, authController.signupLegacy);
  
  router.get("/verify-email", authController.verifyEmail);
  router.get("/me", authRequired, authController.me);
  router.put("/profile", authRequired, authController.updateProfile);
  router.post(
    "/profile-picture",
    authRequired,
    profileUpload.single("profile_image"),
    authController.updateProfileImage
  );
  router.delete("/profile-picture", authRequired, authController.removeProfileImage);
  router.post("/change-password", authRequired, passwordChangeLimiter, authController.changePassword);

  return router;
};

export default createAuthRoutes;
