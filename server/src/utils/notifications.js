import Notification from "../models/Notification.js";
import User from "../models/User.js";

export const createNotification = async ({
  recipientUserId,
  applicationId = null,
  title,
  message = "",
  type = "general",
  link = null,
  dedupeKey = null,
}) => {
  if (!recipientUserId || !title) return null;
  if (dedupeKey) {
    const existing = await Notification.findOne({
      recipient_user_id: recipientUserId,
      dedupe_key: dedupeKey,
    });
    if (existing) return existing;
  }

  return Notification.create({
    recipient_user_id: recipientUserId,
    application_id: applicationId,
    title,
    message,
    type,
    link,
    dedupe_key: dedupeKey,
  });
};

export const notifyUsersByIds = async (userIds, payload) => {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  await Promise.all(
    uniqueIds.map((userId) =>
      createNotification({
        recipientUserId: userId,
        ...payload,
        dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}:${userId}` : null,
      })
    )
  );
};

export const notifyUsersByRole = async (role, payload) => {
  const users = await User.find({ roles: role }).select("_id");
  const ids = users.map((user) => user._id.toString());
  await notifyUsersByIds(ids, payload);
};
