import { connectDb, disconnectDb } from "./infrastructure/db/mongoose/db.js";
import { config } from "./infrastructure/config/config.js";
import { ensureBootstrapUser } from "./infrastructure/services/bootstrap.js";
import { startHearingReminderJob } from "./infrastructure/services/jobs/hearingReminders.js";
import { startStaffNotificationJob } from "./infrastructure/services/jobs/staffNotifications.js";
import { createServer } from "./server.js";
import { MongooseUserRepository } from "./infrastructure/db/mongoose/repositories/MongooseUserRepository.js";
import { MongooseApplicationRepository } from "./infrastructure/db/mongoose/repositories/MongooseApplicationRepository.js";
import { MongooseApplicationDocumentRepository } from "./infrastructure/db/mongoose/repositories/MongooseApplicationDocumentRepository.js";
import { MongooseApplicationRemarkRepository } from "./infrastructure/db/mongoose/repositories/MongooseApplicationRemarkRepository.js";
import { MongooseHearingRepository } from "./infrastructure/db/mongoose/repositories/MongooseHearingRepository.js";
import { JwtTokenService } from "./infrastructure/services/JwtTokenService.js";
import { BcryptPasswordHasher } from "./infrastructure/services/BcryptPasswordHasher.js";
import { generateToken, hashToken } from "./infrastructure/services/tokens.js";
import { sendMagicLoginEmail, sendVerificationEmail } from "./infrastructure/services/email.js";
import {
  sendApplicationSubmittedEmail,
  sendHearingScheduledEmail,
  sendStatusChangedEmail,
} from "./infrastructure/services/email.js";
import { createNotification, notifyUsersByRole } from "./infrastructure/services/notifications.js";
import { logAudit } from "./infrastructure/services/audit.js";
import { createAuthController } from "./presentation/http/controllers/authController.js";
import { createApplicationController } from "./presentation/http/controllers/applicationController.js";
import { createDocumentController } from "./presentation/http/controllers/documentController.js";
import { createPublicController } from "./presentation/http/controllers/publicController.js";
import { ApplicantLoginBlockedUseCase } from "./application/use-cases/auth/ApplicantLoginBlockedUseCase.js";
import { LoginUseCase } from "./application/use-cases/auth/LoginUseCase.js";
import { MagicLoginUseCase } from "./application/use-cases/auth/MagicLoginUseCase.js";
import { MagicLoginRequestUseCase } from "./application/use-cases/auth/MagicLoginRequestUseCase.js";
import { SignupBlockedUseCase } from "./application/use-cases/auth/SignupBlockedUseCase.js";
import { SignupUseCase } from "./application/use-cases/auth/SignupUseCase.js";
import { VerifyEmailUseCase } from "./application/use-cases/auth/VerifyEmailUseCase.js";
import { GetMeUseCase } from "./application/use-cases/auth/GetMeUseCase.js";
import { UpdateProfileUseCase } from "./application/use-cases/auth/UpdateProfileUseCase.js";
import { UpdateProfileImageUseCase } from "./application/use-cases/auth/UpdateProfileImageUseCase.js";
import { RemoveProfileImageUseCase } from "./application/use-cases/auth/RemoveProfileImageUseCase.js";
import { ChangePasswordUseCase } from "./application/use-cases/auth/ChangePasswordUseCase.js";
import { CreateApplicationUseCase } from "./application/use-cases/applications/CreateApplicationUseCase.js";
import { GetApplicationStatsUseCase } from "./application/use-cases/applications/GetApplicationStatsUseCase.js";
import { GetApplicationByIdUseCase } from "./application/use-cases/applications/GetApplicationByIdUseCase.js";
import { ListApplicationHearingsUseCase } from "./application/use-cases/applications/ListApplicationHearingsUseCase.js";
import { SetApplicationViolationUseCase } from "./application/use-cases/applications/SetApplicationViolationUseCase.js";
import { ListApplicationsUseCase } from "./application/use-cases/applications/ListApplicationsUseCase.js";
import { UpdateApplicationUseCase } from "./application/use-cases/applications/UpdateApplicationUseCase.js";
import { ListApplicationDocumentsUseCase } from "./application/use-cases/applications/ListApplicationDocumentsUseCase.js";
import { UploadApplicationDocumentUseCase } from "./application/use-cases/applications/UploadApplicationDocumentUseCase.js";
import { ListApplicationRemarksUseCase } from "./application/use-cases/applications/ListApplicationRemarksUseCase.js";
import { MarkApplicationIncompleteUseCase } from "./application/use-cases/applications/MarkApplicationIncompleteUseCase.js";
import { MarkApplicationCompleteUseCase } from "./application/use-cases/applications/MarkApplicationCompleteUseCase.js";
import { ScheduleHearingUseCase } from "./application/use-cases/applications/ScheduleHearingUseCase.js";
import { AdjournHearingUseCase } from "./application/use-cases/applications/AdjournHearingUseCase.js";
import { ApproveApplicationUseCase } from "./application/use-cases/applications/ApproveApplicationUseCase.js";
import { RejectApplicationUseCase } from "./application/use-cases/applications/RejectApplicationUseCase.js";
import { GetPublicApplicationUseCase } from "./application/use-cases/applications/GetPublicApplicationUseCase.js";
import { GetPublicApplicationHearingsUseCase } from "./application/use-cases/applications/GetPublicApplicationHearingsUseCase.js";
import { DownloadDocumentUseCase } from "./application/use-cases/documents/DownloadDocumentUseCase.js";
import { LocalFileStorage } from "./infrastructure/storage/LocalFileStorage.js";

let server;
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Shutting down on ${signal}...`);
  const closeServer = server
    ? new Promise((resolve) => server.close(resolve))
    : Promise.resolve();
  await Promise.allSettled([closeServer, disconnectDb()]);
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

const start = async () => {
  await connectDb();
  const bootstrapUser = await ensureBootstrapUser();
  if (bootstrapUser) {
    console.log(`Bootstrap admin created: ${bootstrapUser.email}`);
  }
  if (config.jwtSecret === "dev-secret") {
    console.warn("Warning: JWT_SECRET is using the default value. Set a secure secret in production.");
  }
  if (config.adminPassword === "Admin123!") {
    console.warn("Warning: ADMIN_PASSWORD is using the default value. Set a secure password in production.");
  }
  startHearingReminderJob();
  startStaffNotificationJob();

  const userRepository = new MongooseUserRepository();
  const applicationRepository = new MongooseApplicationRepository();
  const documentRepository = new MongooseApplicationDocumentRepository();
  const remarkRepository = new MongooseApplicationRemarkRepository();
  const hearingRepository = new MongooseHearingRepository();
  const tokenService = new JwtTokenService(config.jwtSecret);
  const passwordHasher = new BcryptPasswordHasher();
  const auditLogger = { log: logAudit };
  const emailService = {
    sendMagicLoginEmail,
    sendVerificationEmail,
    sendApplicationSubmittedEmail,
    sendHearingScheduledEmail,
    sendStatusChangedEmail,
  };
  const notificationService = {
    createNotification,
    notifyUsersByRole,
  };
  const fileStorage = new LocalFileStorage();

  const applicantLoginUseCase = new ApplicantLoginBlockedUseCase({ auditLogger });
  const loginUseCase = new LoginUseCase({
    userRepository,
    passwordHasher,
    tokenService,
    auditLogger,
    publicBaseUrl: config.publicBaseUrl,
  });
  const magicLoginUseCase = new MagicLoginUseCase({
    userRepository,
    tokenService,
    tokenHasher: hashToken,
    auditLogger,
    publicBaseUrl: config.publicBaseUrl,
  });
  const magicLoginRequestUseCase = new MagicLoginRequestUseCase({
    userRepository,
    tokenGenerator: generateToken,
    tokenHasher: hashToken,
    emailService,
    auditLogger,
    appBaseUrl: config.appBaseUrl,
  });
  const signupBlockedUseCase = new SignupBlockedUseCase({ auditLogger });
  const signupUseCase = new SignupUseCase({
    userRepository,
    passwordHasher,
    tokenGenerator: generateToken,
    tokenHasher: hashToken,
    emailService,
    auditLogger,
    appBaseUrl: config.appBaseUrl,
  });
  const verifyEmailUseCase = new VerifyEmailUseCase({
    userRepository,
    tokenHasher: hashToken,
    auditLogger,
  });
  const getMeUseCase = new GetMeUseCase({
    userRepository,
    publicBaseUrl: config.publicBaseUrl,
  });
  const updateProfileUseCase = new UpdateProfileUseCase({
    userRepository,
    auditLogger,
    publicBaseUrl: config.publicBaseUrl,
  });
  const updateProfileImageUseCase = new UpdateProfileImageUseCase({
    userRepository,
    auditLogger,
    publicBaseUrl: config.publicBaseUrl,
  });
  const removeProfileImageUseCase = new RemoveProfileImageUseCase({
    userRepository,
    auditLogger,
    publicBaseUrl: config.publicBaseUrl,
  });
  const changePasswordUseCase = new ChangePasswordUseCase({
    userRepository,
    passwordHasher,
    auditLogger,
  });

  const authController = createAuthController({
    applicantLoginUseCase,
    loginUseCase,
    magicLoginUseCase,
    magicLoginRequestUseCase,
    signupBlockedUseCase,
    signupUseCase,
    verifyEmailUseCase,
    getMeUseCase,
    updateProfileUseCase,
    updateProfileImageUseCase,
    removeProfileImageUseCase,
    changePasswordUseCase,
  });

  const createApplicationUseCase = new CreateApplicationUseCase({
    applicationRepository,
    userRepository,
    passwordHasher,
    tokenGenerator: generateToken,
    tokenHasher: hashToken,
    emailService,
    notificationService,
    auditLogger,
    appBaseUrl: config.appBaseUrl,
  });
  const getApplicationStatsUseCase = new GetApplicationStatsUseCase({ applicationRepository });
  const getApplicationByIdUseCase = new GetApplicationByIdUseCase({ applicationRepository });
  const listApplicationHearingsUseCase = new ListApplicationHearingsUseCase({
    applicationRepository,
    hearingRepository,
    documentRepository,
  });
  const setApplicationViolationUseCase = new SetApplicationViolationUseCase({
    applicationRepository,
    auditLogger,
  });
  const listApplicationsUseCase = new ListApplicationsUseCase({ applicationRepository });
  const updateApplicationUseCase = new UpdateApplicationUseCase({
    applicationRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
  });
  const listApplicationDocumentsUseCase = new ListApplicationDocumentsUseCase({
    applicationRepository,
    documentRepository,
  });
  const uploadApplicationDocumentUseCase = new UploadApplicationDocumentUseCase({
    applicationRepository,
    documentRepository,
    auditLogger,
    fileStorage,
  });
  const listApplicationRemarksUseCase = new ListApplicationRemarksUseCase({
    applicationRepository,
    remarkRepository,
  });
  const markApplicationIncompleteUseCase = new MarkApplicationIncompleteUseCase({
    applicationRepository,
    remarkRepository,
    userRepository,
    passwordHasher,
    tokenGenerator: generateToken,
    tokenHasher: hashToken,
    emailService,
    notificationService,
    auditLogger,
    appBaseUrl: config.appBaseUrl,
  });
  const markApplicationCompleteUseCase = new MarkApplicationCompleteUseCase({
    applicationRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
  });
  const scheduleHearingUseCase = new ScheduleHearingUseCase({
    applicationRepository,
    hearingRepository,
    userRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
  });
  const adjournHearingUseCase = new AdjournHearingUseCase({
    applicationRepository,
    hearingRepository,
    documentRepository,
    remarkRepository,
    emailService,
    notificationService,
    auditLogger,
    fileStorage,
  });
  const approveApplicationUseCase = new ApproveApplicationUseCase({
    applicationRepository,
    hearingRepository,
    documentRepository,
    remarkRepository,
    userRepository,
    passwordHasher,
    tokenGenerator: generateToken,
    tokenHasher: hashToken,
    emailService,
    auditLogger,
    fileStorage,
    appBaseUrl: config.appBaseUrl,
  });
  const rejectApplicationUseCase = new RejectApplicationUseCase({
    applicationRepository,
    hearingRepository,
    documentRepository,
    remarkRepository,
    userRepository,
    passwordHasher,
    tokenGenerator: generateToken,
    tokenHasher: hashToken,
    emailService,
    auditLogger,
    fileStorage,
    appBaseUrl: config.appBaseUrl,
  });
  const getPublicApplicationUseCase = new GetPublicApplicationUseCase({ applicationRepository });
  const getPublicApplicationHearingsUseCase = new GetPublicApplicationHearingsUseCase({
    applicationRepository,
    hearingRepository,
  });
  const downloadDocumentUseCase = new DownloadDocumentUseCase({
    documentRepository,
    applicationRepository,
    fileStorage,
  });

  const applicationController = createApplicationController({
    createApplicationUseCase,
    getApplicationStatsUseCase,
    getApplicationByIdUseCase,
    listApplicationHearingsUseCase,
    setApplicationViolationUseCase,
    listApplicationsUseCase,
    updateApplicationUseCase,
    listApplicationDocumentsUseCase,
    uploadApplicationDocumentUseCase,
    listApplicationRemarksUseCase,
    markApplicationIncompleteUseCase,
    markApplicationCompleteUseCase,
    scheduleHearingUseCase,
    adjournHearingUseCase,
    approveApplicationUseCase,
    rejectApplicationUseCase,
  });
  const documentController = createDocumentController({ downloadDocumentUseCase });
  const publicController = createPublicController({
    getPublicApplicationUseCase,
    getPublicApplicationHearingsUseCase,
  });

  const app = createServer({ authController, applicationController, documentController, publicController });

  server = app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}`);
  });
};

start();
