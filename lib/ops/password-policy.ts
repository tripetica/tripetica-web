import { OPS_MIN_PASSWORD_LENGTH } from "@/lib/ops/constants";

export function isOpsPasswordLengthValid(password: string) {
  return password.length >= OPS_MIN_PASSWORD_LENGTH;
}
