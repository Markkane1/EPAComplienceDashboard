export type NotificationItem = {
  id: string;
  application_id: string | null;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unread_count: number;
};
