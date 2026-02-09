import crypto from "crypto";

export function generateTrackingId() {
  return `EPD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}