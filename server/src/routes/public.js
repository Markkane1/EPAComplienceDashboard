import { Router } from "express";
import Application from "../models/Application.js";
import HearingDate from "../models/HearingDate.js";

const router = Router();

router.get("/applications/:trackingId", async (req, res) => {
  const trackingId = String(req.params.trackingId || "").trim().toUpperCase();
  const app = await Application.findOne({ tracking_id: trackingId });
  if (!app) {
    return res.json([]);
  }

  return res.json([
    {
      tracking_id: app.tracking_id,
      application_type: app.application_type,
      status: app.status,
      applicant_name: app.applicant_name,
      company_name: app.company_name || null,
      created_at: app.created_at?.toISOString() || null,
      updated_at: app.updated_at?.toISOString() || null,
    },
  ]);
});

router.get("/applications/:trackingId/hearings", async (req, res) => {
  const trackingId = String(req.params.trackingId || "").trim().toUpperCase();
  const app = await Application.findOne({ tracking_id: trackingId });
  if (!app) {
    return res.json([]);
  }

  const hearings = await HearingDate.find({ application_id: app._id }).sort({ hearing_date: 1 });
  const response = hearings.map((hearing) => ({
    id: hearing._id.toString(),
    hearing_date: hearing.hearing_date?.toISOString() || null,
    hearing_type: hearing.hearing_type,
  }));

  return res.json(response);
});

export default router;