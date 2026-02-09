import { ApplicationStatus } from "@/types/application-status";

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
