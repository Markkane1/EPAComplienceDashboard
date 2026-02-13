import fs from "fs";
import path from "path";
import { config } from "../config/config.js";

export class LocalFileStorage {
  relativeToUploadDir(filePath) {
    return path.relative(config.uploadDir, filePath).replace(/\\/g, "/");
  }

  resolveStoredPath(storedPath) {
    return path.join(process.cwd(), storedPath);
  }

  exists(filePath) {
    return fs.existsSync(filePath);
  }
}
