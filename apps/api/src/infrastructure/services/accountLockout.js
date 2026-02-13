/**
 * Account Lockout Service
 * Implements account lockout after failed login attempts
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const ATTEMPT_WINDOW = 60 * 60 * 1000; // 1 hour

/**
 * Check if account is locked
 */
export const isAccountLocked = (user) => {
  if (!user.lockedUntil) return false;
  
  const now = new Date();
  if (user.lockedUntil > now) {
    return true;
  }
  
  // Unlock if lockout period has expired
  return false;
};

/**
 * Get lockout remaining time in minutes
 */
export const getLockoutRemainingMinutes = (user) => {
  if (!user.lockedUntil) return 0;
  
  const now = new Date();
  const remaining = user.lockedUntil - now;
  
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / 60000);
};

/**
 * Record failed login attempt
 */
export const recordFailedAttempt = (user) => {
  const now = new Date();
  
  // Reset counter if outside attempt window
  if (!user.failedLoginAttemptsResetAt || user.failedLoginAttemptsResetAt < now) {
    user.failedLoginAttempts = 1;
    user.failedLoginAttemptsResetAt = new Date(now.getTime() + ATTEMPT_WINDOW);
  } else {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  }
  
  // Lock account if max attempts exceeded
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION);
  }
  
  return {
    attempts: user.failedLoginAttempts,
    maxAttempts: MAX_FAILED_ATTEMPTS,
    isLocked: isAccountLocked(user),
    remainingMinutes: getLockoutRemainingMinutes(user),
  };
};

/**
 * Clear failed login attempts on successful login
 */
export const clearFailedAttempts = (user) => {
  user.failedLoginAttempts = 0;
  user.failedLoginAttemptsResetAt = null;
  user.lockedUntil = null;
};

/**
 * Get account security status
 */
export const getAccountSecurityStatus = (user) => {
  return {
    isLocked: isAccountLocked(user),
    lockedUntil: user.lockedUntil,
    failedAttempts: user.failedLoginAttempts || 0,
    maxAttempts: MAX_FAILED_ATTEMPTS,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - (user.failedLoginAttempts || 0)),
    remainingLockoutMinutes: getLockoutRemainingMinutes(user),
  };
};
