import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { assertDevFlightTrackingRuntime } from "@/lib/ops/flight-tracking-dev-guard";
import { assertProdFlightTrackingRuntime } from "@/lib/ops/flight-tracking-prod-guard";
import {
  attachExactTimeNear,
  candidateScheduledMs,
  dhmiAirportPathId,
  delayMinutes,
  flightNumberKey,
  flightPollIntervalMs,
  flightStatusBadge,
  flightTrackingTone,
  isDhmiLandedStatus,
  matchDhmiFlight,
  resolvedActualArrivalMs,
  shouldPollFlight,
  shouldTrackAirportPickupFlight,
  snapshotIso,
  type DhmiFlightCandidate,
} from "@/lib/ops/flight-tracking";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

function flight(partial: Partial<DhmiFlightCandidate> & Pick<DhmiFlightCandidate, "number">): DhmiFlightCandidate {
  return {
    date: "17.09.2026",
    planned: "05:00",
    estimated: "05:00",
    status: "-",
    ...partial,
  };
}

test("1. airport pickup + flight code + on-time uses estimated clock in green", () => {
  assert.equal(shouldTrackAirportPickupFlight({
    airportCode: "IST",
    locationType: "airport",
    flightCode: "TK 1453",
    status: "confirmed",
  }), true);
  const badge = flightStatusBadge({
    trackable: true,
    snapshot: {
      scheduledArrival: snapshotIso(istanbulLocalToUtcMs("2026-09-17T05:00")),
      estimatedArrival: snapshotIso(istanbulLocalToUtcMs("2026-09-17T05:00")),
      actualArrival: null,
      statusText: "ZAMANINDA - ON TIME",
      statusId: 15,
      source: "dhmi",
      lastCheckedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    },
  });
  assert.equal(badge?.label, "Tahmini 05:00");
  assert.equal(badge?.tone, "green");
});

test("2. airport pickup + 30 min delay is orange", () => {
  const scheduled = istanbulLocalToUtcMs("2026-09-17T05:00");
  const estimated = istanbulLocalToUtcMs("2026-09-17T05:30");
  assert.equal(delayMinutes(scheduled, estimated), 30);
  assert.equal(
    flightTrackingTone({
      scheduledMs: scheduled,
      estimatedMs: estimated,
      actualMs: null,
      landed: false,
    }),
    "orange",
  );
  const badge = flightStatusBadge({
    trackable: true,
    snapshot: {
      scheduledArrival: snapshotIso(scheduled),
      estimatedArrival: snapshotIso(estimated),
      actualArrival: null,
      statusText: "30 dk GECİKME-30 min. DELAYED",
      statusId: -1,
      source: "dhmi",
      lastCheckedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    },
  });
  assert.equal(badge?.label, "Tahmini 05:30");
  assert.equal(badge?.tone, "orange");
});

test("3. airport pickup + 60+ min delay is red", () => {
  const scheduled = istanbulLocalToUtcMs("2026-09-17T05:00");
  const estimated = istanbulLocalToUtcMs("2026-09-17T06:15");
  assert.equal(
    flightTrackingTone({
      scheduledMs: scheduled,
      estimatedMs: estimated,
      actualMs: null,
      landed: false,
    }),
    "red",
  );
});

test("4. early arrival is green estimated, not İndi", () => {
  const scheduled = istanbulLocalToUtcMs("2026-09-17T05:00");
  const estimated = istanbulLocalToUtcMs("2026-09-17T04:40");
  const badge = flightStatusBadge({
    trackable: true,
    snapshot: {
      scheduledArrival: snapshotIso(scheduled),
      estimatedArrival: snapshotIso(estimated),
      actualArrival: null,
      statusText: "ERKEN GELİŞ-EARLY",
      statusId: -1,
      source: "dhmi",
      lastCheckedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    },
  });
  assert.equal(badge?.label, "Tahmini 04:40");
  assert.equal(badge?.tone, "green");
  assert.doesNotMatch(badge?.label ?? "", /İndi/);
});

test("5. landed uses exactTime, never estimated, as İndi HH:mm", () => {
  const matched = flight({
    number: "UA9062",
    date: "16.09.2026",
    planned: "21:15",
    estimated: "21:18",
    exactTime: "2114",
    status: "İNDİ - LANDED",
    statusId: 17,
    scheduledDateTime: "16.09.2026 21:15:00",
    estimatedDateTime: "16.09.2026 21:18:00",
  });
  const actualMs = resolvedActualArrivalMs(matched);
  const estimatedMs = istanbulLocalToUtcMs("2026-09-16T21:18");
  assert.ok(actualMs);
  assert.notEqual(actualMs, estimatedMs);
  const badge = flightStatusBadge({
    trackable: true,
    snapshot: {
      scheduledArrival: snapshotIso(istanbulLocalToUtcMs("2026-09-16T21:15")),
      estimatedArrival: snapshotIso(estimatedMs),
      actualArrival: snapshotIso(actualMs),
      statusText: "İNDİ - LANDED",
      statusId: 17,
      source: "dhmi",
      lastCheckedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    },
  });
  assert.equal(badge?.label, "İndi 21:14");
  assert.equal(badge?.tone, "green");
});

test("midnight wrap attaches exactTime 23:54 to previous calendar day", () => {
  const around = istanbulLocalToUtcMs("2026-09-17T00:10");
  const actual = attachExactTimeNear("2354", around);
  assert.equal(actual, istanbulLocalToUtcMs("2026-09-16T23:54"));
});

test("6. DHMİ outage keeps gray fallback and does not invent actual", () => {
  const badge = flightStatusBadge({
    trackable: true,
    snapshot: {
      scheduledArrival: null,
      estimatedArrival: null,
      actualArrival: null,
      statusText: null,
      statusId: null,
      source: "dhmi",
      lastCheckedAt: new Date().toISOString(),
      lastSuccessAt: null,
      lastError: "timeout",
    },
  });
  assert.equal(badge?.label, "Uçuş verisi alınamadı");
  assert.equal(badge?.tone, "gray");
  assert.equal(resolvedActualArrivalMs(flight({
    number: "TK1",
    estimated: "05:35",
    exactTime: "",
    status: "-",
  })), null);
});

test("7. unexpected format does not yield actual arrival", () => {
  assert.equal(resolvedActualArrivalMs(flight({
    number: "TK1",
    exactTime: "soon",
    status: "İNDİ - LANDED",
    statusId: 17,
  })), null);
  assert.equal(resolvedActualArrivalMs(flight({
    number: "TK1",
    exactTime: "99:99",
    status: "İNDİ - LANDED",
    statusId: 17,
  })), null);
});

test("8. missing flight code is not tracked and shows em dash", () => {
  assert.equal(shouldTrackAirportPickupFlight({
    airportCode: "IST",
    locationType: "airport",
    flightCode: "  ",
    status: "confirmed",
  }), false);
  assert.equal(flightStatusBadge({ trackable: false, snapshot: null })?.label, "—");
});

test("9. non-airport pickup is not tracked even with a flight code", () => {
  assert.equal(shouldTrackAirportPickupFlight({
    airportCode: null,
    locationType: "place",
    flightCode: "TK112",
    status: "confirmed",
  }), false);
});

test("10. airport dropoff-only is not tracked", () => {
  assert.equal(shouldTrackAirportPickupFlight({
    airportCode: null,
    locationType: "place",
    placeId: null,
    flightCode: "TK999",
    status: "confirmed",
  }), false);
});

test("cancelled and completed reservations stop polling", () => {
  const now = istanbulLocalToUtcMs("2026-09-17T04:30");
  const scheduled = istanbulLocalToUtcMs("2026-09-17T05:00");
  assert.equal(flightPollIntervalMs({
    nowMs: now,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
    cancelled: true,
  }), null);
  assert.equal(flightPollIntervalMs({
    nowMs: now,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
    completed: true,
  }), null);
  assert.equal(shouldTrackAirportPickupFlight({
    airportCode: "AYT",
    locationType: "airport",
    flightCode: "XQ143",
    status: "cancelled",
  }), false);
  assert.equal(shouldTrackAirportPickupFlight({
    airportCode: "AYT",
    locationType: "airport",
    flightCode: "XQ143",
    status: "confirmed",
    driverTaskStage: "completed",
  }), false);
});

test("polling cadence: skip >4h, 60min 4h-2h, 30min 2h-1h, 10min last hour and past due", () => {
  const scheduled = istanbulLocalToUtcMs("2026-09-17T20:00");
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (4 * 60 * 60 * 1000) - 1,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), null);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (4 * 60 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), 60 * 60 * 1000);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (3 * 60 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), 60 * 60 * 1000);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (2 * 60 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), 30 * 60 * 1000);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (90 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), 30 * 60 * 1000);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (60 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), 10 * 60 * 1000);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled - (20 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
  }), 10 * 60 * 1000);
  const delayedEta = istanbulLocalToUtcMs("2026-09-17T21:15");
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled + (10 * 60 * 1000),
    scheduledMs: scheduled,
    estimatedMs: delayedEta,
    actualMs: null,
  }), 10 * 60 * 1000);
  assert.equal(flightPollIntervalMs({
    nowMs: scheduled,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: scheduled,
  }), null);
});

test("estimated delay does not relax cadence back to 30/60 minutes", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-17T20:00");
  const delayedEta = istanbulLocalToUtcMs("2026-09-17T21:15");
  assert.equal(flightPollIntervalMs({
    nowMs: pickup - (50 * 60 * 1000),
    scheduledMs: pickup,
    estimatedMs: delayedEta,
    actualMs: null,
  }), 10 * 60 * 1000);
  assert.equal(shouldPollFlight({
    nowMs: pickup - (50 * 60 * 1000),
    scheduledMs: pickup,
    estimatedMs: delayedEta,
    actualMs: null,
    lastCheckedMs: pickup - (61 * 60 * 1000),
  }), true);
  assert.equal(flightPollIntervalMs({
    nowMs: pickup - (3 * 60 * 60 * 1000),
    scheduledMs: pickup,
    estimatedMs: delayedEta,
    actualMs: null,
  }), 60 * 60 * 1000);
});

test("shouldPollFlight respects last checked vs interval", () => {
  const scheduled = istanbulLocalToUtcMs("2026-09-17T05:00");
  const now = scheduled - (20 * 60 * 1000);
  assert.equal(shouldPollFlight({
    nowMs: now,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
    lastCheckedMs: null,
  }), true);
  assert.equal(shouldPollFlight({
    nowMs: now,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
    lastCheckedMs: now - (2 * 60 * 1000),
  }), false);
  assert.equal(shouldPollFlight({
    nowMs: now,
    scheduledMs: scheduled,
    estimatedMs: scheduled,
    actualMs: null,
    lastCheckedMs: now - (11 * 60 * 1000),
  }), true);
});

test("match uses flight number + date/time and ignores codeshare siblings", () => {
  const pickup = istanbulLocalToUtcMs("2026-09-17T00:40");
  const rows = [
    flight({
      number: "JU8127",
      date: "17.09.2026",
      planned: "00:40",
      estimated: "00:21",
    }),
    flight({
      number: "TK2525",
      date: "17.09.2026",
      planned: "00:40",
      estimated: "00:21",
    }),
    flight({
      number: "TK2525",
      date: "16.09.2026",
      planned: "00:40",
      estimated: "00:40",
    }),
  ];
  const matched = matchDhmiFlight(rows, "tk 2525", pickup);
  assert.equal(matched?.number, "TK2525");
  assert.equal(matched?.date, "17.09.2026");
  assert.equal(flightNumberKey("TK0045"), flightNumberKey("TK45"));
});

test("single-digit DHMİ airport ids are zero-padded for Uçuş İzle", () => {
  assert.equal(dhmiAirportPathId(4), "04");
  assert.equal(dhmiAirportPathId(57), "57");
  assert.equal(dhmiAirportPathId(999), "999");
});

test("16. tracking snapshot never copies reservation datetime into actual", () => {
  const reservation = istanbulLocalToUtcMs("2026-09-17T05:00");
  const estimated = istanbulLocalToUtcMs("2026-09-17T05:35");
  const actual = resolvedActualArrivalMs(flight({
    number: "SU2132",
    date: "17.09.2026",
    planned: "05:00",
    estimated: "05:35",
    exactTime: "",
    status: "BEKLENEN - EN ROUTE",
  }));
  assert.equal(actual, null);
  assert.notEqual(snapshotIso(estimated), snapshotIso(reservation) && actual);
  assert.equal(isDhmiLandedStatus("BEKLENEN - EN ROUTE", 16), false);
  assert.ok(candidateScheduledMs(flight({
    number: "SU2132",
    scheduledDateTime: "17.09.2026 05:00:00",
  })));
});

test("DEV flight tracking runtime guard rejects production and non-dev databases", () => {
  assert.throws(
    () =>
      assertDevFlightTrackingRuntime({
        NODE_ENV: "production",
        EXPECTED_DATABASE: "tripetica_dev",
        DATABASE_URL: "postgresql://localhost/tripetica_dev",
      }),
    /DEV-only/,
  );
  assert.throws(
    () =>
      assertDevFlightTrackingRuntime({
        NODE_ENV: "development",
        EXPECTED_DATABASE: "tripetica",
        DATABASE_URL: "postgresql://localhost/tripetica",
      }),
    /tripetica_dev/,
  );
  assert.doesNotThrow(() =>
    assertDevFlightTrackingRuntime({
      NODE_ENV: "development",
      EXPECTED_DATABASE: "tripetica_dev",
      DATABASE_URL: "postgresql://localhost/tripetica_dev",
    }),
  );
});

test("batch poller uses pickup_at cadence window and overlap lock, keeps request-triggered path", () => {
  const poller = readFileSync(new URL("./flight-tracking-poll.ts", import.meta.url), "utf8");
  const scheduler = readFileSync(new URL("./flight-tracking-schedule.ts", import.meta.url), "utf8");
  const reservations = readFileSync(new URL("./reservations.ts", import.meta.url), "utf8");
  const driverTask = readFileSync(new URL("./driver-task.ts", import.meta.url), "utf8");
  const script = readFileSync(
    new URL("../../scripts/poll-flight-tracking.ts", import.meta.url),
    "utf8",
  );
  assert.match(poller, /INTERVAL '4 hours'/);
  assert.doesNotMatch(poller, /INTERVAL '3 hours'/);
  assert.match(poller, /scheduledMs: msOf\(row\.pickup_at\)/);
  assert.match(poller, /pg_try_advisory_lock/);
  assert.match(poller, /activeSql/);
  assert.match(poller, /actual_arrival IS NULL/);
  assert.match(poller, /COALESCE\(\$4, actual_arrival\)/);
  assert.match(script, /assertDevFlightTrackingRuntime/);
  assert.match(script, /PG_POOL_MAX/);
  assert.match(scheduler, /after\(/);
  assert.match(reservations, /scheduleFlightTrackingCheck\(id\)/);
  assert.match(driverTask, /scheduleFlightTrackingCheck\(row\.reservation_id\)/);
});

test("DEV systemd flight-track units are oneshot, 5-minute, and isolated from production", () => {
  const service = readFileSync(
    new URL("../../deploy/systemd/tripetica-dev-flight-track.service", import.meta.url),
    "utf8",
  );
  const timer = readFileSync(
    new URL("../../deploy/systemd/tripetica-dev-flight-track.timer", import.meta.url),
    "utf8",
  );
  assert.match(service, /Type=oneshot/);
  assert.match(service, /User=tripetica-dev/);
  assert.match(service, /NODE_ENV=development/);
  assert.match(service, /EXPECTED_DATABASE=tripetica_dev/);
  assert.match(service, /PG_POOL_MAX=2/);
  assert.match(service, /flight-track:poll/);
  assert.match(service, /\/usr\/bin\/flock -n \/var\/lib\/tripetica-dev\/flight-track-poll.lock/);
  assert.match(service, /InaccessiblePaths=\/srv\/tripetica/);
  assert.match(service, /WorkingDirectory=\/var\/lib\/tripetica-dev\/app/);
  assert.doesNotMatch(service, /NODE_ENV=production/);
  assert.doesNotMatch(service, /EXPECTED_DATABASE=tripetica[^\n_]/);
  assert.match(timer, /OnUnitActiveSec=5min/);
  assert.match(timer, /Persistent=true/);
  assert.match(timer, /WantedBy=timers\.target/);
  assert.match(timer, /Unit=tripetica-dev-flight-track\.service/);
  assert.equal(
    existsSync(new URL("../../deploy/systemd/tripetica-flight-track.service", import.meta.url)),
    false,
  );
  assert.equal(
    existsSync(new URL("../../deploy/systemd/tripetica-flight-track.timer", import.meta.url)),
    false,
  );
});

test("production flight tracking runtime guard accepts only tripetica production", () => {
  assert.throws(
    () =>
      assertProdFlightTrackingRuntime({
        NODE_ENV: "development",
        EXPECTED_DATABASE: "tripetica",
        DATABASE_URL: "postgresql://localhost/tripetica",
      }),
    /NODE_ENV=production/,
  );
  assert.throws(
    () =>
      assertProdFlightTrackingRuntime({
        NODE_ENV: "production",
        EXPECTED_DATABASE: "tripetica_dev",
        DATABASE_URL: "postgresql://localhost/tripetica_dev",
      }),
    /EXPECTED_DATABASE=tripetica/,
  );
  assert.doesNotThrow(() =>
    assertProdFlightTrackingRuntime({
      NODE_ENV: "production",
      EXPECTED_DATABASE: "tripetica",
      DATABASE_URL: "postgresql://localhost/tripetica",
    }),
  );
  const prodScript = readFileSync(
    new URL("../../scripts/poll-flight-tracking-prod.ts", import.meta.url),
    "utf8",
  );
  const prodUnit = readFileSync(
    new URL("../../deploy/systemd/tripetica-prod-flight-track.service", import.meta.url),
    "utf8",
  );
  const prodTimer = readFileSync(
    new URL("../../deploy/systemd/tripetica-prod-flight-track.timer", import.meta.url),
    "utf8",
  );
  assert.match(prodScript, /assertProdFlightTrackingRuntime/);
  assert.doesNotMatch(prodScript, /assertDevFlightTrackingRuntime/);
  assert.doesNotMatch(prodScript, /tripetica_dev/);
  assert.doesNotMatch(prodScript, /loadDevelopmentEnv/);
  assert.match(prodUnit, /EXPECTED_DATABASE=tripetica/);
  assert.match(prodUnit, /NODE_ENV=production/);
  assert.match(prodUnit, /WorkingDirectory=\/srv\/tripetica\/current/);
  assert.match(prodUnit, /assert-expected-database/);
  assert.match(prodUnit, /flight-track:poll:prod/);
  assert.match(prodUnit, /User=tripetica-worker/);
  assert.match(prodUnit, /PG_POOL_MAX=2/);
  assert.match(prodUnit, /\/usr\/bin\/flock -n \/var\/lib\/tripetica-worker\/flight-track-poll.lock/);
  assert.match(prodUnit, /InaccessiblePaths=\/root\/tripetica-web/);
  assert.doesNotMatch(prodUnit, /tripetica-dev-flight-track/);
  assert.doesNotMatch(prodUnit, /EXPECTED_DATABASE=tripetica_dev/);
  assert.doesNotMatch(prodUnit, /\/var\/lib\/tripetica-dev\/flight-track-poll.lock/);
  assert.match(prodTimer, /OnUnitActiveSec=5min/);
  assert.match(prodTimer, /Persistent=true/);
  assert.match(prodTimer, /Unit=tripetica-prod-flight-track\.service/);
});
