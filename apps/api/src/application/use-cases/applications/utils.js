export const CLOSED_STATUSES = ["approved_resolved", "rejected_closed"];
export const HEARING_DIVISION_STATUSES = ["complete", "hearing_scheduled", "under_hearing"];

export const isHearingOnlyUser = (roles = []) =>
  roles.includes("hearing_officer") &&
  !roles.includes("admin") &&
  !roles.includes("super_admin") &&
  !roles.includes("registrar");

export const isApplicantOnlyUser = (roles = []) =>
  roles.includes("applicant") &&
  !roles.includes("admin") &&
  !roles.includes("super_admin") &&
  !roles.includes("registrar") &&
  !roles.includes("hearing_officer");

export const applicantMatchesApplication = (user, app) => {
  const matchesEmail = user?.email && app.applicant_email === String(user.email).toLowerCase().trim();
  const userCnic = user?.cnic ? String(user.cnic).trim() : null;
  const matchesCnic = userCnic && app.applicant_cnic === userCnic;
  const matchesDescriptionCnic = userCnic && app.description?.cnic === userCnic;
  const matchesUserId = app.applicant_user_id === user?._id?.toString?.() || app.applicant_user_id === user?.id;
  return Boolean(matchesUserId || matchesEmail || matchesCnic || matchesDescriptionCnic);
};

export const applyViolationType = (app, violationType, subViolation) => {
  if (!violationType && !subViolation) return app.description || null;
  const description = app.description && typeof app.description === "object" ? app.description : {};
  return {
    ...description,
    ...(violationType ? { violation_type: violationType } : {}),
    ...(subViolation ? { sub_violation: subViolation } : {}),
  };
};
