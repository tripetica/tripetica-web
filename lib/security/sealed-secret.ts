import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

export class SealedSecretError extends Error {
  constructor(message = "sealed_secret_unavailable") {
    super(message);
    this.name = "SealedSecretError";
  }
}

function keyFromEnv(envName: string) {
  const raw = process.env[envName]?.trim();
  if (!raw) {
    throw new SealedSecretError();
  }
  const key =
    raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new SealedSecretError();
  }
  return key;
}

export function sealSecret(plaintext: string, envName = "UETDS_CREDENTIALS_KEY") {
  const key = keyFromEnv(envName);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function unsealSecret(sealed: string, envName = "UETDS_CREDENTIALS_KEY") {
  const key = keyFromEnv(envName);
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new SealedSecretError();
  }
  const iv = Buffer.from(parts[1] ?? "", "base64url");
  const tag = Buffer.from(parts[2] ?? "", "base64url");
  const encrypted = Buffer.from(parts[3] ?? "", "base64url");
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH || encrypted.length === 0) {
    throw new SealedSecretError();
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new SealedSecretError();
  }
}

export function isSealedSecret(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  const parts = value.split(".");
  return parts.length === 4 && parts[0] === PREFIX;
}
