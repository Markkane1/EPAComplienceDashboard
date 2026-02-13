export const mapUserResponse = (user, publicBaseUrl = "") => {
  const baseUrl = publicBaseUrl ? publicBaseUrl.replace(/\/$/, "") : "";
  const profilePath = user.profile_image_path || null;
  const profileUrl = profilePath
    ? baseUrl
      ? `${baseUrl}/${profilePath.replace(/^\/+/, "")}`
      : `/${profilePath.replace(/^\/+/, "")}`
    : null;
  const id = user.id || user._id?.toString?.() || user._id || null;
  return {
    id,
    profile_id: id,
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
    email_verified_at: user.email_verified_at ? new Date(user.email_verified_at).toISOString() : null,
    created_by: user.created_by || null,
    updated_by: user.updated_by || null,
    created_at: user.created_at ? new Date(user.created_at).toISOString() : null,
  };
};
