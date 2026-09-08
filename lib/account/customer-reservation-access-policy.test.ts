import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  accountActorVerificationStatus,
  customerCanAccessReservation,
  VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL,
} from "./customer-reservation-access-policy";

const verifiedActor = {
  id: "customer-a",
  email: "customer@example.com",
  emailVerifiedAt: "2026-09-05T07:00:00.000Z",
};

test("unverified account is denied reservation access", () => {
  const actor = { ...verifiedActor, emailVerifiedAt: null };
  assert.equal(accountActorVerificationStatus(actor), "unverified");
  assert.equal(
    customerCanAccessReservation(actor, {
      customerUserId: actor.id,
      customerEmail: actor.email,
    }),
    false,
  );
});

test("verified customer can access a reservation assigned to its immutable id", () => {
  assert.equal(
    customerCanAccessReservation(verifiedActor, {
      customerUserId: verifiedActor.id,
      customerEmail: "old@example.com",
    }),
    true,
  );
});

test("matching stale email cannot override another assigned customer id", () => {
  assert.equal(
    customerCanAccessReservation(verifiedActor, {
      customerUserId: "customer-b",
      customerEmail: verifiedActor.email,
    }),
    false,
  );
});

test("verified matching email can discover an unassigned legacy reservation", () => {
  assert.equal(
    customerCanAccessReservation(verifiedActor, {
      customerUserId: null,
      customerEmail: " Customer@Example.com ",
    }),
    true,
  );
});

test("assigned legacy reservation stops authorizing by email", () => {
  const claimed = {
    customerUserId: verifiedActor.id,
    customerEmail: verifiedActor.email,
  };
  assert.equal(customerCanAccessReservation(verifiedActor, claimed), true);
  assert.equal(
    customerCanAccessReservation(
      {
        id: "customer-b",
        email: verifiedActor.email,
        emailVerifiedAt: verifiedActor.emailVerifiedAt,
      },
      claimed,
    ),
    false,
  );
});

test("SQL ownership policy requires a verified active actor and null-only legacy fallback", () => {
  assert.match(
    VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL,
    /customer_actor\.email_verified_at IS NOT NULL/,
  );
  assert.match(
    VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL,
    /r\.customer_user_id = customer_actor\.id/,
  );
  assert.match(
    VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL,
    /r\.customer_user_id IS NULL[\s\S]+lower\(trim\(r\.customer_email\)\)/,
  );
});

test("all customer reservation DAL paths share the centralized ownership policy", () => {
  const root = process.cwd();
  const ownershipFiles = [
    "lib/account/reservations.ts",
    "lib/account/customer-cancel.ts",
    "lib/account/customer-reservation-status.ts",
    "lib/booking/edit-draft.ts",
  ];
  for (const relative of ownershipFiles) {
    const source = readFileSync(path.join(root, relative), "utf8");
    assert.match(
      source,
      /VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL/,
      `${relative} must use the centralized ownership policy`,
    );
    assert.doesNotMatch(
      source,
      /OR\s+lower\(customer_email\)/,
      `${relative} must not authorize assigned reservations by stale email`,
    );
  }

  const actions = readFileSync(
    path.join(root, "lib/account/actions.ts"),
    "utf8",
  );
  assert.equal(
    actions.match(/requireVerifiedAccountActor\(\)/g)?.length,
    3,
    "detail, status mutation and edit start actions must require verification",
  );

  const voucherRoute = readFileSync(
    path.join(
      root,
      "app/[locale]/(public)/account/reservations/[id]/voucher-pdf/route.ts",
    ),
    "utf8",
  );
  assert.match(voucherRoute, /requireVerifiedAccountActor\(\)/);
});
