import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function askHidden(prompt: string) {
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
    }
    input.on("data", onData);
  });
}

async function main() {
  const rl = createInterface({ input, output });
  try {
    const firstName = (await rl.question("Ad: ")).trim();
    const lastName = (await rl.question("Soyad: ")).trim();
    const email = (await rl.question("E-posta: ")).trim();
    if (!firstName || !lastName) {
      throw new Error("Ad ve soyad gerekli.");
    }
    if (!isEmail(email)) {
      throw new Error("Geçerli bir e-posta girin.");
    }
    rl.pause();
    const password = await askHidden("Şifre: ");
    const repeat = await askHidden("Şifre tekrar: ");
    const { OPS_MIN_PASSWORD_LENGTH } = await import("../lib/ops/constants");
    const { isOpsPasswordLengthValid } = await import("../lib/ops/password-policy");
    if (!isOpsPasswordLengthValid(password)) {
      throw new Error(`Şifre en az ${OPS_MIN_PASSWORD_LENGTH} karakter olmalı.`);
    }
    if (password !== repeat) {
      throw new Error("Şifreler eşleşmiyor.");
    }
    const { createOwnerAccount } = await import("../lib/ops/users");
    const id = await createOwnerAccount({ firstName, lastName, email, password });
    console.log(`Owner oluşturuldu: ${email} (${id})`);
  } finally {
    rl.close();
    input.setRawMode?.(false);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
