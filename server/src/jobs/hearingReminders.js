import cron from "node-cron";
import HearingDate from "../models/HearingDate.js";
import Application from "../models/Application.js";
import { sendHearingReminderEmail } from "../utils/email.js";

export const startHearingReminderJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();
    const from = new Date(now.getTime() + 55 * 60 * 1000);
    const to = new Date(now.getTime() + 65 * 60 * 1000);

    const hearings = await HearingDate.find({
      hearing_date: { $gte: from, $lte: to },
      is_active: true,
      reminder_sent: false,
    });

    if (!hearings.length) return;

    const appIds = hearings.map((h) => h.application_id);
    const apps = await Application.find({ _id: { $in: appIds } });
    const appMap = new Map(apps.map((app) => [app._id.toString(), app]));

    for (const hearing of hearings) {
      const app = appMap.get(hearing.application_id.toString());
      if (!app?.applicant_email) continue;

      await sendHearingReminderEmail({
        email: app.applicant_email,
        trackingId: app.tracking_id,
        hearingDate: hearing.hearing_date.toISOString(),
      });

      hearing.reminder_sent = true;
      await hearing.save();
    }
  });
};