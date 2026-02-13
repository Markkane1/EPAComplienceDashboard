export type ApplicationStatus =
  | "submitted"
  | "complete"
  | "incomplete"
  | "hearing_scheduled"
  | "under_hearing"
  | "approved_resolved"
  | "rejected_closed";

export type AppRole = "admin" | "registrar" | "hearing_officer" | "super_admin" | "applicant";

export type Application = {
  id: string;
  tracking_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  application_type: string;
  description?: unknown | null;
  status: ApplicationStatus;
  assigned_registrar_id?: string | null;
  assigned_hearing_officer_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  closed_by?: string | null;
  hearing_officer_id?: string | null;
  registrar_id?: string | null;
};

export type ApplicationDocument = {
  id: string;
  application_id: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  created_by?: string | null;
  updated_by?: string | null;
  uploaded_at: string;
  file_url?: string | null;
};

export type HearingDate = {
  id: string;
  application_id: string;
  hearing_date: string;
  hearing_type: string;
  is_active: boolean;
  sequence_no: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  applications?: {
    tracking_id: string;
    applicant_name: string;
    application_type: string;
    status: ApplicationStatus;
  } | null;
};

export type ManagedUser = {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  cnic?: string | null;
  role: string | null;
  roles?: string[];
  district?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: unknown;
  created_at: string | null;
};

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

export interface TrackedApplication {
  tracking_id: string;
  application_type: string;
  status: ApplicationStatus;
  applicant_name: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface HearingInfo {
  id: string;
  hearing_date: string;
  hearing_type: string;
}
