import cron from "node-cron";
import HearingDate from "../../db/mongoose/models/HearingDate.js";
import Application from "../../db/mongoose/models/Application.js";
import User from "../../db/mongoose/models/User.js";
import { createNotification, notifyUsersByIds } from "../notifications.js";

const getDayBounds = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const startStaffNotificationJob = () => {
  cron.schedule("0 */1 * * *", async () => {
    const { start, end } = getDayBounds();

    const hearings = await HearingDate.find({
      hearing_date: { $gte: start, $lte: end },
      is_active: true,
    });

    if (!hearings.length) return;

    const appIds = hearings.map((hearing) => hearing.application_id);
    const apps = await Application.find({ _id: { $in: appIds } });
    const appMap = new Map(apps.map((app) => [app._id.toString(), app]));

    const registrarUsers = await User.find({ roles: "registrar" }).select("_id");
    const registrarIds = registrarUsers.map((user) => user._id.toString());

    for (const hearing of hearings) {
      const app = appMap.get(hearing.application_id.toString());
      if (!app) continue;

      const hearingDate = hearing.hearing_date;
      const formattedDate = hearingDate ? hearingDate.toLocaleString() : "today";
      const link = `/dashboard/applications/${app._id.toString()}`;
      const basePayload = {
        applicationId: app._id.toString(),
        title: "Hearing Today",
        message: `${app.tracking_id} hearing is scheduled for ${formattedDate}.`,
        type: "hearing_today",
        link,
        dedupeKey: `hearing_today:${hearing._id.toString()}`,
      };

      const officerId =
        app.assigned_hearing_officer_id || app.hearing_officer_id || hearing.scheduled_by || null;
      if (officerId) {
        await createNotification({
          recipientUserId: officerId,
          ...basePayload,
          dedupeKey: `${basePayload.dedupeKey}:${officerId}`,
        });
      }

      if (app.assigned_registrar_id) {
        await createNotification({
          recipientUserId: app.assigned_registrar_id,
          ...basePayload,
          dedupeKey: `${basePayload.dedupeKey}:${app.assigned_registrar_id}`,
        });
      } else if (registrarIds.length) {
        await notifyUsersByIds(registrarIds, basePayload);
      }
    }
  });
};

