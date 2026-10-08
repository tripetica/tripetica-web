import { createHash, randomBytes } from "node:crypto";
import { GPS_DEVICE_CODE_PATTERN, GPS_TOKEN_PATTERN } from "@/lib/gps/contract";

export function generateDeviceCode() {
  const code = `TPT-${randomBytes(6).toString("hex").toUpperCase()}`;
  if (!GPS_DEVICE_CODE_PATTERN.test(code)) {
    throw new Error("device code generator failed");
  }
  return code;
}

export function generateDeviceToken() {
  return `tdev_${randomBytes(32).toString("base64url")}`;
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(header: string | null) {
  const match = /^Bearer\s+(\S+)$/.exec(header ?? "");
  const token = match?.[1] ?? "";
  return GPS_TOKEN_PATTERN.test(token) ? token : null;
}
