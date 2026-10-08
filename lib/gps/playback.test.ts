import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsPlaybackClock } from "@/lib/gps/format";
import {
  GPS_PLAYBACK_GAP_MS,
  advancePlaybackCursor,
  nextPlaybackAt,
  playbackFixes,
  playbackFrame,
  playbackGapLimit,
  playbackGapMinutes,
  playbackShownSample,
  playbackSegments,
  previousPlaybackAt,
  type GpsPlaybackFix,
} from "@/lib/gps/playback";

const base = Date.parse("2026-10-06T06:00:00.000Z");

function fix(offsetMs: number, latitude: number, longitude: number, speedMps: number | null, headingDeg: number | null = 90): GpsPlaybackFix {
  return { at: base + offsetMs, latitude, longitude, speedMps, headingDeg };
}

test("playback clock uses Istanbul time", () => {
  assert.deepEqual(gpsPlaybackClock(Date.parse("2026-10-06T06:23:17.000Z")), {
    date: "06.10.2026",
    time: "09:23:17",
  });
  assert.deepEqual(gpsPlaybackClock(Date.parse("2026-10-06T20:59:55.000Z")), {
    date: "06.10.2026",
    time: "23:59:55",
  });
  assert.deepEqual(gpsPlaybackClock(Date.parse("2026-10-06T21:00:10.000Z")), {
    date: "07.10.2026",
    time: "00:00:10",
  });
});

test("marker coordinates follow the interpolated position and speed stays measured", () => {
  const fixes = [
    fix(0, 41.245, 28.73, 0, 125),
    fix(5_000, 41.246, 28.731, 12, 140),
  ];
  const middle = playbackFrame(fixes, base + 2_500);
  assert.equal(middle.latitude, 41.2455);
  assert.equal(middle.longitude, 28.7305);
  assert.equal(middle.speedMps, 0);
  assert.equal(middle.headingDeg, 125);
  assert.equal(middle.gapMs, null);
  const arrived = playbackFrame(fixes, base + 5_000);
  assert.equal(arrived.speedMps, 12);
  assert.equal(arrived.headingDeg, 140);
  assert.equal(arrived.latitude, 41.246);
});

test("playback speed follows recorded timestamps and the selected rate", () => {
  assert.equal(advancePlaybackCursor(base, 5_000, 1, base + 60_000), base + 5_000);
  assert.equal(advancePlaybackCursor(base, 2_500, 2, base + 60_000), base + 5_000);
  assert.equal(advancePlaybackCursor(base, 1_000, 5, base + 60_000), base + 5_000);
  assert.equal(advancePlaybackCursor(base, 500, 10, base + 60_000), base + 5_000);
  assert.equal(advancePlaybackCursor(base + 59_000, 5_000, 10, base + 60_000), base + 60_000);
});

test("timeline seek and point steps land on the real record", () => {
  const fixes = [fix(0, 41, 29, 3, 10), fix(10_000, 41.01, 29.01, 8, 20), fix(20_000, 41.02, 29.02, 1, null)];
  const sought = playbackFrame(fixes, base + 10_000);
  assert.equal(sought.latitude, 41.01);
  assert.equal(sought.speedMps, 8);
  assert.equal(sought.headingDeg, 20);
  assert.equal(nextPlaybackAt(fixes, base), base + 10_000);
  assert.equal(previousPlaybackAt(fixes, base + 10_000), base);
  assert.equal(nextPlaybackAt(fixes, base + 4_000), base + 10_000);
  assert.equal(previousPlaybackAt(fixes, base + 4_000), base);
  assert.equal(previousPlaybackAt(fixes, base), null);
  assert.equal(nextPlaybackAt(fixes, base + 20_000), null);
  assert.equal(playbackFrame(fixes, base + 20_000).headingDeg, null);
  const after = playbackFrame([fix(0, 41.2, 29.2, 4, 15)], base + 6 * 60_000);
  assert.equal(after.latitude, 41.2);
  assert.equal(after.longitude, 29.2);
  assert.equal(after.speedMps, 4);
  assert.equal(after.gapMs, 6 * 60_000);
  const before = playbackFrame([fix(6 * 60_000, 41.2, 29.2, 4, 15)], base);
  assert.equal(before.latitude, null);
  assert.equal(before.gapMs, 6 * 60_000);
});

test("a long gps gap does not invent a path or a speed", () => {
  assert.equal(GPS_PLAYBACK_GAP_MS, 120_000);
  const fixes = [fix(0, 41.245, 28.73, 4, 80), fix(6 * 60_000, 41.3, 28.8, 9, 10)];
  const during = playbackFrame(fixes, base + 3 * 60_000);
  assert.equal(during.latitude, 41.245);
  assert.equal(during.longitude, 28.73);
  assert.equal(during.speedMps, 4);
  assert.equal(during.headingDeg, 80);
  assert.equal(during.gapMs, 6 * 60_000);
  assert.equal(playbackGapMinutes(during.gapMs), 6);
  assert.deepEqual(playbackSegments(fixes).map((segment) => segment.length), [1, 1]);
  const dense = [fix(0, 41, 29, 1), fix(5_000, 41.001, 29.001, 1), fix(10_000, 41.002, 29.002, 1)];
  assert.equal(playbackSegments(dense).length, 1);
  const sampled = Array.from({ length: 12 }, (_, index) => fix(index * 110_000, 41 + index * 0.001, 29, 5));
  const sampledLimit = playbackGapLimit(sampled);
  assert.ok(sampledLimit > 110_000);
  assert.equal(playbackSegments(sampled, sampledLimit).length, 1);
  const hole = sampled.slice(0, 8);
  hole.push(fix(7 * 110_000 + 6 * 60_000, 41.02, 29.02, 5));
  const holeLimit = playbackGapLimit(hole);
  assert.equal(playbackSegments(hole, holeLimit).length, 2);
  assert.equal(playbackFrame(hole, base + 7 * 110_000 + 3 * 60_000, holeLimit).latitude, hole[7].latitude);
});

test("history readout shows the first fix before the cursor reaches it", () => {
  const first = fix(16_000, 41.195828, 28.867586, 0, 90);
  const later = fix(60_000, 41.2, 28.87, 12, 100);
  const shown = playbackShownSample([first, later], base);
  assert.equal(playbackFrame([first, later], base).latitude, null);
  assert.equal(shown.at, first.at);
  assert.equal(shown.latitude, 41.195828);
  assert.equal(shown.longitude, 28.867586);
  assert.equal(shown.speedMps, 0);
  const moving = playbackShownSample([first, later], base + 16_000);
  assert.equal(moving.at, base + 16_000);
  assert.equal(moving.latitude, 41.195828);
  assert.equal(moving.speedMps, 0);
  const waiting = fix(6 * 60_000, 41.195828, 28.867586, 0, 90);
  const gap = playbackShownSample([waiting], base);
  assert.equal(gap.at, waiting.at);
  assert.equal(gap.latitude, 41.195828);
  assert.equal(gap.speedMps, 0);
  assert.equal(gap.gapMs, 6 * 60_000);
  assert.deepEqual(playbackShownSample([], base), playbackFrame([], base));
});

test("empty history and invalid points produce no frame", () => {
  assert.deepEqual(playbackFrame([], base), {
    at: base,
    latitude: null,
    longitude: null,
    speedMps: null,
    headingDeg: null,
    gapMs: null,
  });
  assert.deepEqual(playbackSegments([]), []);
  assert.deepEqual(playbackFixes([{
    recordedAt: "not-a-time",
    latitude: 41,
    longitude: 29,
    speedMps: 1,
    headingDeg: 1,
  }]), []);
});

test("history playback stays on the selected device and off the live poll", () => {
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  const history = readFileSync(new URL("../../components/gps/history-playback.tsx", import.meta.url), "utf8");
  const section = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const playback = readFileSync(new URL("./playback.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(workspace, /key=\{`\$\{device\.id\}:\$\{fromIso\}:\$\{toIso\}`\}/);
  assert.match(workspace, /deviceId=\{device\.id\}/);
  assert.match(history, /cancelAnimationFrame/);
  assert.match(history, /interactive: false/);
  assert.match(history, /gps-playback-vehicle/);
  assert.match(history, /\$\{readout\.date\} \$\{readout\.time\}/);
  assert.match(history, /playbackShownSample/);
  assert.doesNotMatch(history, /gps-playback-date/);
  assert.doesNotMatch(history, /gps-playback-scale/);
  assert.match(workspace, /className="gps-range"/);
  assert.match(workspace, /className="gps-range-fields"/);
  assert.match(workspace, /className="gps-range-submit"/);
  assert.match(workspace, /className="gps-range-chevron" aria-hidden="true"/);
  assert.match(css, /\.gps-range-fields \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /\.gps-range-chevron \{\n  display: none;\n\}/);
  assert.match(css, /@media \(max-width: 480px\) \{\n  \.gps-range-picker \{[\s\S]*?\.gps-range-chevron \{[^}]*pointer-events: none;/);
  assert.match(css, /padding-inline-end: 1\.15rem;\n    font-size: 0\.78rem;/);
  assert.doesNotMatch(css, /\.gps-playback-scale/);
  assert.match(css, /\.gps-status::before \{[^}]*width: 22px;/);
  assert.match(css, /\.gps-status::before \{[^}]*border: 2px solid/);
  assert.doesNotMatch(css, /\.gps-playback-vehicle \.gps-status::before/);
  const icon = readFileSync(new URL("../../components/gps/live-map.tsx", import.meta.url), "utf8");
  assert.match(icon, /iconSize: \[22, 22\]/);
  assert.match(icon, /iconAnchor: \[11, 11\]/);
  assert.doesNotMatch(history, /fetch\(|\/api\/gps\/address|lookupGpsAddress/);
  assert.doesNotMatch(playback, /INSERT|gps_positions|fetch\(/);
  const pull = section.slice(section.indexOf("async function pull"), section.indexOf("function onVisibility"));
  assert.doesNotMatch(pull, /playback|gps\/address|geocode/);
});
