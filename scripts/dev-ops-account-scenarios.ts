import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript } from "./partner-dev-guard";

if (!process.env.DATABASE_URL) {
  loadDevelopmentEnv();
}
assertDevPartnerScript();

const stamp = Date.now();
const shortPassword = "1234567";
const eightPassword = "12345678";
const nextEightPassword = "abcdefgh";

function fail(message: string): never {
  throw new Error(message);
}

async function hashFingerprint(
  query: typeof import("../lib/db/postgres").query,
  table: "customer_users" | "ops_users" | "partner_users",
) {
  const result = await query<{ fingerprint: string | null }>(
    `SELECT md5(string_agg(id::text || ':' || password_hash, ',' ORDER BY id)) AS fingerprint
     FROM ${table}`,
  );
  return result.rows[0]?.fingerprint ?? "";
}

async function main() {
  const { query } = await import("../lib/db/postgres");
  const { insertCustomerUser } = await import("../lib/account/users");
  const { parsePartnerApplicationInput } = await import(
    "../lib/partner/application-fields"
  );
  const { changePartnerPassword } = await import("../lib/partner/password-change");
  const { isPartnerPasswordLengthValid } = await import("../lib/partner/policy");
  const {
    changeOpsSelfPassword,
    updateOpsSelfProfile,
  } = await import("../lib/ops/account");
  const { hashPassword, verifyPassword } = await import("../lib/security/password");
  const { isPasswordLengthValid } = await import("../lib/security/password-policy");

  const before = {
    customer: await hashFingerprint(query, "customer_users"),
    ops: await hashFingerprint(query, "ops_users"),
    partner: await hashFingerprint(query, "partner_users"),
  };

  const created = {
    customers: [] as string[],
    ops: [] as string[],
    partners: [] as string[],
  };

  let testError: unknown;
  try {
    if (isPasswordLengthValid(shortPassword)) {
      fail("shared policy accepted 7 characters");
    }
    if (!isPasswordLengthValid(eightPassword) || !isPasswordLengthValid("123456789")) {
      fail("shared policy rejected 8+ characters");
    }

    const customerShortHashAttempt = isPasswordLengthValid(shortPassword);
    if (customerShortHashAttempt) {
      fail("customer 7-character password was not rejected");
    }

    const customerEightHash = await hashPassword(eightPassword);
    const customerId = await insertCustomerUser({
      firstName: "Test",
      lastName: "Customer",
      email: `cust-account-test-${stamp}@tripetica.local`,
      phone: null,
      phoneCountryCode: null,
      nationalityCode: "TR",
      passwordHash: customerEightHash,
    });
    created.customers.push(customerId);
    const customerRow = await query<{ password_hash: string }>(
      `SELECT password_hash FROM customer_users WHERE id = $1`,
      [customerId],
    );
    if (!(await verifyPassword(eightPassword, customerRow.rows[0]!.password_hash))) {
      fail("customer 8-character password was not accepted");
    }

    const partnerShort = parsePartnerApplicationInput({
      email: `ptr-account-test-${stamp}@tripetica.local`,
      phoneCountryCode: "TR",
      phoneNational: "532 123 45 67",
      contactFirstName: "Test",
      contactLastName: "Partner",
      businessType: "company",
      name: "Account Test Partner",
      addressLine: "Tesvikiye Mah. Test Sok. No:1 Şişli / İstanbul",
      countryCode: "TR",
      taxOffice: "Şişli",
      taxNumber: "1234567890",
      password: shortPassword,
      confirmPassword: shortPassword,
      lockCountryToDefault: true,
      strictRegisterTaxId: true,
    });
    if (!partnerShort.ok) {
      if (partnerShort.error !== "password-short") {
        fail("partner 7-character password failed for the wrong reason");
      }
    } else {
      fail("partner 7-character password was not rejected");
    }
    if (!isPartnerPasswordLengthValid(eightPassword)) {
      fail("partner 8-character password was not accepted");
    }
    const partnerEight = parsePartnerApplicationInput({
      email: `ptr-account-test-${stamp}@tripetica.local`,
      phoneCountryCode: "TR",
      phoneNational: "532 123 45 67",
      contactFirstName: "Test",
      contactLastName: "Partner",
      businessType: "company",
      name: "Account Test Partner",
      addressLine: "Tesvikiye Mah. Test Sok. No:1 Şişli / İstanbul",
      countryCode: "TR",
      taxOffice: "Şişli",
      taxNumber: "1234567890",
      password: eightPassword,
      confirmPassword: eightPassword,
      lockCountryToDefault: true,
      strictRegisterTaxId: true,
    });
    if (!partnerEight.ok) {
      fail("partner 8-character password was not accepted");
    }

    const hostPartner = await query<{ id: string }>(
      `SELECT id FROM partners
       WHERE deleted_at IS NULL AND status = 'active'
       ORDER BY is_primary_partner DESC
       LIMIT 1`,
    );
    if (!hostPartner.rows[0]) {
      fail("need an active DEV partner");
    }
    const partnerUser = await query<{ id: string }>(
      `INSERT INTO partner_users (
         partner_id, email, password_hash, role, status, must_change_password
       )
       VALUES ($1, $2, $3, 'admin', 'active', FALSE)
       RETURNING id`,
      [
        hostPartner.rows[0].id,
        `ptr-account-test-${stamp}@tripetica.local`,
        await hashPassword(eightPassword),
      ],
    );
    const partnerUserId = partnerUser.rows[0]!.id;
    created.partners.push(partnerUserId);
    const partnerActor = {
      userId: partnerUserId,
      partnerId: hostPartner.rows[0].id,
      email: `ptr-account-test-${stamp}@tripetica.local`,
      role: "admin" as const,
      partnerName: "Test",
      partnerCode: "PTR-0000",
      isPrimaryPartner: false,
      mustChangePassword: false,
    };
    const partnerReject = await changePartnerPassword({
      actor: partnerActor,
      currentPassword: eightPassword,
      newPassword: shortPassword,
      confirmPassword: shortPassword,
      requireCurrent: true,
    });
    if (partnerReject.ok || partnerReject.error !== "short") {
      fail("partner password change accepted 7 characters");
    }
    const partnerAccept = await changePartnerPassword({
      actor: partnerActor,
      currentPassword: eightPassword,
      newPassword: nextEightPassword,
      confirmPassword: nextEightPassword,
      requireCurrent: true,
    });
    if (!partnerAccept.ok) {
      fail("partner password change rejected 8+ characters");
    }

    const victim = await query<{ id: string; first_name: string; email: string }>(
      `INSERT INTO ops_users (first_name, last_name, email, password_hash, role, is_active)
       VALUES ('Victim', 'User', $1, $2, 'employee', TRUE)
       RETURNING id, first_name, email`,
      [
        `ops-account-victim-${stamp}@tripetica.local`,
        await hashPassword(eightPassword),
      ],
    );
    const actor = await query<{ id: string; first_name: string; email: string }>(
      `INSERT INTO ops_users (first_name, last_name, email, password_hash, role, is_active)
       VALUES ('Actor', 'User', $1, $2, 'employee', TRUE)
       RETURNING id, first_name, email`,
      [
        `ops-account-actor-${stamp}@tripetica.local`,
        await hashPassword(eightPassword),
      ],
    );
    created.ops.push(victim.rows[0]!.id, actor.rows[0]!.id);

    const nameUpdate = await updateOpsSelfProfile({
      actorId: actor.rows[0]!.id,
      firstName: "Updated",
      lastName: "Name",
      email: actor.rows[0]!.email,
    });
    if (!nameUpdate.ok) {
      fail("ops name update failed");
    }

    const badEmail = await updateOpsSelfProfile({
      actorId: actor.rows[0]!.id,
      firstName: "Updated",
      lastName: "Name",
      email: "not-an-email",
    });
    if (badEmail.ok || badEmail.error !== "invalid-email") {
      fail("ops email validation did not reject invalid email");
    }

    const stolenEmail = await updateOpsSelfProfile({
      actorId: actor.rows[0]!.id,
      firstName: "Updated",
      lastName: "Name",
      email: victim.rows[0]!.email,
    });
    if (stolenEmail.ok || stolenEmail.error !== "email-taken") {
      fail("ops profile allowed taking another user's email");
    }

    const victimAfter = await query<{ first_name: string; email: string; password_hash: string }>(
      `SELECT first_name, email, password_hash FROM ops_users WHERE id = $1`,
      [victim.rows[0]!.id],
    );
    if (
      victimAfter.rows[0]!.first_name !== "Victim" ||
      victimAfter.rows[0]!.email !== victim.rows[0]!.email
    ) {
      fail("ops self-profile changed another user");
    }

    const wrongCurrent = await changeOpsSelfPassword({
      actorId: actor.rows[0]!.id,
      currentPassword: "wrong-pass",
      newPassword: nextEightPassword,
      confirmPassword: nextEightPassword,
    });
    if (wrongCurrent.ok || wrongCurrent.error !== "current-invalid") {
      fail("ops password change accepted an incorrect current password");
    }

    const mismatch = await changeOpsSelfPassword({
      actorId: actor.rows[0]!.id,
      currentPassword: eightPassword,
      newPassword: nextEightPassword,
      confirmPassword: "123456780",
    });
    if (mismatch.ok || mismatch.error !== "mismatch") {
      fail("ops password change accepted mismatched confirmation");
    }

    const shortChange = await changeOpsSelfPassword({
      actorId: actor.rows[0]!.id,
      currentPassword: eightPassword,
      newPassword: shortPassword,
      confirmPassword: shortPassword,
    });
    if (shortChange.ok || shortChange.error !== "short") {
      fail("ops password change accepted 7 characters");
    }

    const eightChange = await changeOpsSelfPassword({
      actorId: actor.rows[0]!.id,
      currentPassword: eightPassword,
      newPassword: nextEightPassword,
      confirmPassword: nextEightPassword,
    });
    if (!eightChange.ok) {
      fail("ops password change rejected 8+ characters");
    }

    const actorHash = await query<{ password_hash: string }>(
      `SELECT password_hash FROM ops_users WHERE id = $1`,
      [actor.rows[0]!.id],
    );
    if (!(await verifyPassword(nextEightPassword, actorHash.rows[0]!.password_hash))) {
      fail("ops new password hash did not verify");
    }
    if (await verifyPassword(eightPassword, actorHash.rows[0]!.password_hash)) {
      fail("ops old password still verified after change");
    }
    const victimHashAfter = await query<{ first_name: string; email: string; password_hash: string }>(
      `SELECT first_name, email, password_hash FROM ops_users WHERE id = $1`,
      [victim.rows[0]!.id],
    );
    if (
      victimHashAfter.rows[0]!.first_name !== "Victim" ||
      victimHashAfter.rows[0]!.email !== victim.rows[0]!.email ||
      (await verifyPassword(nextEightPassword, victimHashAfter.rows[0]!.password_hash))
    ) {
      fail("ops password change affected another user");
    }

    const shortLoginUser = await query<{ id: string; password_hash: string }>(
      `INSERT INTO ops_users (first_name, last_name, email, password_hash, role, is_active)
       VALUES ('Short', 'Login', $1, $2, 'employee', TRUE)
       RETURNING id, password_hash`,
      [
        `ops-account-short-${stamp}@tripetica.local`,
        await hashPassword(shortPassword),
      ],
    );
    created.ops.push(shortLoginUser.rows[0]!.id);
    if (!(await verifyPassword(shortPassword, shortLoginUser.rows[0]!.password_hash))) {
      fail("existing-style 7-character ops password could not verify");
    }

    const existingPartner = await query<{ password_hash: string }>(
      `SELECT password_hash FROM partner_users
       WHERE email NOT LIKE '%account-test-%'
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    const existingOps = await query<{ password_hash: string }>(
      `SELECT password_hash FROM ops_users
       WHERE email NOT LIKE '%account-test-%'
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    if (!existingPartner.rows[0] || !existingOps.rows[0]) {
      fail("need existing partner and ops users in DEV");
    }
    if (
      !existingPartner.rows[0].password_hash.startsWith("scrypt$") ||
      !existingOps.rows[0].password_hash.startsWith("scrypt$")
    ) {
      fail("existing user hashes are not the current hashing format");
    }
  } catch (error) {
    testError = error;
  } finally {
    if (created.partners.length) {
      await query(`DELETE FROM partner_sessions WHERE user_id = ANY($1::uuid[])`, [
        created.partners,
      ]);
      await query(`DELETE FROM partner_users WHERE id = ANY($1::uuid[])`, [
        created.partners,
      ]);
    }
    if (created.ops.length) {
      await query(`DELETE FROM ops_sessions WHERE user_id = ANY($1::uuid[])`, [
        created.ops,
      ]);
      await query(`DELETE FROM ops_users WHERE id = ANY($1::uuid[])`, [created.ops]);
    }
    if (created.customers.length) {
      await query(`DELETE FROM customer_sessions WHERE user_id = ANY($1::uuid[])`, [
        created.customers,
      ]);
      await query(`DELETE FROM customer_users WHERE id = ANY($1::uuid[])`, [
        created.customers,
      ]);
    }
  }

  const after = {
    customer: await hashFingerprint(query, "customer_users"),
    ops: await hashFingerprint(query, "ops_users"),
    partner: await hashFingerprint(query, "partner_users"),
  };
  if (
    before.customer !== after.customer ||
    before.ops !== after.ops ||
    before.partner !== after.partner
  ) {
    fail("existing user password hashes changed");
  }
  if (testError) {
    throw testError;
  }

  console.log("ops-account-dev-scenarios: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exit(1);
});
