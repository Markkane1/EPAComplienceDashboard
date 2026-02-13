export const mapApplicationResponse = (app) => {
  const id = app.id || app._id?.toString?.() || app._id || null;
  return {
    id,
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
    created_at: app.created_at ? new Date(app.created_at).toISOString() : null,
    updated_at: app.updated_at ? new Date(app.updated_at).toISOString() : null,
    closed_at: app.closed_at ? new Date(app.closed_at).toISOString() : null,
    closed_by: app.closed_by || null,
    hearing_officer_id: app.hearing_officer_id || null,
    registrar_id: app.registrar_id || null,
  };
};
