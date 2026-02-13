export const ensureApplicantUser = async ({
  application,
  applicationRepository,
  userRepository,
  passwordHasher,
  tokenGenerator,
}) => {
  if (!application?.applicant_email) return null;
  const normalizedEmail = String(application.applicant_email).toLowerCase().trim();
  let applicantUser = await userRepository.findByEmail(normalizedEmail);
  if (!applicantUser) {
    const randomPassword = tokenGenerator(16);
    const passwordHash = await passwordHasher.hash(randomPassword, 10);
    applicantUser = await userRepository.createUser({
      email: normalizedEmail,
      password_hash: passwordHash,
      full_name: application.applicant_name || null,
      roles: ["applicant"],
      cnic: application.applicant_cnic || null,
      email_verified: false,
    });
  } else if (!applicantUser.cnic && application.applicant_cnic) {
    applicantUser = await userRepository.updateUser(applicantUser.id, {
      cnic: application.applicant_cnic,
    });
  }

  let updatedApplication = application;
  if (!application.applicant_user_id && applicantUser) {
    updatedApplication = await applicationRepository.updateById(application.id, {
      applicant_user_id: applicantUser.id,
      updated_by: application.updated_by || applicantUser.id,
    });
  }

  return { applicantUser, application: updatedApplication };
};

export const sendApplicantMagicLink = async ({
  applicantUser,
  tokenGenerator,
  tokenHasher,
  appBaseUrl,
  emailService,
  userRepository,
}) => {
  if (!applicantUser?.email) return;
  const roles = applicantUser.roles || [];
  const isStaff = roles.some((role) => ["admin", "super_admin", "registrar", "hearing_officer"].includes(role));
  const isApplicantOnly = roles.includes("applicant") && !isStaff;
  if (!isApplicantOnly) {
    return;
  }

  const magicToken = tokenGenerator(24);
  await userRepository.updateUser(applicantUser.id, {
    magic_login_token: tokenHasher(magicToken),
    magic_login_expires_at: new Date(Date.now() + 60 * 60 * 1000),
  });

  const magicUrl = `${appBaseUrl}/magic-login?token=${magicToken}`;
  await emailService.sendMagicLoginEmail({ email: applicantUser.email, loginUrl: magicUrl });
};
