import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { assertExpectedDatabase } from "../lib/db/database-target";
import {
  inspectBaselineSchemaCompat,
  summarizeSchemaCompatIssues,
} from "../lib/db/baseline-schema-compat";
import { parseBaselineExcept, parseBaselineThrough } from "./db-migrate-cli";

type AppliedMigration = {
  version: number;
  filename: string;
  checksum: string;
};

function loadDevelopmentEnvironment() {
  if (process.env.EXPECTED_DATABASE?.trim() === "tripetica") {
    return;
  }
  for (const name of [
    ".env.development.migrate.local",
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ]) {
    const file = path.resolve(process.cwd(), name);
    if (!existsSync(file)) {
      continue;
    }
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separator = line.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      if (process.env[key] !== undefined) {
        continue;
      }
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function migrationFiles() {
  const directory = path.resolve(process.cwd(), "db/migrations");
  return readdirSync(directory)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(name))
    .sort()
    .map((filename) => {
      const sql = readFileSync(path.join(directory, filename), "utf8");
      return {
        version: Number(filename.slice(0, 3)),
        filename,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    });
}

async function ensureTrackingTable(
  client: Client,
  options: { allowExistingSchema?: boolean } = {},
) {
  const tracker = await client.query<{ tracker: string | null }>(
    "SELECT to_regclass('public.schema_migrations')::text AS tracker",
  );
  if (tracker.rows[0]?.tracker) {
    return;
  }
  const existing = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'`,
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0 && !options.allowExistingSchema) {
    throw new Error(
      "Database has schema but no migration tracking; explicit baseline is required",
    );
  }
  await client.query(
    `CREATE TABLE schema_migrations (
       version INTEGER PRIMARY KEY,
       filename TEXT NOT NULL UNIQUE,
       checksum TEXT NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       execution_ms INTEGER NOT NULL
     )`,
  );
  await client.query("REVOKE ALL ON TABLE schema_migrations FROM PUBLIC");
}

async function main() {
  loadDevelopmentEnvironment();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const expectedDatabase = process.env.EXPECTED_DATABASE?.trim();
  if (!databaseUrl || !expectedDatabase) {
    throw new Error("DATABASE_URL and EXPECTED_DATABASE are required");
  }
  const configuredDatabase = assertExpectedDatabase(
    databaseUrl,
    expectedDatabase,
  );
  const statusOnly = process.argv.includes("--status");
  const verifyBaselineSchema = process.argv.includes("--verify-baseline-schema");
  const baselineThrough = parseBaselineThrough(process.argv);
  const baselineExcept = parseBaselineExcept(process.argv);
  const writesSchema =
    !statusOnly && !verifyBaselineSchema;
  if (
    configuredDatabase === "tripetica" &&
    writesSchema &&
    process.env.ALLOW_PRODUCTION_MIGRATIONS !== "yes"
  ) {
    throw new Error("Production migrations require an explicit approval flag");
  }
  if (baselineThrough && statusOnly) {
    throw new Error("--baseline-through cannot be combined with --status");
  }
  if (statusOnly && verifyBaselineSchema) {
    throw new Error("--status cannot be combined with --verify-baseline-schema");
  }
  const client = new Client({
    connectionString: databaseUrl,
    application_name: statusOnly
      ? "tripetica_migration_status"
      : verifyBaselineSchema
        ? "tripetica_migration_verify"
        : "tripetica_migrator",
  });
  await client.connect();
  let lockHeld = false;
  try {
    const identity = await client.query<{
      database: string;
      user_name: string;
      host: string | null;
      port: number | null;
    }>(
      `SELECT current_database() AS database,
              current_user AS user_name,
              inet_server_addr()::text AS host,
              inet_server_port() AS port`,
    );
    const current = identity.rows[0];
    if (!current || current.database !== expectedDatabase) {
      throw new Error("Connected database does not match EXPECTED_DATABASE");
    }
    console.log(
      `Target database=${current.database} user=${current.user_name} host=${current.host ?? "local"} port=${current.port ?? 5432}`,
    );

    if (verifyBaselineSchema) {
      const issues = await inspectBaselineSchemaCompat(client, {
        ignoreMissingTables: baselineExcept.includes(9)
          ? ["reservation_code_minute_seq"]
          : [],
      });
      const summary = summarizeSchemaCompatIssues(issues);
      if (summary) {
        throw new Error(`Baseline schema is not compatible: ${summary}`);
      }
      console.log("Baseline schema compatibility: ok");
      return;
    }

    if (statusOnly) {
      const tracker = await client.query<{ tracker: string | null }>(
        "SELECT to_regclass('public.schema_migrations')::text AS tracker",
      );
      if (!tracker.rows[0]?.tracker) {
        console.log("Migration tracking: not initialized");
        return;
      }
    } else {
      await client.query(
        "SELECT pg_advisory_lock(hashtextextended($1, 0))",
        [`tripetica:migrations:${expectedDatabase}`],
      );
      lockHeld = true;
      if (baselineThrough != null) {
        const issues = await inspectBaselineSchemaCompat(client, {
          ignoreMissingTables: baselineExcept.includes(9)
            ? ["reservation_code_minute_seq"]
            : [],
        });
        const summary = summarizeSchemaCompatIssues(issues);
        if (summary) {
          throw new Error(`Baseline schema is not compatible: ${summary}`);
        }
      }
      await client.query("BEGIN");
      try {
        await ensureTrackingTable(client, {
          allowExistingSchema: baselineThrough != null,
        });

        const appliedResult = await client.query<AppliedMigration>(
          "SELECT version, filename, checksum FROM schema_migrations ORDER BY version",
        );
        const applied = new Map(
          appliedResult.rows.map((row) => [row.version, row]),
        );
        const files = migrationFiles();
        for (const migration of files) {
          const previous = applied.get(migration.version);
          if (previous) {
            if (
              previous.filename !== migration.filename ||
              previous.checksum !== migration.checksum
            ) {
              throw new Error(
                `Migration drift detected for version ${migration.version}`,
              );
            }
            console.log(`${migration.filename}: applied`);
            continue;
          }
          if (
            baselineThrough != null &&
            migration.version <= baselineThrough &&
            !baselineExcept.includes(migration.version)
          ) {
            await client.query(
              `INSERT INTO schema_migrations (
                 version, filename, checksum, execution_ms
               ) VALUES ($1, $2, $3, 0)`,
              [migration.version, migration.filename, migration.checksum],
            );
            console.log(`${migration.filename}: baselined`);
            continue;
          }

          const startedAt = Date.now();
          await client.query(migration.sql);
          await client.query(
            `INSERT INTO schema_migrations (
               version, filename, checksum, execution_ms
             ) VALUES ($1, $2, $3, $4)`,
            [
              migration.version,
              migration.filename,
              migration.checksum,
              Date.now() - startedAt,
            ],
          );
          console.log(`${migration.filename}: applied now`);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      return;
    }

    const appliedResult = await client.query<AppliedMigration>(
      "SELECT version, filename, checksum FROM schema_migrations ORDER BY version",
    );
    const applied = new Map(
      appliedResult.rows.map((row) => [row.version, row]),
    );
    const files = migrationFiles();
    for (const migration of files) {
      const previous = applied.get(migration.version);
      if (previous) {
        if (
          previous.filename !== migration.filename ||
          previous.checksum !== migration.checksum
        ) {
          throw new Error(
            `Migration drift detected for version ${migration.version}`,
          );
        }
        console.log(`${migration.filename}: applied`);
        continue;
      }
      console.log(`${migration.filename}: pending`);
    }
  } finally {
    if (lockHeld) {
      await client.query(
        "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
        [`tripetica:migrations:${expectedDatabase}`],
      );
    }
    await client.end();
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? `${error.name}: ${error.message}` : "Migration failed",
  );
  process.exitCode = 1;
});
