export type NotificationStatus = "queued" | "sent" | "failed";

export interface NotificationLogEntry {
  id: string;
  application_id: string | null;
  to_email: string;
  notification_type: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}
