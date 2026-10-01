import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPartnerEdevletAuthority,
  deletePartnerEdevletAuthority,
  getPartnerEdevletAuthority,
  getOpsEdevletAuthority,
  listOpsEdevletAuthorities,
  listPartnerEdevletAuthorities,
  setPartnerEdevletAuthorityStatus,
  updatePartnerEdevletAuthority,
} from "../uetds/partner-authority-store";
import { sealSecret, unsealSecret } from "../security/sealed-secret";

const partnerA = "11111111-1111-4111-8111-111111111111";
const partnerB = "22222222-2222-4222-8222-222222222222";
const companyOk = "33333333-3333-4333-8333-333333333333";
const companyOff = "44444444-4444-4444-8444-444444444444";

type Row = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  identity_sealed: string;
  identity_last4: string;
  password_sealed: string;
  status: "active" | "inactive";
  deleted_at: string | null;
};

test("e-Devlet authorities stay partner-scoped, masked, and keep sealed credentials", async () => {
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const before = globals.tripeticaPgPool;
  const key = process.env.UETDS_CREDENTIALS_KEY;
  process.env.UETDS_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");
  const rows: Row[] = [];
  const links = new Map<string, string[]>();
  const active = new Set([companyOk]);
  let seq = 0;
  let writes = 0;
  globals.tripeticaPgPool = {
    query: async (sql: string, values: unknown[]) => {
      assert.doesNotMatch(sql, /SELECT \*/);
      if (/SELECT/.test(sql) && /password_sealed|identity_sealed/.test(sql)) {
        throw new Error("sealed column selected");
      }
      if (sql.includes("FROM uetds_companies")) {
        const ids = values[0] as string[];
        return { rows: ids.filter((id) => active.has(id)).map((id) => ({ id })) };
      }
      if (sql.includes("FROM partner_uetds_authority_companies")) {
        const authorityId = String(values[0]);
        const partnerId = String(values[1]);
        const row = rows.find((item) => item.id === authorityId && item.partner_id === partnerId && !item.deleted_at);
        if (!row) return { rows: [] };
        return {
          rows: (links.get(authorityId) ?? []).map((id) => ({
            id,
            short_name: id === companyOk ? "Firma A" : id,
          })),
        };
      }
      if (sql.startsWith("SELECT id, first_name")) {
        const visible = rows.filter((item) => !item.deleted_at);
        if (sql.includes("WHERE id = $1")) {
          const found = visible.find((item) => item.id === values[0] && item.partner_id === values[1]);
          return { rows: found ? [found] : [] };
        }
        return {
          rows: visible
            .filter((item) => item.partner_id === values[0])
            .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)),
        };
      }
      if (sql.includes("JOIN partners p")) {
        const visible = rows
          .filter((item) => !item.deleted_at)
          .map((item) => ({
            ...item,
            partner_name: item.partner_id === partnerA ? "Partner A" : "Partner B",
          }));
        if (sql.includes("WHERE a.id = $1")) {
          const found = visible.find((item) => item.id === values[0]);
          return { rows: found ? [found] : [] };
        }
        return { rows: visible };
      }
      writes += 1;
      if (sql.startsWith("INSERT INTO partner_uetds_authorities")) {
        assert.equal(String(values[5]).startsWith("v1."), true);
        assert.notEqual(values[5], "fake-only-password");
        assert.notEqual(values[3], "12345678901");
        const row: Row = {
          id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(++seq).padStart(12, "0")}`,
          partner_id: String(values[0]),
          first_name: String(values[1]),
          last_name: String(values[2]),
          identity_sealed: String(values[3]),
          identity_last4: String(values[4]),
          password_sealed: String(values[5]),
          status: values[6] === "inactive" ? "inactive" : "active",
          deleted_at: null,
        };
        rows.push(row);
        return { rows: [{ id: row.id }] };
      }
      if (sql.startsWith("DELETE FROM partner_uetds_authority_companies")) {
        const row = rows.find((item) => item.id === values[0] && item.partner_id === values[1] && !item.deleted_at);
        if (row) links.set(row.id, []);
        return { rows: [] };
      }
      if (sql.startsWith("INSERT INTO partner_uetds_authority_companies")) {
        const row = rows.find((item) => item.id === values[0] && item.partner_id === values[1] && !item.deleted_at);
        if (!row) return { rows: [] };
        const current = links.get(row.id) ?? [];
        if (!current.includes(String(values[2]))) current.push(String(values[2]));
        links.set(row.id, current);
        return { rows: [] };
      }
      if (sql.includes("SET first_name")) {
        const row = rows.find((item) => item.id === values[0] && item.partner_id === values[1] && !item.deleted_at);
        if (!row) return { rows: [] };
        row.first_name = String(values[2]);
        row.last_name = String(values[3]);
        if (values[4]) {
          row.identity_sealed = String(values[4]);
          row.identity_last4 = String(values[5]);
        }
        if (values[6]) row.password_sealed = String(values[6]);
        return { rows: [{ id: row.id }] };
      }
      if (sql.includes("SET status")) {
        const row = rows.find(
          (item) => item.id === values[0] && item.partner_id === values[1] && !item.deleted_at && item.status === values[3],
        );
        if (!row) return { rows: [] };
        row.status = values[2] === "inactive" ? "inactive" : "active";
        return { rows: [{ id: row.id }] };
      }
      if (sql.includes("SET deleted_at")) {
        const row = rows.find((item) => item.id === values[0] && item.partner_id === values[1] && !item.deleted_at);
        if (!row) return { rows: [] };
        row.deleted_at = "now";
        return { rows: [{ id: row.id }] };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
  try {
    assert.equal(
      await createPartnerEdevletAuthority(partnerA, {
        firstName: "",
        lastName: "Kaya",
        identity: "12345678901",
        password: "fake-only-password",
        companyIds: [],
        status: "active",
      }),
      null,
    );
    const first = await createPartnerEdevletAuthority(partnerA, {
      firstName: "Ayşe",
      lastName: "Kaya",
      identity: "12345678901",
      password: "fake-only-password",
      companyIds: [companyOk],
      status: "active",
    });
    assert.equal(first?.fullName, "Ayşe Kaya");
    assert.equal(first?.maskedIdentity, "•••••••8901");
    assert.equal(first?.companies[0]?.shortName, "Firma A");
    assert.equal(unsealSecret(rows[0]!.password_sealed), "fake-only-password");
    assert.equal(unsealSecret(rows[0]!.identity_sealed), "12345678901");
    const second = await createPartnerEdevletAuthority(partnerA, {
      firstName: "Mehmet",
      lastName: "Demir",
      identity: "12345678902",
      password: "other-fake",
      companyIds: [],
      status: "inactive",
    });
    assert.equal((await listPartnerEdevletAuthorities(partnerA)).length, 2);
    assert.equal(second?.status, "inactive");
    const originalPassword = rows[0]!.password_sealed;
    const renamed = await updatePartnerEdevletAuthority(partnerA, first!.id, {
      firstName: "Ayşen",
      lastName: "Kaya",
      identity: "",
      password: "",
      companyIds: [companyOk],
    });
    assert.equal(renamed?.fullName, "Ayşen Kaya");
    assert.equal(rows[0]!.password_sealed, originalPassword);
    assert.equal(unsealSecret(rows[0]!.identity_sealed), "12345678901");
    const resealed = await updatePartnerEdevletAuthority(partnerA, first!.id, {
      firstName: "Ayşen",
      lastName: "Kaya",
      identity: "",
      password: "rotated-fake",
      companyIds: [companyOk],
    });
    assert.equal(resealed?.maskedIdentity, "•••••••8901");
    assert.equal(unsealSecret(rows[0]!.password_sealed), "rotated-fake");
    assert.equal(
      await updatePartnerEdevletAuthority(partnerB, first!.id, {
        firstName: "Ayşen",
        lastName: "Kaya",
        identity: "",
        password: "stolen",
        companyIds: [],
      }),
      null,
    );
    assert.equal(unsealSecret(rows[0]!.password_sealed), "rotated-fake");
    assert.equal(await getPartnerEdevletAuthority(partnerB, first!.id), null);
    assert.equal(
      await createPartnerEdevletAuthority(partnerA, {
        firstName: "Ali",
        lastName: "Yılmaz",
        identity: "12345678903",
        password: "fake",
        companyIds: [companyOff],
        status: "active",
      }),
      null,
    );
    assert.equal((await setPartnerEdevletAuthorityStatus(partnerA, second!.id, "active"))?.status, "active");
    assert.equal((await setPartnerEdevletAuthorityStatus(partnerA, second!.id, "inactive"))?.status, "inactive");
    assert.equal(await setPartnerEdevletAuthorityStatus(partnerB, second!.id, "active"), null);
    assert.equal(await deletePartnerEdevletAuthority(partnerB, first!.id), false);
    assert.equal(await deletePartnerEdevletAuthority(partnerA, first!.id), true);
    assert.equal(await getPartnerEdevletAuthority(partnerA, first!.id), null);
    assert.equal((await listPartnerEdevletAuthorities(partnerA)).length, 1);
    const other = await createPartnerEdevletAuthority(partnerB, {
      firstName: "Can",
      lastName: "Oz",
      identity: "12345678904",
      password: "partner-b-fake",
      companyIds: [],
      status: "active",
    });
    const opsList = await listOpsEdevletAuthorities();
    assert.equal(opsList.length, 2);
    assert.deepEqual(opsList.map((item) => item.partnerName).sort(), ["Partner A", "Partner B"]);
    assert.equal((await listPartnerEdevletAuthorities(partnerA)).length, 1);
    assert.equal((await listPartnerEdevletAuthorities(partnerB)).length, 1);
    const lookedUp = await getOpsEdevletAuthority(other!.id);
    assert.equal(lookedUp?.partnerId, partnerB);
    assert.equal(lookedUp?.partnerName, "Partner B");
    assert.equal(await getOpsEdevletAuthority(first!.id), null);
    assert.equal("password" in opsList[0]!, false);
    assert.doesNotMatch(JSON.stringify(opsList), /partner-b-fake|rotated-fake|password_sealed|identity_sealed|12345678904/);
    const writesBeforeMissingKey = writes;
    delete process.env.UETDS_CREDENTIALS_KEY;
    await assert.rejects(
      updatePartnerEdevletAuthority(partnerA, second!.id, {
        firstName: "Mehmet",
        lastName: "Demir",
        identity: "",
        password: "new",
        companyIds: [],
      }),
    );
    assert.equal(writes, writesBeforeMissingKey);
    assert.ok(sealSecret);
  } finally {
    globals.tripeticaPgPool = before;
    if (key === undefined) delete process.env.UETDS_CREDENTIALS_KEY;
    else process.env.UETDS_CREDENTIALS_KEY = key;
  }
});

test("authority UI and actions never return or store plaintext credentials", () => {
  const store = readFileSync("lib/uetds/partner-authority-store.ts", "utf8");
  const action = readFileSync("lib/uetds/partner-authority-actions.ts", "utf8");
  const form = readFileSync("components/partner/edevlet-authority-form.tsx", "utf8");
  const detail = readFileSync("components/partner/edevlet-authority-detail.tsx", "utf8");
  const list = readFileSync("components/partner/edevlet-authority-list.tsx", "utf8");
  const migration = readFileSync("db/migrations/066_partner_edevlet_authorities.sql", "utf8");
  const opsActions = readFileSync("lib/uetds/ops-authority-actions.ts", "utf8");
  const opsList = readFileSync("components/ops/edevlet-authority-list.tsx", "utf8");
  const opsDetail = readFileSync("components/ops/edevlet-authority-detail.tsx", "utf8");
  const opsPage = readFileSync("app/[locale]/ops/(panel)/uetds/authorities/page.tsx", "utf8");
  const joined = store + action + form + detail + list + opsActions + opsList + opsDetail + opsPage;
  assert.doesNotMatch(joined, /unsealSecret|console\.|localStorage|sessionStorage/);
  assert.match(action, /actor\.partnerId/);
  assert.doesNotMatch(action, /form\.get\("partnerId"\)/);
  assert.match(form, /type="password"/);
  assert.match(form, /useState\(""\)/);
  assert.match(detail, /••••••••/);
  assert.match(list, /maskedIdentity/);
  assert.match(store, /deleted_at = NOW\(\)/);
  assert.doesNotMatch(migration, /password_sealed\s*=/);
  assert.doesNotMatch(migration, /identity_sealed\s*=/);
  assert.match(migration, /partner_uetds_authority_companies/);
  assert.match(migration, /ADD COLUMN first_name/);
  assert.match(opsActions, /getOpsEdevletAuthority/);
  assert.match(opsActions, /existing\.partnerId/);
  assert.doesNotMatch(opsActions, /createPartnerEdevletAuthority|form\.get\("partnerId"\)|unsealSecret/);
  assert.match(opsList, /partnerName/);
  assert.match(opsList, /maskedIdentity/);
  assert.doesNotMatch(opsList, /edevletAuthorityNew|\/new/);
  assert.match(opsDetail, /••••••••/);
  assert.match(opsDetail, /updateAction=\{updateOpsEdevletAuthorityAction\}/);
  assert.doesNotMatch(opsPage, /createPartnerEdevletAuthority|\/authorities\/new/);
  assert.equal(readFileSync("lib/uetds/list-policy.ts", "utf8").includes("2 * 60 * 60 * 1000"), true);
});
