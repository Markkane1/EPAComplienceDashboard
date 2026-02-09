import { ApplicationStatus } from "@/types/application-status";

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
