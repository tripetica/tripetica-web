import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function envFilesForNodeEnv(nodeEnv: string | undefined) {
  if (nodeEnv === "production") {
    return [".env.production.local", ".env"] as const;
  }
  return [".env.local", ".env"] as const;
}

export function developmentEnvFiles() {
  return [
    ".env.development.migrate.local",
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ] as const;
}

function applyEnvFile(name: string) {
  const file = path.resolve(process.cwd(), name);
  if (!existsSync(file)) {
    return;
  }
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadDevelopmentEnv() {
  for (const name of developmentEnvFiles()) {
    applyEnvFile(name);
  }
}

export function loadLocalEnv() {
  for (const name of envFilesForNodeEnv(process.env.NODE_ENV)) {
    applyEnvFile(name);
  }
}
