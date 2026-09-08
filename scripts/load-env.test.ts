import test from "node:test";
import assert from "node:assert/strict";
import { developmentEnvFiles, envFilesForNodeEnv } from "./load-env";

test("production workers load the production env file and never .env.local", () => {
  assert.deepEqual(envFilesForNodeEnv("production"), [
    ".env.production.local",
    ".env",
  ]);
});

test("non-production scripts keep the local env file order", () => {
  assert.deepEqual(envFilesForNodeEnv("development"), [".env.local", ".env"]);
  assert.deepEqual(envFilesForNodeEnv(undefined), [".env.local", ".env"]);
});

test("DEV partner scripts prefer development env files and never production env", () => {
  const files: readonly string[] = developmentEnvFiles();
  assert.deepEqual(files, [
    ".env.development.migrate.local",
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ]);
  assert.equal(files.includes(".env.production.local"), false);
});
