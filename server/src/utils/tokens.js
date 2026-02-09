import crypto from "crypto";

export const generateToken = (size = 32) => crypto.randomBytes(size).toString("hex");
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
