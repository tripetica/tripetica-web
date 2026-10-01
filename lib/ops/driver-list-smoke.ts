/**
 * DEV-only smoke for Ops/Partner driver list subscription queries.
 * Uses pure query plans + pg Client (avoids server-only imports).
 *
 * Run:
 *   EXPECTED_DATABASE=tripetica_dev NODE_ENV=development \
 *     node --import tsx lib/ops/driver-list-smoke.ts
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { loadDevelopmentEnv } from "@/scripts/load-env";
import {
  assertSqlBindArity,
  buildOpsDriverListQueryPlan,
  buildPartnerDriverListQueryPlan,
} from "@/lib/ops/driver-list-query";
import {
  istanbulSubscriptionPeriodKey,
  mapUetdsSubscriptionListSummary,
} from "@/lib/uetds/driver-subscription";

loadDevelopmentEnv();
process.env.EXPECTED_DATABASE = process.env.EXPECTED_DATABASE || "tripetica_dev";

function assertDevTarget(url: string) {
  const host = new URL(url).pathname.replace(/^\//, "");
  if (host !== "tripetica_dev" && !url.includes("tripetica_dev")) {
    // DATABASE_URL path is the database name
    const db = url.split("/").pop()?.split("?")[0];
    if (db !== "tripetica_dev") {
      throw new Error(`Refuse smoke against non-dev database: ${db}`);
    }
  }
  if (process.env.EXPECTED_DATABASE !== "tripetica_dev") {
    throw new Error("EXPECTED_DATABASE must be tripetica_dev");
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  assertDevTarget(url);

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const period = istanbulSubscriptionPeriodKey();

    console.log("A) listOpsDrivers empty search…");
    const emptyPlan = buildOpsDriverListQueryPlan({
      query: "",
      dir: "asc",
      page: 1,
      pageSize: 25,
      period,
    });
    assertSqlBindArity(emptyPlan.count);
    assertSqlBindArity(emptyPlan.list);
    const countRes = await client.query<{ count: string }>(
      emptyPlan.count.sql,
      emptyPlan.count.values,
    );
    const listRes = await client.query(emptyPlan.list.sql, emptyPlan.list.values);
    const total = Number(countRes.rows[0]?.count ?? 0);
    console.log(`   total=${total} pageItems=${listRes.rows.length}`);
    assert.ok(total >= 0);

    type Row = {
      id: string;
      partner_id: string;
      first_name: string;
      last_name: string;
      uetds_subscription_enrolled_at: Date | null;
      uetds_subscription_monthly_fee: string | null;
      uetds_subscription_currency: string | null;
      current_period_status: string | null;
    };

    const rows = listRes.rows as Row[];
    const summaries = rows.map((row) => ({
      id: row.id,
      partnerId: row.partner_id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      summary: mapUetdsSubscriptionListSummary({
        enrolledAt: row.uetds_subscription_enrolled_at,
        monthlyFee: row.uetds_subscription_monthly_fee,
        currency: row.uetds_subscription_currency,
        currentPeriodStatus: row.current_period_status,
      }),
    }));

    let enrolled = summaries.find((item) => item.summary.enrolled);
    const unenrolled = summaries.find((item) => !item.summary.enrolled);

    let tempEnrolledId: string | null = null;
    let tempPartnerId: string | null = null;
    let opsUserId: string | null = null;

    console.log("B) enrolled subscription fields…");
    if (enrolled) {
      console.log(
        `   ${enrolled.name}: fee=${enrolled.summary.monthlyFee} currency=${enrolled.summary.currency} status=${enrolled.summary.currentPeriodStatus}`,
      );
      assert.ok(enrolled.summary.monthlyFee != null);
      assert.ok(enrolled.summary.currency);
      assert.ok(enrolled.summary.currentPeriodStatus);
    } else {
      const candidate = summaries[0];
      assert.ok(candidate, "DEV needs at least one driver");
      const ops = await client.query<{ id: string }>(
        `SELECT id FROM ops_users WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
      );
      opsUserId = ops.rows[0]?.id ?? null;
      assert.ok(opsUserId, "need ops user");
      await client.query(
        `UPDATE partner_drivers
            SET uetds_subscription_enrolled_at = NOW(),
                uetds_subscription_monthly_fee = 9,
                uetds_subscription_currency = 'USD',
                last_edited_by_ops_user_id = $2
          WHERE id = $1`,
        [candidate.id, opsUserId],
      );
      tempEnrolledId = candidate.id;
      tempPartnerId = candidate.partnerId;
      const rereadPlan = buildOpsDriverListQueryPlan({
        query: "",
        dir: "asc",
        page: 1,
        pageSize: 100,
        period,
      });
      const reread = await client.query(rereadPlan.list.sql, rereadPlan.list.values);
      const found = (reread.rows as Row[]).find((row) => row.id === candidate.id);
      assert.ok(found?.uetds_subscription_enrolled_at);
      assert.equal(Number(found?.uetds_subscription_monthly_fee), 9);
      assert.equal(found?.uetds_subscription_currency, "USD");
      enrolled = {
        id: candidate.id,
        partnerId: candidate.partnerId,
        name: candidate.name,
        summary: mapUetdsSubscriptionListSummary({
          enrolledAt: found!.uetds_subscription_enrolled_at,
          monthlyFee: found!.uetds_subscription_monthly_fee,
          currency: found!.uetds_subscription_currency,
          currentPeriodStatus: found!.current_period_status,
        }),
      };
      console.log(
        `   temp enrolled ${enrolled.name}: fee=${enrolled.summary.monthlyFee} ${enrolled.summary.currency} status=${enrolled.summary.currentPeriodStatus ?? "unpaid"}`,
      );
    }

    console.log("C) unenrolled legacy display…");
    const unenrolledCheck =
      unenrolled && unenrolled.id !== tempEnrolledId
        ? unenrolled
        : summaries.find((item) => !item.summary.enrolled && item.id !== tempEnrolledId);
    if (unenrolledCheck) {
      assert.equal(unenrolledCheck.summary.enrolled, false);
      assert.equal(unenrolledCheck.summary.monthlyFee, null);
      assert.equal(unenrolledCheck.summary.currency, null);
      assert.equal(unenrolledCheck.summary.currentPeriodStatus, null);
      const still = await client.query<{ enrolled_at: Date | null }>(
        `SELECT uetds_subscription_enrolled_at AS enrolled_at
           FROM partner_drivers WHERE id = $1`,
        [unenrolledCheck.id],
      );
      assert.equal(still.rows[0]?.enrolled_at, null);
      console.log(`   ${unenrolledCheck.name}: — / — / — (not enrolled)`);
    } else {
      console.log("   (no separate unenrolled driver on page — skipped)");
    }

    console.log("D) listPartnerDrivers…");
    const partnerId = enrolled!.partnerId;
    const partnerPlan = buildPartnerDriverListQueryPlan({ partnerId, period });
    assertSqlBindArity(partnerPlan);
    // Use real fleet SQL shape via parameterized query matching production list
    const partnerSql = `SELECT d.id, d.first_name, d.last_name,
            d.uetds_subscription_enrolled_at,
            d.uetds_subscription_monthly_fee,
            d.uetds_subscription_currency,
            per.status AS current_period_status
       FROM partner_drivers d
       LEFT JOIN partner_driver_uetds_subscription_periods per
         ON per.driver_id = d.id
        AND per.period_year = $2
        AND per.period_month = $3
      WHERE d.partner_id = $1
        AND d.deleted_at IS NULL
      ORDER BY d.last_name ASC, d.first_name ASC`;
    const partnerRows = await client.query(partnerSql, [
      partnerId,
      period.year,
      period.month,
    ]);
    console.log(`   partner=${partnerId} drivers=${partnerRows.rowCount}`);
    assert.ok((partnerRows.rowCount ?? 0) >= 1);

    console.log("E) inline fee/status mutation + restore…");
    const targetId = enrolled!.id;
    if (!opsUserId) {
      const ops = await client.query<{ id: string }>(
        `SELECT id FROM ops_users WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
      );
      opsUserId = ops.rows[0]?.id ?? null;
    }
    assert.ok(opsUserId);

    const beforeFee = await client.query<{ fee: string | null; currency: string | null }>(
      `SELECT uetds_subscription_monthly_fee AS fee, uetds_subscription_currency AS currency
         FROM partner_drivers WHERE id = $1`,
      [targetId],
    );
    const originalFee = beforeFee.rows[0]?.fee;
    const originalCurrency = beforeFee.rows[0]?.currency;
    const beforePeriod = await client.query<{
      status: string | null;
      amount: string | null;
      currency: string | null;
    }>(
      `SELECT status, amount_snapshot::text AS amount, currency_snapshot AS currency
         FROM partner_driver_uetds_subscription_periods
        WHERE driver_id = $1 AND period_year = $2 AND period_month = $3`,
      [targetId, period.year, period.month],
    );
    const originalStatus = beforePeriod.rows[0]?.status ?? null;
    const originalAmount = beforePeriod.rows[0]?.amount ?? null;
    const originalSnapCurrency = beforePeriod.rows[0]?.currency ?? null;

    const tempFee = Number(originalFee) === 7 ? 8 : 7;
    await client.query(
      `UPDATE partner_drivers
          SET uetds_subscription_monthly_fee = $2,
              uetds_subscription_currency = COALESCE(uetds_subscription_currency, 'USD'),
              last_edited_by_ops_user_id = $3
        WHERE id = $1
          AND uetds_subscription_enrolled_at IS NOT NULL`,
      [targetId, tempFee, opsUserId],
    );
    await client.query(
      `INSERT INTO partner_driver_uetds_subscription_periods (
         driver_id, period_year, period_month, status,
         amount_snapshot, currency_snapshot, marked_at, marked_by_ops_user_id
       ) VALUES ($1, $2, $3, 'paid', $4, 'USD', NOW(), $5)
       ON CONFLICT (driver_id, period_year, period_month)
       DO UPDATE SET
         status = EXCLUDED.status,
         amount_snapshot = EXCLUDED.amount_snapshot,
         currency_snapshot = EXCLUDED.currency_snapshot,
         marked_at = NOW(),
         marked_by_ops_user_id = EXCLUDED.marked_by_ops_user_id,
         updated_at = NOW()`,
      [targetId, period.year, period.month, tempFee, opsUserId],
    );
    const after = await client.query<{
      fee: string;
      status: string;
      amount: string;
    }>(
      `SELECT d.uetds_subscription_monthly_fee AS fee,
              per.status,
              per.amount_snapshot::text AS amount
         FROM partner_drivers d
         JOIN partner_driver_uetds_subscription_periods per
           ON per.driver_id = d.id
          AND per.period_year = $2
          AND per.period_month = $3
        WHERE d.id = $1`,
      [targetId, period.year, period.month],
    );
    assert.equal(Number(after.rows[0]?.fee), tempFee);
    assert.equal(after.rows[0]?.status, "paid");
    assert.equal(Number(after.rows[0]?.amount), tempFee);
    console.log(`   fee→${tempFee} + status→paid read-back OK`);

    // Restore fee/currency and period snapshot
    await client.query(
      `UPDATE partner_drivers
          SET uetds_subscription_monthly_fee = $2,
              uetds_subscription_currency = $3
        WHERE id = $1`,
      [targetId, originalFee, originalCurrency],
    );
    if (originalStatus) {
      await client.query(
        `UPDATE partner_driver_uetds_subscription_periods
            SET status = $4,
                amount_snapshot = $5,
                currency_snapshot = $6,
                updated_at = NOW()
          WHERE driver_id = $1
            AND period_year = $2
            AND period_month = $3`,
        [
          targetId,
          period.year,
          period.month,
          originalStatus,
          originalAmount,
          originalSnapCurrency,
        ],
      );
    } else {
      await client.query(
        `DELETE FROM partner_driver_uetds_subscription_periods
          WHERE driver_id = $1 AND period_year = $2 AND period_month = $3`,
        [targetId, period.year, period.month],
      );
    }

    if (tempEnrolledId) {
      await client.query(
        `UPDATE partner_drivers
            SET uetds_subscription_enrolled_at = NULL,
                uetds_subscription_monthly_fee = NULL,
                uetds_subscription_currency = NULL
          WHERE id = $1`,
        [tempEnrolledId],
      );
      await client.query(
        `DELETE FROM partner_driver_uetds_subscription_periods
          WHERE driver_id = $1 AND period_year = $2 AND period_month = $3`,
        [tempEnrolledId, period.year, period.month],
      );
      console.log(`   restored temporary enroll on ${tempEnrolledId} (partner ${tempPartnerId})`);
    } else {
      console.log("   restored original fee/currency + period");
    }

    console.log("SMOKE_OK");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("SMOKE_FAIL", error);
  process.exitCode = 1;
});
