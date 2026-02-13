/**
 * Improved Rate Limiting Middleware
 * Tracks requests per IP and per key (e.g., email)
 * Implements exponential backoff for repeated violations
 */

const store = new Map();

const now = () => Date.now();

/**
 * Clean up old entries periodically to prevent memory leaks
 */
const cleanup = () => {
  const currentTime = now();
  let cleaned = 0;
  
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < currentTime) {
      store.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned up ${cleaned} expired entries`);
  }
};

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

export const rateLimit = ({ 
  windowMs = 60000, 
  max = 10, 
  keyGenerator,
  message = "Too many requests. Please try again later."
}) => {
  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const entry = store.get(key);
    const currentTime = now();

    // Reset expired entry
    if (!entry || entry.resetAt <= currentTime) {
      store.set(key, { 
        count: 1, 
        resetAt: currentTime + windowMs,
        firstAttempt: currentTime,
        violations: 0
      });
      return next();
    }

    // Check if rate limit exceeded
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - currentTime) / 1000);
      
      // Increment violations for exponential backoff
      entry.violations = (entry.violations || 0) + 1;
      
      // Apply exponential backoff: multiply window by 2^violations
      const backoffMultiplier = Math.pow(2, Math.min(entry.violations, 5)); // Cap at 32x
      const newResetTime = currentTime + (windowMs * backoffMultiplier);
      entry.resetAt = Math.max(entry.resetAt, newResetTime);
      
      store.set(key, entry);

      // Log security event
      console.warn(`[RateLimit] ${key} exceeded limit (violations: ${entry.violations})`);

      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
      
      return res.status(429).json({ 
        message,
        retryAfter
      });
    }

    // Increment request count
    entry.count += 1;
    store.set(key, entry);

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    return next();
  };
};

/**
 * Strict rate limiting for authentication endpoints
 * - 3 attempts per 15 minutes per user identifier
 * - Much stricter than general rate limiting
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 attempts
  keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || req.body?.cnic || 'unknown'}`,
  message: 'Too many login attempts. Account temporarily locked. Please try again later.'
});

/**
 * Registration rate limiting
 * - Prevent spam registrations
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  keyGenerator: (req) => `registration:${req.ip}`,
  message: 'Too many registration attempts. Please try again later.'
});

/**
 * Password change rate limiting
 * - Prevent password change abuse
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => `password-change:${req.user?.id || req.ip}`,
  message: 'Too many password change attempts. Please try again later.'
});

/**
 * API rate limiting
 * - General rate limit for all API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => `api:${req.ip}`,
});

/**
 * File upload rate limiting
 * - Prevent upload spam
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
  message: 'Too many uploads. Please try again later.'
});

