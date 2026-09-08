import { stdin as input, stdout as output } from "node:process";
import { assertExpectedDatabase } from "../lib/db/database-target";
import { PARTNER_MIN_PASSWORD_LENGTH } from "../lib/partner/constants";
import { isPartnerPasswordLengthValid } from "../lib/partner/policy";

export function assertDevPartnerScript() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("This partner script is DEV-only.");
  }
  const expected = process.env.EXPECTED_DATABASE?.trim();
  if (expected !== "tripetica_dev") {
    throw new Error("This partner script requires EXPECTED_DATABASE=tripetica_dev.");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  assertExpectedDatabase(databaseUrl, expected);
}

export async function readHiddenPassword(prompt: string) {
  output.write(prompt);
  input.setRawMode?.(true);
  input.resume();
  input.setEncoding("utf8");
  let value = "";
  return new Promise<string>((resolve, reject) => {
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\n" || char === "\r") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " ") {
          value += char;
        }
      }
    };
    function cleanup() {
      input.off("data", onData);
      input.setRawMode?.(false);
      input.pause();
    };
    input.on("data", onData);
  });
}

function requirePartnerPasswordLength(password: string) {
  if (!isPartnerPasswordLengthValid(password)) {
    throw new Error(
      `Şifre en az ${PARTNER_MIN_PASSWORD_LENGTH} karakter olmalı.`,
    );
  }
  return password;
}

export async function resolveBootstrapPassword() {
  const fromEnv = process.env.PARTNER_BOOTSTRAP_PASSWORD ?? "";
  if (fromEnv) {
    return requirePartnerPasswordLength(fromEnv);
  }
  const password = await readHiddenPassword("Geçici şifre: ");
  const repeat = await readHiddenPassword("Geçici şifre tekrar: ");
  if (password !== repeat) {
    throw new Error("Şifreler eşleşmiyor.");
  }
  return requirePartnerPasswordLength(password);
}
