import { isValidEmailShape } from "@/lib/account/email";

export function normalizeOpsEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOpsEmail(value: string) {
  return isValidEmailShape(normalizeOpsEmail(value));
}
