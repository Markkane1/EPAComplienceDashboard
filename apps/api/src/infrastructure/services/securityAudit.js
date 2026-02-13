/**
 * Enhanced Security Audit Logging
 * Logs all security-relevant events for monitoring and forensics
 */

import AuditLog from "../db/mongoose/models/AuditLog.js";

/**
 * Log security events with severity levels
 */
export const logSecurityEvent = async (event) => {
  const {
    type, // 'auth.login', 'auth.failed', 'access.denied', 'account.locked', etc.
    userId,
    ipAddress,
    userAgent,
    resource,
    action,
    status, // 'success', 'failure'
    details = {},
    severity = 'info', // 'info', 'warning', 'critical'
    req, // Express req object
  } = event;

  try {
    const ip = ipAddress || req?.ip || req?.connection?.remoteAddress || 'unknown';
    const ua = userAgent || req?.headers['user-agent'] || 'unknown';

    const auditEntry = {
      timestamp: new Date(),
      type,
      userId: userId || (req?.user?._id?.toString() ? req.user._id.toString() : null),
      ipAddress: ip,
      userAgent: ua,
      resource,
      action,
      status,
      severity,
      details: {
        ...details,
        method: req?.method,
        url: req?.originalUrl,
        referer: req?.headers.referer,
      },
    };

    // Only save to database to prevent audit logs from being a DOS vector
    // In high-security environments, also send to external monitoring
    await AuditLog.create(auditEntry);

    // Log critical events immediately
    if (severity === 'critical') {
      console.error('[SECURITY]', JSON.stringify(auditEntry));
    } else if (severity === 'warning') {
      console.warn('[SECURITY]', JSON.stringify(auditEntry));
    } else {
      console.log('[AUDIT]', JSON.stringify(auditEntry));
    }
  } catch (error) {
    console.error('[AUDIT_ERROR] Failed to log security event:', error.message);
  }
};

/**
 * Track failed login attempts
 */
export const logFailedLogin = async (email, ipAddress, req) => {
  await logSecurityEvent({
    type: 'auth.failed_login',
    ipAddress,
    resource: 'authentication',
    action: 'login_attempt',
    status: 'failure',
    severity: 'warning',
    details: {
      email: email || 'unknown',
      reason: 'invalid_credentials',
    },
    req,
  });
};

/**
 * Track successful login
 */
export const logSuccessfulLogin = async (userId, email, ipAddress, req) => {
  await logSecurityEvent({
    type: 'auth.successful_login',
    userId,
    ipAddress,
    resource: 'authentication',
    action: 'login',
    status: 'success',
    severity: 'info',
    details: {
      email,
    },
    req,
  });
};

/**
 * Track unauthorized access attempts
 */
export const logUnauthorizedAccess = async (userId, resource, action, ipAddress, req) => {
  await logSecurityEvent({
    type: 'access.denied',
    userId,
    ipAddress,
    resource,
    action,
    status: 'failure',
    severity: 'warning',
    details: {
      reason: 'insufficient_permissions',
    },
    req,
  });
};

/**
 * Track account lockout
 */
export const logAccountLockout = async (userId, email, ipAddress, attempts, req) => {
  await logSecurityEvent({
    type: 'account.locked',
    userId,
    ipAddress,
    resource: 'account',
    action: 'lockout',
    status: 'failure',
    severity: 'critical',
    details: {
      email,
      failedAttempts: attempts,
      reason: 'too_many_failed_login_attempts',
    },
    req,
  });
};

/**
 * Track password strength validation failure
 */
export const logPasswordValidationFailure = async (ipAddress, reason, req) => {
  await logSecurityEvent({
    type: 'validation.password_failed',
    ipAddress,
    resource: 'password',
    action: 'validation',
    status: 'failure',
    severity: 'warning',
    details: {
      reason,
    },
    req,
  });
};

/**
 * Track suspicious file access
 */
export const logSuspiciousFileAccess = async (userId, fileId, reason, ipAddress, req) => {
  await logSecurityEvent({
    type: 'security.file_access_denied',
    userId,
    ipAddress,
    resource: 'file',
    action: 'download',
    status: 'failure',
    severity: 'critical',
    details: {
      fileId,
      reason, // e.g., 'path_traversal_attempt', 'unauthorized_access'
    },
    req,
  });
};

/**
 * Track malicious input attempts
 */
export const logMaliciousInput = async (userId, type, input, ipAddress, req) => {
  await logSecurityEvent({
    type: 'security.malicious_input',
    userId,
    ipAddress,
    resource: 'input_validation',
    action: 'validation',
    status: 'failure',
    severity: 'critical',
    details: {
      inputType: type, // e.g., 'injection_attempt', 'xss_attempt'
      sanitized: true,
    },
    req,
  });
};

/**
 * Track data export/bulk operations
 */
export const logDataExport = async (userId, resource, count, format, ipAddress, req) => {
  await logSecurityEvent({
    type: 'data.exported',
    userId,
    ipAddress,
    resource,
    action: 'export',
    status: 'success',
    severity: 'info',
    details: {
      recordCount: count,
      format,
    },
    req,
  });
};

export default logSecurityEvent;
