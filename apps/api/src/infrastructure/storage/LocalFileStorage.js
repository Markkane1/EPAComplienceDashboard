import fs from "fs";
import crypto from "crypto";
import path from "path";
import { config } from "../config/config.js";

export class LocalFileStorage {
  relativeToUploadDir(filePath) {
    return path.relative(config.uploadDir, filePath).replace(/\\/g, "/");
  }

  normalizeSubDir(subDir = "") {
    const normalized = String(subDir).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (normalized.includes("..")) {
      throw new Error("Invalid upload path");
    }
    return normalized;
  }

  async saveUploadedFile(file, subDir = "") {
    if (!file) {
      throw new Error("No file provided");
    }

    if (file.path) {
      return this.relativeToUploadDir(file.path);
    }

    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new Error("Invalid uploaded file buffer");
    }

    const safeSubDir = this.normalizeSubDir(subDir);
    const dir = safeSubDir ? path.join(config.uploadDir, safeSubDir) : config.uploadDir;
    await fs.promises.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && /^[a-z0-9.]+$/.test(ext) ? ext : "";
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`;
    const targetPath = path.join(dir, fileName);

    await fs.promises.writeFile(targetPath, file.buffer);
    return this.relativeToUploadDir(targetPath);
  }

  resolveStoredPath(storedPath) {
    return path.join(process.cwd(), storedPath);
  }

  exists(filePath) {
    return fs.existsSync(filePath);
  }
}
