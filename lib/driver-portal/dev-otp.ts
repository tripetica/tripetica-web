import { writeFileSync } from "node:fs";

const DEV_OTP_PATH = "/tmp/tripetica-dev-driver-otp";

export function isDriverPortalDevOtpAllowed(
  expectedDatabase = process.env.EXPECTED_DATABASE,
  nodeEnv = process.env.NODE_ENV,
) {
  return expectedDatabase === "tripetica_dev" && nodeEnv !== "production";
}

export function writeDriverPortalDevOtp(email: string, code: string) {
  if (!isDriverPortalDevOtpAllowed()) {
    return;
  }
  writeFileSync(DEV_OTP_PATH, `${email}\n${code}\n`, { mode: 0o600 });
}
