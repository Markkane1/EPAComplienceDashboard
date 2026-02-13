import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { config } from "../config/config.js";

// Use memory storage and validate before saving to disk
const storage = multer.memoryStorage();

export const applicationUpload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    // Strict whitelist of MIME types
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only PDF and image files (JPEG, PNG) are allowed'));
    }

    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    
    if (!allowedExts.includes(ext)) {
      return cb(new Error('File extension not allowed'));
    }

    cb(null, true);
  },
});

/**
 * Save uploaded file securely with validation
 * Returns the relative path for storage in database
 */
export const saveUploadedFile = async (file, applicationId) => {
  if (!file) {
    throw new Error('No file provided');
  }

  // Validate MIME type
  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedMimes.includes(file.mimetype)) {
    throw new Error('Invalid file type');
  }

  // Generate secure filename
  const fileId = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${fileId}${ext}`;

  // Create directory structure
  const dir = path.join(config.secureUploadsDir, applicationId);
  fs.mkdirSync(dir, { recursive: true });

  // Save file
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, file.buffer);

  // Set secure permissions (owner read/write only)
  fs.chmodSync(filePath, 0o600);

  // Return relative path for database storage
  const relativePath = path.relative(
    config.secureUploadsDir,
    filePath
  ).replace(/\\/g, '/');

  return {
    filename,
    path: relativePath,
    size: file.size,
    mimetype: file.mimetype,
    originalName: file.originalname,
  };
};

/**
 * Get full path for file retrieval with validation
 */
export const getSecureFilePath = (storedPath) => {
  if (!storedPath) {
    throw new Error('Invalid file path');
  }

  // Normalize and validate path
  const normalizedPath = path.normalize(storedPath);
  const fullPath = path.join(config.secureUploadsDir, normalizedPath);
  const realPath = path.resolve(fullPath);
  const uploadDirPath = path.resolve(config.secureUploadsDir);

  // Prevent path traversal
  if (!realPath.startsWith(uploadDirPath)) {
    throw new Error('Invalid file path');
  }

  // Verify file exists
  if (!fs.existsSync(realPath)) {
    throw new Error('File not found');
  }

  return realPath;
};

