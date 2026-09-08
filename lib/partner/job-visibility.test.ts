import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickupIsAirport } from "@/lib/booking/meet-and-greet";
import {
  EXTERNAL_PARTNER_PAYOUT_RATE,
  partnerPayoutAmount,
} from "@/lib/partner/job-payout";
import {
  filterPartnerJobs,
  partnerJobDurationLabel,
  partnerJobGenderLabel,
  partnerJobNotePreview,
  partnerJobOccupancyCompact,
  partnerJobOccupancyLine,
  partnerJobServiceTypeLabel,
  partnerJobTourName,
  partnerPassengerIdentityDisplay,
  partnerPassengerIdentityFields,
  sortPartnerJobs,
} from "@/lib/partner/job-view";
import {
  MIN_LEVEL_GAP_MS,
  computeJobReleaseTimes,
  effectiveVisibleMaxRank,
  partnerCanSeeOpenJob,
  partnerCanSeePassengerContact,
  partnerJobRank,
} from "@/lib/partner/job-visibility";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const copy = {
  jobPassengerUnit: "Yolcu",
  jobBagUnit: "Valiz",
  jobBabySeatUnit: "Bebek Koltuğu",
};

const MINUTE = 60 * 1000;

function scenario(minutesUntilPickupAtCreate: number) {
  const created = new Date("2026-09-07T10:00:00.000Z");
  const start = new Date(created.getTime() + minutesUntilPickupAtCreate * MINUTE);
  return { created, start, releases: computeJobReleaseTimes(created, start) };
}

function minutesBeforeStart(at: Date, start: Date) {
  return (start.getTime() - at.getTime()) / MINUTE;
}

function assertStaggered(releases: ReturnType<typeof computeJobReleaseTimes>) {
  const times = [
    releases.primary.getTime(),
    releases.level1.getTime(),
    releases.level2.getTime(),
    releases.level3.getTime(),
  ];
  assert.equal(new Set(times).size, 4, "two levels released at the same timestamp");
  assert.ok(releases.level1.getTime() - releases.primary.getTime() >= MIN_LEVEL_GAP_MS);
  assert.ok(releases.level2.getTime() - releases.level1.getTime() >= MIN_LEVEL_GAP_MS);
  assert.ok(releases.level3.getTime() - releases.level2.getTime() >= MIN_LEVEL_GAP_MS);
}

test("A) 3:00 kala: normal 2:00 / 1:30 / 1:00 targets", () => {
  const { start, releases } = scenario(180);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 120);
  assert.equal(minutesBeforeStart(releases.level2, start), 90);
  assert.equal(minutesBeforeStart(releases.level3, start), 60);
});

test("B) 2:30 kala: normal targets stay, no extra delay", () => {
  const { start, releases } = scenario(150);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 120);
  assert.equal(minutesBeforeStart(releases.level2, start), 90);
  assert.equal(minutesBeforeStart(releases.level3, start), 60);
});

test("C) 2:05 kala: L1 waits 10 minutes then 1:55", () => {
  const { start, releases } = scenario(125);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 115);
  assert.equal(minutesBeforeStart(releases.level2, start), 90);
  assert.equal(minutesBeforeStart(releases.level3, start), 60);
});

test("D) 2:02 kala: L1 at 1:52, then normal 1:30 / 1:00", () => {
  const { start, releases } = scenario(122);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 112);
  assert.equal(minutesBeforeStart(releases.level2, start), 90);
  assert.equal(minutesBeforeStart(releases.level3, start), 60);
});

test("E) 1:40 kala: L1 at 1:30, L2 delayed to 1:20", () => {
  const { created, start, releases } = scenario(100);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 90);
  assert.equal(minutesBeforeStart(releases.level2, start), 80);
  assert.equal(minutesBeforeStart(releases.level3, start), 60);
  assert.equal(effectiveVisibleMaxRank({ now: created, pickupAt: start, createdAt: created }), 0);
  assert.equal(
    effectiveVisibleMaxRank({
      now: releases.level1,
      pickupAt: start,
      createdAt: created,
    }),
    1,
  );
  assert.equal(
    effectiveVisibleMaxRank({
      now: new Date(releases.level2.getTime() - 1),
      pickupAt: start,
      createdAt: created,
    }),
    1,
  );
  assert.equal(effectiveVisibleMaxRank({ now: releases.level2, pickupAt: start, createdAt: created }), 2);
});

test("F) 1:35 kala: L1 1:25, L2 1:15, L3 1:00", () => {
  const { start, releases } = scenario(95);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 85);
  assert.equal(minutesBeforeStart(releases.level2, start), 75);
  assert.equal(minutesBeforeStart(releases.level3, start), 60);
});

test("G) 1:00 kala: 10-minute ladder 0:50 / 0:40 / 0:30", () => {
  const { created, start, releases } = scenario(60);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 50);
  assert.equal(minutesBeforeStart(releases.level2, start), 40);
  assert.equal(minutesBeforeStart(releases.level3, start), 30);
  assert.equal(effectiveVisibleMaxRank({ now: created, pickupAt: start, createdAt: created }), 0);
});

test("H) 0:30 kala: L3 releases at service start, never same timestamp", () => {
  const { created, start, releases } = scenario(30);
  assertStaggered(releases);
  assert.equal(minutesBeforeStart(releases.level1, start), 20);
  assert.equal(minutesBeforeStart(releases.level2, start), 10);
  assert.equal(minutesBeforeStart(releases.level3, start), 0);
  assert.equal(effectiveVisibleMaxRank({ now: created, pickupAt: start, createdAt: created }), 0);
  assert.equal(
    effectiveVisibleMaxRank({
      now: new Date(start.getTime() - 1),
      pickupAt: start,
      createdAt: created,
    }),
    2,
  );
  assert.equal(effectiveVisibleMaxRank({ now: start, pickupAt: start, createdAt: created }), 3);
});

test("partner ranks and contact permission stay server-authoritative", () => {
  assert.equal(partnerJobRank({ isPrimaryPartner: true, priorityLevel: 2 }), 0);
  assert.equal(partnerJobRank({ isPrimaryPartner: false, priorityLevel: 2 }), 2);
  assert.equal(partnerJobRank({ isPrimaryPartner: false, priorityLevel: null }), null);
  assert.equal(partnerCanSeeOpenJob(0, 0), true);
  assert.equal(partnerCanSeeOpenJob(1, 0), false);
  assert.equal(partnerCanSeeOpenJob(3, 3), true);
  assert.equal(partnerCanSeePassengerContact(0), true);
  assert.equal(partnerCanSeePassengerContact(1), true);
  assert.equal(partnerCanSeePassengerContact(2), false);
  assert.equal(partnerCanSeePassengerContact(3), false);
});

test("payout is 100% for primary and 70% for external partners", () => {
  assert.equal(EXTERNAL_PARTNER_PAYOUT_RATE, 0.7);
  assert.equal(partnerPayoutAmount({ total: 100, isPrimaryPartner: true }), 100);
  assert.equal(partnerPayoutAmount({ total: 100, isPrimaryPartner: false }), 70);
  assert.equal(partnerPayoutAmount({ total: 10000, isPrimaryPartner: false }), 7000);
});

test("occupancy hides baby seats at zero and notes stay compact", () => {
  assert.equal(
    partnerJobOccupancyLine({ passengerCount: 3, luggageCount: 4, babySeatCount: 0 }, copy),
    "3 Yolcu · 4 Valiz",
  );
  assert.equal(
    partnerJobOccupancyLine({ passengerCount: 3, luggageCount: 4, babySeatCount: 1 }, copy),
    "3 Yolcu · 4 Valiz · 1 Bebek Koltuğu",
  );
  assert.equal(partnerJobNotePreview("Kısa not", "Not var"), "Kısa not");
  assert.equal(partnerJobNotePreview("x".repeat(80), "Not var"), "Not var");
  assert.equal(partnerJobOccupancyCompact({ passengerCount: 3, luggageCount: 4 }), "3 / 4");
});

test("hourly partner duration uses reservation hours and catalog included km", () => {
  assert.equal(partnerJobDurationLabel("hourly", 5, "tr"), "5 saat (60 km)");
  assert.equal(partnerJobDurationLabel("hourly", 6, "tr"), "6 saat (70 km)");
  assert.equal(partnerJobDurationLabel("hourly", "8", "tr"), "8 saat (90 km)");
  assert.equal(partnerJobDurationLabel("hourly", 13, "tr"), "13 saat (140 km)");
  assert.equal(partnerJobDurationLabel("hourly", 6, "en"), "6 Hours (70 km)");
  assert.equal(partnerJobDurationLabel("hourly", 6, "ru"), "6 часов (70 км)");
  assert.equal(partnerJobDurationLabel("transfer", 6, "tr"), "—");
  assert.equal(partnerJobDurationLabel("hourly", 3, "tr"), "—");
  assert.match(source("lib/partner/job-view.ts"), /formatDurationHours/);
  assert.match(source("components/partner/job-list.tsx"), /partnerJobDurationLabel\(/);
  assert.match(source("components/partner/job-detail.tsx"), /partnerJobDurationLabel\(/);
  assert.doesNotMatch(source("lib/partner/job-view.ts"), /includedKm: 70/);
  assert.equal(partnerJobServiceTypeLabel("hourly", "tr"), "Saatlik Şoförlü Araç");
  assert.equal(partnerJobServiceTypeLabel("transfer", "tr"), "Özel Transfer & Taksi");
  assert.equal(partnerJobTourName("istanbul-full-day", "tr"), "İstanbul Tam Gün Tur");
  assert.equal(partnerJobTourName(null, "tr"), null);
});

test("accepted job detail keeps passenger fields in a separate labeled section", () => {
  const genderCopy = {
    jobPassengerGenderFemale: "Kadın",
    jobPassengerGenderMale: "Erkek",
  };
  assert.equal(partnerJobGenderLabel("male", genderCopy), "Erkek");
  assert.equal(partnerJobGenderLabel("female", genderCopy), "Kadın");
  assert.equal(partnerJobGenderLabel("MALE", genderCopy), "Erkek");
  assert.equal(partnerJobGenderLabel("unknown", genderCopy), null);
  assert.deepEqual(partnerPassengerIdentityFields("12345678901"), {
    passportNumber: null,
    nationalId: "12345678901",
  });
  assert.deepEqual(partnerPassengerIdentityFields("U12345678"), {
    passportNumber: "U12345678",
    nationalId: null,
  });
  assert.deepEqual(partnerPassengerIdentityFields("  "), {
    passportNumber: null,
    nationalId: null,
  });
  assert.equal(partnerPassengerIdentityDisplay("12345678901", null), "12345678901");
  assert.equal(partnerPassengerIdentityDisplay(null, "U12345678"), "U12345678");
  assert.equal(partnerPassengerIdentityDisplay(null, null), "11111111111");
  assert.equal(partnerPassengerIdentityDisplay("  ", ""), "11111111111");
  const detail = source("components/partner/job-detail.tsx");
  assert.match(detail, /jobPassengerSection/);
  assert.match(detail, /partner-job-section/);
  assert.match(detail, /partner-job-passenger-table/);
  assert.match(
    detail,
    /jobPassengerCountry[\s\S]{0,80}jobPassengerIdentity[\s\S]{0,80}jobPassengerFirstName[\s\S]{0,80}jobPassengerLastName[\s\S]{0,80}jobPassengerGender/,
  );
  assert.match(detail, /partnerPassengerIdentityDisplay\(/);
  assert.match(detail, /job\.canSeePassengerContact/);
  assert.match(detail, /job\.customerPhone/);
  assert.match(detail, /job\.customerEmail/);
  assert.doesNotMatch(detail, /jobPassengerPhone[\s\S]{0,80}passenger\.phone/);
  assert.doesNotMatch(detail, /job\.customerName/);
  assert.doesNotMatch(detail, /value=\{passenger\.gender\}/);
  assert.match(source("lib/partner/jobs.ts"), /gender, is_primary_passenger/);
  assert.match(source("lib/partner/jobs.ts"), /partnerPassengerIdentityFields/);
  assert.match(source("lib/partner/jobs.ts"), /countryName\(row\.country_code, locale\)/);
  assert.match(source("lib/partner/copy.ts"), /Yolcu Bilgileri/);
  assert.match(source("lib/partner/copy.ts"), /Pasaport \/ T\.C\. Kimlik No/);
  assert.match(source("lib/partner/copy.ts"), /jobPassengerGenderMale: "Male"/);
  assert.match(source("lib/partner/copy.ts"), /jobPassengerGenderMale: "Мужской"/);
});

test("open jobs default to newest created and can sort by service time", () => {
  const earlierCreatedLaterService = {
    id: "a",
    createdAt: "2026-09-07T04:00:00.000Z",
    pickupAt: "2026-09-08T07:00:00.000Z",
  };
  const laterCreatedSoonerService = {
    id: "b",
    createdAt: "2026-09-07T04:05:00.000Z",
    pickupAt: "2026-09-07T12:00:00.000Z",
  };
  assert.deepEqual(
    sortPartnerJobs([earlierCreatedLaterService, laterCreatedSoonerService], "newest").map(
      (item) => item.id,
    ),
    ["b", "a"],
  );
  assert.deepEqual(
    sortPartnerJobs([earlierCreatedLaterService, laterCreatedSoonerService], "service").map(
      (item) => item.id,
    ),
    ["b", "a"],
  );
  const laterCreatedLaterService = {
    id: "c",
    createdAt: "2026-09-07T04:06:00.000Z",
    pickupAt: "2026-09-09T09:00:00.000Z",
  };
  assert.deepEqual(
    sortPartnerJobs(
      [earlierCreatedLaterService, laterCreatedSoonerService, laterCreatedLaterService],
      "newest",
    ).map((item) => item.id),
    ["c", "b", "a"],
  );
  assert.deepEqual(
    sortPartnerJobs(
      [earlierCreatedLaterService, laterCreatedSoonerService, laterCreatedLaterService],
      "service",
    ).map((item) => item.id),
    ["b", "a", "c"],
  );
  assert.match(source("lib/partner/jobs.ts"), /ORDER BY created_at DESC/);
  assert.match(source("components/partner/job-list.tsx"), /jobSortByService/);
  assert.match(source("components/partner/job-list.tsx"), /PartnerRefreshButton/);
  assert.match(
    source("components/partner/job-list.tsx"),
    /partner-jobs-toolbar[\s\S]*PartnerRefreshButton[\s\S]*partner-jobs-sort/,
  );
  assert.match(source("components/partner/refresh-button.tsx"), /router\.refresh\(\)/);
  assert.match(source("components/partner/refresh-button.tsx"), /useTransition/);
  assert.match(source("app/globals.css"), /partner-jobs-toolbar/);
  assert.match(
    source("app/globals.css"),
    /max-width: 419px[\s\S]{0,220}partner-refresh-label[\s\S]{0,40}display: none/,
  );
  assert.doesNotMatch(source("components/partner/refresh-button.tsx"), /window\.location/);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/layout.tsx"), /jobRefresh/);
  assert.match(source("lib/partner/copy.ts"), /jobRefresh: "Yenile"/);
  assert.match(source("app/[locale]/partner/(panel)/jobs/page.tsx"), /partner-jobs-page/);
  assert.match(source("app/[locale]/partner/(panel)/accepted/page.tsx"), /partner-jobs-page/);
  assert.match(source("app/[locale]/partner/(panel)/accepted/page.tsx"), /partner-jobs-accepted/);
  assert.doesNotMatch(
    source("app/[locale]/partner/(panel)/accepted/page.tsx"),
    /partner-drivers-page/,
  );

  const searchSet = [
    {
      ...earlierCreatedLaterService,
      pickupName: "Sabiha Gokcen",
      dropoffName: "Taksim",
      serviceLabel: "Transfer",
    },
    {
      ...laterCreatedSoonerService,
      pickupName: "Sabiha Airport",
      dropoffName: "Sultanahmet",
      serviceLabel: "Transfer",
    },
    {
      ...laterCreatedLaterService,
      pickupName: "IST",
      dropoffName: "Kadikoy",
      serviceLabel: "Transfer",
    },
  ];
  const filtered = filterPartnerJobs(searchSet, "Sabiha");
  assert.deepEqual(
    sortPartnerJobs(filtered, "newest").map((item) => item.id),
    ["b", "a"],
  );
  assert.deepEqual(
    sortPartnerJobs(filtered, "service").map((item) => item.id),
    ["b", "a"],
  );
});

test("open jobs hide cash collection and primary still gets accept/detail", () => {
  assert.equal(pickupIsAirport({ airportCode: "IST" }), true);
  assert.equal(pickupIsAirport({ airportCode: "SAW" }), true);
  assert.equal(pickupIsAirport({ airportCode: "AYT" }), true);
  assert.equal(pickupIsAirport({ locationType: "hotel" }), false);
  const list = source("components/partner/job-list.tsx");
  assert.match(list, /mode === "open"/);
  assert.match(list, /copy\.jobAccept/);
  assert.match(list, /copy\.jobDetail/);
  assert.match(list, /jobDuration[\s\S]{0,120}jobOccupancy/);
  assert.doesNotMatch(list, /jobBabySeats/);
  assert.doesNotMatch(list, /jobNote/);
  assert.doesNotMatch(list, /isPrimaryPartner/);
  assert.match(source("app/globals.css"), /table-layout: fixed/);
  assert.match(
    source("app/globals.css"),
    /partner-jobs-page \.partner-jobs-table[\s\S]{0,180}overflow-x: hidden/,
  );
  assert.doesNotMatch(list, /job\.collectLabel/);
  assert.match(list, /partner-job-code/);
  assert.match(source("components/partner/job-detail.tsx"), /job\.accepted && job\.collectLabel/);
  assert.match(source("components/partner/job-detail.tsx"), /\(job\.babySeatCount \?\? 0\) > 0/);
  assert.doesNotMatch(source("components/partner/job-detail.tsx"), /babySeatCount != null \? String\(job\.babySeatCount\) : "0"/);
  assert.match(source("lib/partner/jobs.ts"), /input\.accepted && isCash/);
  assert.match(source("lib/partner/copy.ts"), /Size Ödenecek Tutar/);
  assert.doesNotMatch(source("lib/partner/copy.ts"), /Partnere Ödenecek/);
  assert.match(source("lib/partner/copy.ts"), /Yolcudan Nakit Tahsilat/);
  assert.match(source("lib/partner/jobs.ts"), /FOR UPDATE/);
  assert.match(source("components/ops/partner-info-form.tsx"), /\["jobs", copy\.partnerTabJobs\]/);
});
