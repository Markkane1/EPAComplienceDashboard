import { config } from "../../../config/config.js";

export function mapUser(user) {
  const baseUrl = config.publicBaseUrl ? config.publicBaseUrl.replace(/\/$/, "") : "";
  const profilePath = user.profile_image_path || null;
  const profileUrl = profilePath
    ? baseUrl
      ? `${baseUrl}/${profilePath.replace(/^\/+/, "")}`
      : `/${profilePath.replace(/^\/+/, "")}`
    : null;
  return {
    id: user._id.toString(),
    profile_id: user._id.toString(),
    email: user.email || null,
    full_name: user.full_name || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    designation: user.designation || null,
    contact_number: user.contact_number || null,
    profile_image_path: profilePath,
    profile_image_url: profileUrl,
    roles: user.roles || [],
    role: user.roles?.[0] || null,
    district: user.district || null,
    cnic: user.cnic || null,
    email_verified: Boolean(user.email_verified),
    email_verified_at: user.email_verified_at?.toISOString() || null,
    created_by: user.created_by || null,
    updated_by: user.updated_by || null,
    created_at: user.created_at?.toISOString() || null,
  };
}

export function mapApplication(app) {
  return {
    id: app._id.toString(),
    tracking_id: app.tracking_id,
    applicant_name: app.applicant_name,
    applicant_email: app.applicant_email,
    applicant_phone: app.applicant_phone || null,
    applicant_cnic: app.applicant_cnic || null,
    applicant_user_id: app.applicant_user_id || null,
    company_name: app.company_name || null,
    company_address: app.company_address || null,
    application_type: app.application_type,
    description: app.description ?? null,
    status: app.status,
    assigned_registrar_id: app.assigned_registrar_id || null,
    assigned_hearing_officer_id: app.assigned_hearing_officer_id || null,
    created_by: app.created_by || null,
    updated_by: app.updated_by || null,
    created_at: app.created_at?.toISOString() || null,
    updated_at: app.updated_at?.toISOString() || null,
    closed_at: app.closed_at?.toISOString() || null,
    closed_by: app.closed_by || null,
    hearing_officer_id: app.hearing_officer_id || null,
    registrar_id: app.registrar_id || null,
  };
}

export function mapDocument(doc, baseUrl = "") {
  const id = doc._id.toString();
  const filePath = doc.file_path;
  const urlBase = baseUrl.replace(/\/$/, "");
  const fileUrl = urlBase ? `${urlBase}/${filePath.replace(/^\/+/, "")}` : `/${filePath.replace(/^\/+/, "")}`;
  return {
    id,
    application_id: doc.application_id.toString(),
    file_name: doc.file_name,
    file_path: doc.file_path,
    file_type: doc.file_type || null,
    file_size: doc.file_size || null,
    created_by: doc.created_by || null,
    updated_by: doc.updated_by || null,
    uploaded_at: doc.uploaded_at?.toISOString() || null,
    file_url: fileUrl,
  };
}

export function mapHearing(hearing, app = null) {
  return {
    id: hearing._id.toString(),
    application_id: hearing.application_id.toString(),
    hearing_date: hearing.hearing_date?.toISOString() || null,
    hearing_type: hearing.hearing_type,
    is_active: hearing.is_active,
    sequence_no: hearing.sequence_no,
    created_by: hearing.created_by || null,
    updated_by: hearing.updated_by || null,
    created_at: hearing.created_at?.toISOString() || null,
    applications: app
      ? {
          tracking_id: app.tracking_id,
          applicant_name: app.applicant_name,
          application_type: app.application_type,
          status: app.status,
        }
      : null,
  };
}

export function mapNotification(notification) {
  return {
    id: notification._id.toString(),
    recipient_user_id: notification.recipient_user_id,
    application_id: notification.application_id || null,
    title: notification.title,
    message: notification.message || "",
    type: notification.type || "general",
    link: notification.link || null,
    is_read: Boolean(notification.is_read),
    read_at: notification.read_at?.toISOString() || null,
    created_at: notification.created_at?.toISOString() || null,
  };
}
