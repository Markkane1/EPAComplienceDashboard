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
