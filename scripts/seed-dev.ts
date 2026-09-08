import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { assertExpectedDatabase } from "../lib/db/database-target";

function loadDevEnv() {
  for (const name of [".env.development.local", ".env.local"]) {
    const file = path.resolve(process.cwd(), name);
    if (!existsSync(file)) {
      continue;
    }
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      const separator = line.indexOf("=");
      if (!line || line.startsWith("#") || separator <= 0) {
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

async function main() {
  loadDevEnv();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const expectedDatabase = process.env.EXPECTED_DATABASE?.trim();
  if (!databaseUrl || expectedDatabase !== "tripetica_dev") {
    throw new Error("DEV seed requires EXPECTED_DATABASE=tripetica_dev");
  }
  assertExpectedDatabase(databaseUrl, expectedDatabase);

  const client = new Client({
    connectionString: databaseUrl,
    application_name: "tripetica_dev_seed",
  });
  await client.connect();
  try {
    const identity = await client.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    if (identity.rows[0]?.database !== "tripetica_dev") {
      throw new Error("DEV seed connected to an unexpected database");
    }
    await client.query("BEGIN");
    await client.query(
      `UPDATE fx_quote_cache
       SET is_active = FALSE
       WHERE is_active = TRUE`,
    );
    await client.query(
      `DELETE FROM fx_quote_cache
       WHERE raw_rates ->> 'environment' = 'development-synthetic'`,
    );
    await client.query(
      `INSERT INTO fx_quote_cache (
         source,
         fetched_at,
         expires_at,
         provider_next_update_at,
         eur_to_usd,
         eur_to_eur,
         eur_to_try,
         market_eur_to_rub,
         eur_to_rub,
         eur_to_gbp,
         raw_rates,
         is_active
       ) VALUES (
         'exchange-rate-api-open-access',
         NOW(),
         NOW() + INTERVAL '24 hours',
         NOW() + INTERVAL '24 hours',
         1.10,
         1,
         45,
         95,
         101,
         0.85,
         '{"base":"EUR","USD":1.10,"EUR":1,"TRY":45,"RUB":95,"GBP":0.85,"environment":"development-synthetic"}'::jsonb,
         TRUE
       )`,
    );
    await client.query("COMMIT");
    console.log("DEV synthetic reference seed applied to tripetica_dev");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? `${error.name}: ${error.message}` : "DEV seed failed",
  );
  process.exitCode = 1;
});
