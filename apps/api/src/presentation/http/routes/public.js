import { Router } from "express";

export const createPublicRoutes = (publicController) => {
  const router = Router();

  router.get("/applications/:trackingId", publicController.getApplication);
  router.get("/applications/:trackingId/hearings", publicController.getHearings);

  return router;
};

export default createPublicRoutes;
