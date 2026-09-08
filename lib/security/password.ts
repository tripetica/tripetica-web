import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const PREFIX = "scrypt";
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const N = 16384;
const R = 8;
const P = 1;
const DUMMY_HASH =
  "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${PREFIX}$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const parsed = parseHash(storedHash) ?? parseHash(DUMMY_HASH);
  if (!parsed) {
    return false;
  }
  const derived = (await scrypt(password, parsed.salt, parsed.keyLength)) as Buffer;
  if (derived.length !== parsed.hash.length) {
    timingSafeEqual(derived, derived);
    return false;
  }
  return timingSafeEqual(derived, parsed.hash);
}

function parseHash(value: string) {
  const parts = value.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) {
    return null;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "hex");
  const hash = Buffer.from(parts[5] ?? "", "hex");
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }
  if (salt.length < 8 || hash.length < 16) {
    return null;
  }
  return { N, r, p, salt, hash, keyLength: hash.length };
}
