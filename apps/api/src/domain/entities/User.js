export class User {
  constructor(props) {
    this.id = props.id;
    this._id = props._id || props.id;
    this.email = props.email ?? null;
    this.password_hash = props.password_hash ?? null;
    this.full_name = props.full_name ?? null;
    this.first_name = props.first_name ?? null;
    this.last_name = props.last_name ?? null;
    this.designation = props.designation ?? null;
    this.contact_number = props.contact_number ?? null;
    this.profile_image_path = props.profile_image_path ?? null;
    this.roles = props.roles ?? [];
    this.district = props.district ?? null;
    this.cnic = props.cnic ?? null;
    this.email_verified = props.email_verified ?? false;
    this.email_verified_at = props.email_verified_at ?? null;
    this.verification_token = props.verification_token ?? null;
    this.verification_expires_at = props.verification_expires_at ?? null;
    this.magic_login_token = props.magic_login_token ?? null;
    this.magic_login_expires_at = props.magic_login_expires_at ?? null;
    this.failedLoginAttempts = props.failedLoginAttempts ?? 0;
    this.failedLoginAttemptsResetAt = props.failedLoginAttemptsResetAt ?? null;
    this.lockedUntil = props.lockedUntil ?? null;
    this.last_login = props.last_login ?? null;
    this.created_by = props.created_by ?? null;
    this.updated_by = props.updated_by ?? null;
    this.created_at = props.created_at ?? null;
    this.updated_at = props.updated_at ?? null;
  }

  static fromPersistence(doc) {
    if (!doc) return null;
    const raw = doc.toObject ? doc.toObject() : doc;
    const id = raw._id?.toString() || raw.id?.toString();
    return new User({
      id,
      _id: raw._id || id,
      email: raw.email,
      password_hash: raw.password_hash,
      full_name: raw.full_name,
      first_name: raw.first_name,
      last_name: raw.last_name,
      designation: raw.designation,
      contact_number: raw.contact_number,
      profile_image_path: raw.profile_image_path,
      roles: raw.roles,
      district: raw.district,
      cnic: raw.cnic,
      email_verified: raw.email_verified,
      email_verified_at: raw.email_verified_at,
      verification_token: raw.verification_token,
      verification_expires_at: raw.verification_expires_at,
      magic_login_token: raw.magic_login_token,
      magic_login_expires_at: raw.magic_login_expires_at,
      failedLoginAttempts: raw.failedLoginAttempts,
      failedLoginAttemptsResetAt: raw.failedLoginAttemptsResetAt,
      lockedUntil: raw.lockedUntil,
      last_login: raw.last_login,
      created_by: raw.created_by,
      updated_by: raw.updated_by,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    });
  }
}
