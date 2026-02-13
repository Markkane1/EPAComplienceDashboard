/**
 * Input Validation Schemas
 * Centralized validation rules for all API inputs
 */

export const schemas = {
  // Authentication schemas
  login: {
    email: (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Email is required and must be a string');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
      }
      return value.toLowerCase().trim();
    },
    password: (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Password is required and must be a string');
      }
      if (value.length < 1) {
        throw new Error('Password cannot be empty');
      }
      return value;
    },
  },

  // User creation/update schemas
  user: {
    email: (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value !== 'string') {
        throw new Error('Email must be a string');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        throw new Error('Invalid email format');
      }
      return value.toLowerCase().trim() || null;
    },
    password: (value) => {
      if (!value) {
        throw new Error('Password is required');
      }
      return validatePasswordStrength(value);
    },
    cnic: (value) => {
      if (!value) {
        throw new Error('CNIC is required');
      }
      const normalizedCnic = String(value).trim();
      if (!/^\d{5}-\d{7}-\d{1}$/.test(normalizedCnic) && !/^\d{13}$/.test(normalizedCnic)) {
        throw new Error('CNIC must be in format: XXXXX-XXXXXXX-X or 13 digits');
      }
      return normalizedCnic;
    },
    full_name: (value) => {
      if (value === undefined || value === null) return null;
      const str = String(value).trim();
      if (str === '') return null;
      if (str.length > 255) {
        throw new Error('Full name must be at most 255 characters');
      }
      // Remove potentially dangerous characters
      return str.replace(/[<>\"']/g, '');
    },
    role: (value) => {
      const validRoles = ['admin', 'super_admin', 'registrar', 'hearing_officer', 'applicant'];
      if (!validRoles.includes(value)) {
        throw new Error(`Role must be one of: ${validRoles.join(', ')}`);
      }
      return value;
    },
    district: (value) => {
      if (value === undefined || value === null) return null;
      const str = String(value).trim();
      if (str === '') return null;
      if (str.length > 100) {
        throw new Error('District must be at most 100 characters');
      }
      return str;
    },
  },

  // File upload schema
  file: {
    mimetype: (value, allowedTypes = ['application/pdf']) => {
      if (!allowedTypes.includes(value)) {
        throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      }
      return value;
    },
    size: (value, maxSize = 10 * 1024 * 1024) => {
      if (value > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
      }
      return value;
    },
  },

  // Application schema
  application: {
    tracking_id: (value) => {
      if (!value) {
        throw new Error('Tracking ID is required');
      }
      const str = String(value).trim();
      if (!/^[a-zA-Z0-9\-_]{10,}$/.test(str)) {
        throw new Error('Invalid tracking ID format');
      }
      return str;
    },
    status: (value) => {
      const validStatuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'hearing_scheduled', 'hearing_completed'];
      if (!validStatuses.includes(value)) {
        throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
      }
      return value;
    },
  },
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }

  if (password.length < 12) {
    errors.push('Minimum 12 characters required');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Must contain at least one special character (!@#$%^&*)');
  }

  // Check common patterns
  const commonPatterns = ['12345', 'qwerty', 'password', 'admin', 'test', '111111', 'aaaaaa'];
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    errors.push('Password contains common patterns. Please choose a more unique password');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return password;
};

/**
 * Validate object against schema
 */
export const validateObject = (obj, schema) => {
  const validated = {};
  const errors = [];

  for (const [key, validator] of Object.entries(schema)) {
    try {
      if (typeof validator === 'function') {
        validated[key] = validator(obj[key]);
      } else if (typeof validator === 'object') {
        // Nested validator
        validated[key] = validateObject(obj[key] || {}, validator);
      }
    } catch (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.status = 400;
    throw error;
  }

  return validated;
};

/**
 * Sanitize filename for safe file storage
 */
export const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }
  // Remove path separators and dangerous characters
  return filename
    .replace(/[\/\\]/g, '_')
    .replace(/[^\w._\-]/g, '_')
    .substring(0, 255);
};
