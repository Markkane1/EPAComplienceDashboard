import { Router } from "express";
import { authRequired, requireRole, optionalAuth } from "../middlewares/auth.js";
import { uploadLimiter } from "../middlewares/rateLimit.js";
import { applicationUpload } from "../../../infrastructure/storage/applicationUploads.js";

export const createApplicationRoutes = (applicationController) => {
  const router = Router();

  router.post("/", optionalAuth, applicationController.create);
  router.get(
    "/stats",
    authRequired,
    requireRole(["hearing_officer", "registrar", "admin", "super_admin"]),
    applicationController.stats
  );
  router.get("/:id", authRequired, applicationController.getById);
  router.get("/:id/hearings", authRequired, applicationController.listHearings);
  router.post(
    "/:id/violation",
    authRequired,
    requireRole(["hearing_officer", "admin", "super_admin"]),
    applicationController.setViolation
  );
  router.get("/", authRequired, applicationController.list);
  router.put("/:id", authRequired, applicationController.update);
  router.get("/:id/documents", authRequired, applicationController.listDocuments);
  router.get("/:id/remarks", authRequired, applicationController.listRemarks);
  router.post(
    "/:id/documents",
    optionalAuth,
    uploadLimiter,
    applicationUpload.single("file"),
    applicationController.uploadDocument
  );
  router.post(
    "/:id/mark-incomplete",
    authRequired,
    requireRole(["registrar", "admin", "super_admin"]),
    applicationController.markIncomplete
  );
  router.post(
    "/:id/mark-complete",
    authRequired,
    requireRole(["registrar", "admin", "super_admin"]),
    applicationController.markComplete
  );
  router.post("/:id/schedule", authRequired, applicationController.schedule);
  router.post(
    "/:id/adjourn",
    authRequired,
    requireRole(["hearing_officer", "admin", "super_admin"]),
    applicationUpload.single("hearing_order"),
    applicationController.adjourn
  );
  router.post(
    "/:id/approve",
    authRequired,
    requireRole(["hearing_officer", "admin", "super_admin"]),
    applicationUpload.single("hearing_order"),
    applicationController.approve
  );
  router.post(
    "/:id/reject",
    authRequired,
    requireRole(["hearing_officer", "admin", "super_admin"]),
    applicationUpload.single("hearing_order"),
    applicationController.reject
  );

  return router;
};

export default createApplicationRoutes;
