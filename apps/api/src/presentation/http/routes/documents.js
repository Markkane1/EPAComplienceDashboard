import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";

export const createDocumentRoutes = (documentController) => {
  const router = Router();

  router.get("/:id/download", authRequired, documentController.download);

  return router;
};

export default createDocumentRoutes;
