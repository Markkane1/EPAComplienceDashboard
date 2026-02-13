import nodemailer from "nodemailer";
import { config } from "../config/config.js";

const hasSmtp = () => Boolean(config.smtpHost && config.smtpUser && config.smtpPass);

const transporter = hasSmtp()
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    })
  : null;

const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.warn("Email not sent (SMTP not configured):", subject);
    return;
  }
  await transporter.sendMail({
    from: config.smtpFrom,
    to,
    subject,
    html,
  });
};

const safeSend = async (payload) => {
  try {
    await sendEmail(payload);
  } catch (error) {
    console.error("Email send failed:", error);
  }
};

export const sendApplicationSubmittedEmail = async ({ email, trackingId, applicantName }) => {
  await safeSend({
    to: email,
    subject: "Application Submitted",
    html: `
      <p>Dear ${applicantName || "Applicant"},</p>
      <p>Your application has been submitted successfully.</p>
      <p><strong>Tracking ID:</strong> ${trackingId}</p>
      <p>You can track your application using this ID.</p>
    `,
  });
};

export const sendVerificationEmail = async ({ email, verifyUrl }) => {
  await safeSend({
    to: email,
    subject: "Verify Your Email",
    html: `
      <p>Thanks for signing up.</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}">Verify Email</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
};

export const sendMagicLoginEmail = async ({ email, loginUrl }) => {
  await safeSend({
    to: email,
    subject: "Your Login Link",
    html: `
      <p>Use the link below to access your account:</p>
      <p><a href="${loginUrl}">Login to your account</a></p>
      <p>This link will expire soon for your security.</p>
    `,
  });
};

export const sendStatusChangedEmail = async ({ email, trackingId, status }) => {
  await safeSend({
    to: email,
    subject: "Application Status Updated",
    html: `
      <p>Your application status has changed.</p>
      <p><strong>Tracking ID:</strong> ${trackingId}</p>
      <p><strong>New Status:</strong> ${status}</p>
    `,
  });
};

export const sendHearingScheduledEmail = async ({ email, trackingId, hearingDate }) => {
  await safeSend({
    to: email,
    subject: "Personal Hearing Scheduled",
    html: `
      <p>Your personal hearing has been scheduled.</p>
      <p><strong>Tracking ID:</strong> ${trackingId}</p>
      <p><strong>Hearing Date:</strong> ${hearingDate}</p>
    `,
  });
};

export const sendHearingReminderEmail = async ({ email, trackingId, hearingDate }) => {
  await safeSend({
    to: email,
    subject: "Personal Hearing Reminder",
    html: `
      <p>This is a reminder that your personal hearing is scheduled in one hour.</p>
      <p><strong>Tracking ID:</strong> ${trackingId}</p>
      <p><strong>Hearing Date:</strong> ${hearingDate}</p>
    `,
  });
};

