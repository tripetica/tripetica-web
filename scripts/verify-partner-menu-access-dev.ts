import { createHash, randomBytes } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { hashPassword } from "../lib/security/password";

const TABS = [
  "jobs",
  "accepted",
  "drivers",
  "vehicles",
  "gps",
  "uetds",
  "edevlet",
  "profile",
  "billing",
  "users",
] as const;

const TAG = "menu-access-dev";
const EMAILS = {
  a: "menu-access-a@tripetica.test",
  aExtra: "menu-access-a-extra@tripetica.test",
  b: "menu-access-b@tripetica.test",
  r: "menu-access-r@tripetica.test",
  rExtra: "menu-access-r-extra@tripetica.test",
  ops: "menu-access-ops@tripetica.test",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function databaseUrl() {
  const raw = readFileSync(".env.development.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("DATABASE_URL=")) continue;
    return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DEV DATABASE_URL missing");
}

async function removeFixtures(client: Client) {
  const emails = Object.values(EMAILS);
  await client.query("BEGIN");
  const users = await client.query<{ id: string; partner_id: string }>(
    `SELECT id, partner_id FROM partner_users WHERE lower(email) = ANY($1::text[])`,
    [emails],
  );
  const ops = await client.query<{ id: string }>(
    `SELECT id FROM ops_users WHERE lower(email) = $1`,
    [EMAILS.ops],
  );
  const partnerIds = [...new Set(users.rows.map((row) => row.partner_id))];
  if (users.rows.length) {
    await client.query(`DELETE FROM partner_sessions WHERE user_id = ANY($1::uuid[])`, [
      users.rows.map((row) => row.id),
    ]);
    await client.query(`DELETE FROM partner_users WHERE id = ANY($1::uuid[])`, [
      users.rows.map((row) => row.id),
    ]);
  }
  if (partnerIds.length) {
    await client.query(
      `DELETE FROM partner_drivers WHERE partner_id = ANY($1::uuid[])`,
      [partnerIds],
    );
    await client.query(
      `DELETE FROM partner_vehicles WHERE partner_id = ANY($1::uuid[])`,
      [partnerIds],
    );
    await client.query(`DELETE FROM partners WHERE id = ANY($1::uuid[]) AND name LIKE 'MENU ACCESS %'`, [
      partnerIds,
    ]);
  }
  if (ops.rows[0]) {
    await client.query(`DELETE FROM ops_sessions WHERE user_id = $1`, [ops.rows[0].id]);
    await client.query(`DELETE FROM ops_users WHERE id = $1`, [ops.rows[0].id]);
  }
  await client.query(
    `DELETE FROM partner_drivers
      WHERE partner_id IN (
        SELECT id FROM partners
         WHERE partner_code = ANY($1::text[]) OR name LIKE 'MENU ACCESS %'
      )`,
    [["PTR-9101", "PTR-9102", "PTR-9103", "PTR-9198", "PTR-9199"]],
  );
  await client.query(
    `DELETE FROM partner_vehicles
      WHERE partner_id IN (
        SELECT id FROM partners
         WHERE partner_code = ANY($1::text[]) OR name LIKE 'MENU ACCESS %'
      )`,
    [["PTR-9101", "PTR-9102", "PTR-9103", "PTR-9198", "PTR-9199"]],
  );
  await client.query(
    `DELETE FROM partner_sessions
      WHERE user_id IN (
        SELECT id FROM partner_users
         WHERE partner_id IN (
           SELECT id FROM partners
            WHERE partner_code = ANY($1::text[]) OR name LIKE 'MENU ACCESS %'
         )
      )`,
    [["PTR-9101", "PTR-9102", "PTR-9103", "PTR-9198", "PTR-9199"]],
  );
  await client.query(
    `DELETE FROM partner_users
      WHERE partner_id IN (
        SELECT id FROM partners
         WHERE partner_code = ANY($1::text[]) OR name LIKE 'MENU ACCESS %'
      )`,
    [["PTR-9101", "PTR-9102", "PTR-9103", "PTR-9198", "PTR-9199"]],
  );
  await client.query(
    `DELETE FROM partners
      WHERE partner_code = ANY($1::text[])
         OR name LIKE 'MENU ACCESS %'`,
    [["PTR-9101", "PTR-9102", "PTR-9103", "PTR-9198", "PTR-9199"]],
  );
  await client.query("COMMIT");
}

async function main() {
  const url = new URL(databaseUrl());
  assert(url.pathname === "/tripetica_dev", `refusing database ${url.pathname}`);
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const current = await client.query<{ name: string }>("SELECT current_database() AS name");
  assert(current.rows[0]?.name === "tripetica_dev", "connected database is not DEV");
  try {
    if (process.argv.includes("--cleanup")) {
      await removeFixtures(client);
      console.log("cleaned");
      return;
    }
    await removeFixtures(client);

    await client.query("BEGIN");
    const lockedCode = "PTR-9199";
    await client.query(
      `DELETE FROM partners WHERE partner_code = ANY($1::text[])`,
      [[lockedCode, "PTR-9198"]],
    );
    const lockedPartner = await client.query<{ id: string }>(
      `INSERT INTO partners (partner_code, name, status, is_primary_partner)
       VALUES ($1, 'MENU ACCESS LOCKED', 'active', FALSE)
       RETURNING id`,
      [lockedCode],
    );
    const lockedUser = await client.query<{ id: string }>(
      `INSERT INTO partner_users (
         partner_id, email, password_hash, role, status, must_change_password, is_owner
       ) VALUES ($1, 'menu-access-locked@tripetica.test', 'x', 'admin', 'active', FALSE, FALSE)
       RETURNING id`,
      [lockedPartner.rows[0]!.id],
    );
    const grantedPartner = await client.query<{ id: string }>(
      `INSERT INTO partners (partner_code, name, status, is_primary_partner)
       VALUES ('PTR-9198', 'MENU ACCESS GRANTED', 'active', FALSE)
       RETURNING id`,
    );
    const grantedOwner = await client.query<{ id: string }>(
      `INSERT INTO partner_users (
         partner_id, email, password_hash, role, status, must_change_password, is_owner
       ) VALUES ($1, 'menu-access-granted-owner@tripetica.test', 'x', 'admin', 'active', FALSE, TRUE)
       RETURNING id`,
      [grantedPartner.rows[0]!.id],
    );
    const grantedExtra = await client.query<{ id: string }>(
      `INSERT INTO partner_users (
         partner_id, email, password_hash, role, status, must_change_password, is_owner
       ) VALUES ($1, 'menu-access-granted-extra@tripetica.test', 'x', 'admin', 'active', FALSE, FALSE)
       RETURNING id`,
      [grantedPartner.rows[0]!.id],
    );
    await client.query(`INSERT INTO partner_user_grants (user_id, tab) VALUES ($1, 'drivers')`, [
      grantedExtra.rows[0]!.id,
    ]);
    await client.query(`INSERT INTO partner_menu_denials (partner_id, tab) VALUES ($1, 'uetds')`, [
      grantedPartner.rows[0]!.id,
    ]);
    await client.query(readFileSync("db/migrations/118_partner_menu_default_open.sql", "utf8").split("UPDATE partner_users")[1]!.replace(/^/, "UPDATE partner_users"));
    const promoted = await client.query<{ is_owner: boolean }>(
      `SELECT is_owner FROM partner_users WHERE id = $1`,
      [lockedUser.rows[0]!.id],
    );
    const extraStill = await client.query<{ is_owner: boolean; grants: number; denials: number }>(
      `SELECT u.is_owner,
              (SELECT count(*) FROM partner_user_grants g WHERE g.user_id = u.id)::int AS grants,
              (SELECT count(*) FROM partner_menu_denials d WHERE d.partner_id = u.partner_id)::int AS denials
         FROM partner_users u
        WHERE u.id = $1`,
      [grantedExtra.rows[0]!.id],
    );
    const ownerUntouched = await client.query<{ is_owner: boolean }>(
      `SELECT is_owner FROM partner_users WHERE id = $1`,
      [grantedOwner.rows[0]!.id],
    );
    assert(promoted.rows[0]?.is_owner === true, "zero-grant partner login was not promoted");
    assert(extraStill.rows[0]?.is_owner === false, "explicit extra user was promoted");
    assert(extraStill.rows[0]?.grants === 1, "existing grant was rewritten");
    assert(extraStill.rows[0]?.denials === 1, "existing denial was cleared");
    assert(ownerUntouched.rows[0]?.is_owner === true, "existing owner changed");
    await client.query("ROLLBACK");

    const password = `Menu-${randomBytes(9).toString("base64url")}`;
    const passwordHash = await hashPassword(password);
    const partners = {
      a: { code: "PTR-9101", name: "MENU ACCESS A", email: EMAILS.a },
      b: { code: "PTR-9102", name: "MENU ACCESS B", email: EMAILS.b },
      r: { code: "PTR-9103", name: "MENU ACCESS RESTRICTED", email: EMAILS.r },
    };
    const ids: Record<string, string> = {};
    for (const key of ["r", "a", "b"] as const) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO partners (partner_code, name, status, is_primary_partner)
         VALUES ($1, $2, 'active', FALSE)
         RETURNING id`,
        [partners[key].code, partners[key].name],
      );
      ids[key] = inserted.rows[0]!.id;
      await client.query(
        `INSERT INTO partner_users (
           partner_id, email, password_hash, role, status, must_change_password, is_owner
         ) VALUES ($1, $2, $3, 'admin', 'active', FALSE, TRUE)`,
        [ids[key], partners[key].email, passwordHash],
      );
    }
    await client.query(`INSERT INTO partner_menu_denials (partner_id, tab) VALUES ($1, 'gps')`, [ids.r]);
    const extra = await client.query<{ id: string }>(
      `INSERT INTO partner_users (
         partner_id, email, password_hash, role, status, must_change_password, is_owner
       ) VALUES ($1, $2, $3, 'admin', 'active', FALSE, FALSE)
       RETURNING id`,
      [ids.r, EMAILS.rExtra, passwordHash],
    );
    await client.query(
      `INSERT INTO partner_user_grants (user_id, tab) VALUES ($1, 'drivers'), ($1, 'vehicles')`,
      [extra.rows[0]!.id],
    );
    const aExtra = await client.query<{ id: string }>(
      `INSERT INTO partner_users (
         partner_id, email, password_hash, role, status, must_change_password, is_owner
       ) VALUES ($1, $2, $3, 'admin', 'active', FALSE, FALSE)
       RETURNING id`,
      [ids.a, EMAILS.aExtra, passwordHash],
    );
    await client.query(`INSERT INTO partner_user_grants (user_id, tab) VALUES ($1, 'drivers')`, [
      aExtra.rows[0]!.id,
    ]);
    const vehicle = await client.query<{ id: string }>(
      `INSERT INTO partner_vehicles (partner_id, plate, status)
       VALUES ($1, '34MENU001', 'active')
       RETURNING id`,
      [ids.a],
    );
    await client.query(
      `INSERT INTO partner_vehicle_access (vehicle_id, partner_id) VALUES ($1, $2)`,
      [vehicle.rows[0]!.id, ids.a],
    );
    const driver = await client.query<{ id: string }>(
      `INSERT INTO partner_drivers (partner_id, first_name, last_name, status)
       VALUES ($1, 'MENU', 'ACCESS', 'active')
       RETURNING id`,
      [ids.a],
    );
    await client.query(
      `INSERT INTO ops_users (first_name, last_name, email, password_hash, role, is_active)
       VALUES ('Menu', 'Access', $1, $2, 'owner', TRUE)`,
      [EMAILS.ops, passwordHash],
    );

    const access = await client.query<{
      vehicle_a: boolean;
      vehicle_b: boolean;
      driver_a: boolean;
      driver_b: boolean;
    }>(
      `SELECT partner_can_access_vehicle($1, $3) AS vehicle_a,
              partner_can_access_vehicle($2, $3) AS vehicle_b,
              partner_can_access_driver($1, $4) AS driver_a,
              partner_can_access_driver($2, $4) AS driver_b`,
      [ids.a, ids.b, vehicle.rows[0]!.id, driver.rows[0]!.id],
    );
    assert(access.rows[0]?.vehicle_a === true, "owner cannot see own vehicle");
    assert(access.rows[0]?.vehicle_b === false, "other partner can see the private vehicle");
    assert(access.rows[0]?.driver_a === true, "owner cannot see own driver");
    assert(access.rows[0]?.driver_b === false, "other partner can see the private driver");

    const open = await client.query<{ denials: number; owner: boolean; grants: number }>(
      `SELECT u.is_owner AS owner,
              (SELECT count(*) FROM partner_user_grants g WHERE g.user_id = u.id)::int AS grants,
              (SELECT count(*) FROM partner_menu_denials d WHERE d.partner_id = u.partner_id)::int AS denials
         FROM partner_users u
        WHERE lower(u.email) = $1`,
      [EMAILS.a],
    );
    assert(open.rows[0]?.owner === true && open.rows[0].grants === 0 && open.rows[0].denials === 0, "new partner is not default-open");

    const token = randomBytes(32).toString("base64url");
    const userA = await client.query<{ id: string }>(
      `SELECT id FROM partner_users WHERE lower(email) = $1`,
      [EMAILS.a],
    );
    await client.query(
      `INSERT INTO partner_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
      [userA.rows[0]!.id, createHash("sha256").update(token).digest("hex")],
    );

    const file = "/tmp/menu-access-dev.json";
    writeFileSync(
      file,
      JSON.stringify({
        password,
        token,
        partnerA: ids.a,
        partnerB: ids.b,
        partnerR: ids.r,
        emails: EMAILS,
        tabs: TABS,
      }),
      { mode: 0o600 },
    );
    chmodSync(file, 0o600);
    console.log(JSON.stringify({
      ok: true,
      partnerA: ids.a,
      partnerB: ids.b,
      partnerR: ids.r,
      tag: TAG,
      defaultOpen: true,
      isolation: true,
      preservedRestriction: true,
    }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exit(1);
});
