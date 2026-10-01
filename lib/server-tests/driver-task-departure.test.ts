import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { advanceDriverTaskByToken } from "../ops/driver-task";
import { isDriverTaskDepartureBlocked, type DriverTaskStage } from "../ops/driver-task-stages";

const now = Date.parse("2026-09-28T09:00:00Z"); // Istanbul 12:00, pickup 18:00 at the boundary.

test("public departure boundary uses server time and rejects early direct actions without writes", async (t) => {
  t.mock.method(Date, "now", () => now);
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const previous = globals.tripeticaPgPool;
  try {
    for (const [label, offset, blocked] of [
      ["10 days", 10 * 24 * 60, true], ["6h1m", 361, true],
      ["exactly 6h", 360, false], ["5h59m", 359, false], ["past", -1, false],
    ] as const) {
      await t.test(label, async () => {
        const statements: string[] = [];
        const row = {
          current_stage: "planned", pickup_at: new Date(now + offset * 60_000),
          status: "confirmed", reservation_id: "fixture", access_token: "fixture-token",
          assigned_driver_kind: "registered", assigned_driver_id: "fixture-driver",
        };
        globals.tripeticaPgPool = { connect: async () => ({
          query: async (sql: string) => {
            statements.push(sql);
            return { rows: /SELECT|UPDATE reservation_driver_tasks/.test(sql) ? [row] : [] };
          }, release() {},
        }) };
        assert.equal(isDriverTaskDepartureBlocked("planned", row.pickup_at), blocked);
        const result = await advanceDriverTaskByToken("fixture-token", "en_route");
        assert.deepEqual(result, blocked ? { ok: false, reason: "too-early" } : { ok: true, stage: "en_route" });
        assert.equal(statements.some(sql => /^\s*(UPDATE|INSERT)\s/.test(sql)), !blocked);
        assert.ok(statements.some(sql => sql.includes("r.pickup_at")));
        assert.equal(statements.at(-1), blocked ? "ROLLBACK" : "COMMIT");
      });
    }
    for (const [stage, requested] of [["en_route", "arrived"], ["arrived", "picked_up"], ["picked_up", "completed"]] as const) {
      await t.test(`${stage} -> ${requested} is not time-gated`, async () => {
        const row = { current_stage: stage, pickup_at: new Date(now + 10 * 86400_000), status: "confirmed", reservation_id: "fixture" };
        globals.tripeticaPgPool = { connect: async () => ({
          query: async (sql: string) => ({ rows: /SELECT|UPDATE reservation_driver_tasks/.test(sql) ? [row] : [] }), release() {},
        }) };
        assert.equal(isDriverTaskDepartureBlocked(stage, row.pickup_at), false);
        assert.deepEqual(await advanceDriverTaskByToken("fixture-token", requested), { ok: true, stage: requested });
      });
    }
  } finally { globals.tripeticaPgPool = previous; }
});

test("missing/invalid canonical pickup cannot unlock planned departure; other stages stay unchanged", () => {
  for (const pickup of [null, new Date(NaN)]) {
    assert.equal(isDriverTaskDepartureBlocked("planned", pickup, now), true);
    for (const stage of ["en_route", "arrived", "picked_up", "completed"] as DriverTaskStage[]) {
      assert.equal(isDriverTaskDepartureBlocked(stage, pickup, now), false);
    }
  }
});

test("public UI consumes server gate and existing polling; public action delegates to guarded transition", () => {
  const source = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const ui = source("components/driver-task/driver-task-screen.tsx");
  assert.match(ui, /disabled=\{pending \|\| view.departureBlocked\}/);
  assert.match(ui, /view.departureBlocked \? <p[^>]*>\{DRIVER_TASK_DEPARTURE_HINT\}/);
  assert.match(ui, /refreshDriverTaskPublicAction\(token\)/);
  assert.match(source("lib/ops/driver-task.ts"), /departureBlocked: isDriverTaskDepartureBlocked\(row.current_stage, row.pickup_at\)/);
  assert.match(source("lib/ops/driver-task-actions.ts"), /return advanceDriverTaskByToken\(token, requestedStage\)/);
});
