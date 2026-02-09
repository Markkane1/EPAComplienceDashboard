import { Router } from "express";
import Notification from "../models/Notification.js";
import { authRequired } from "../middleware/auth.js";
import { mapNotification } from "../utils/mappers.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const { status, limit } = req.query;
  const userId = req.user?._id?.toString();
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const query = { recipient_user_id: userId };
  if (status === "unread") {
    query.is_read = false;
  }

  const pageLimit = Number(limit) > 0 ? Number(limit) : 20;
  const items = await Notification.find(query).sort({ created_at: -1 }).limit(pageLimit);
  const unreadCount = await Notification.countDocuments({ recipient_user_id: userId, is_read: false });

  return res.json({
    items: items.map(mapNotification),
    unread_count: unreadCount,
  });
});

router.post("/:id/read", authRequired, async (req, res) => {
  const userId = req.user?._id?.toString();
  const notification = await Notification.findOne({ _id: req.params.id, recipient_user_id: userId });
  if (!notification) {
    return res.status(404).json({ message: "Notification not found." });
  }

  if (!notification.is_read) {
    notification.is_read = true;
    notification.read_at = new Date();
    await notification.save();
  }

  return res.json(mapNotification(notification));
});

router.post("/read-all", authRequired, async (req, res) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await Notification.updateMany(
    { recipient_user_id: userId, is_read: false },
    { $set: { is_read: true, read_at: new Date() } }
  );

  return res.status(204).end();
});

export default router;
