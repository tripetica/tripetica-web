import assert from "node:assert/strict";
import test from "node:test";
import {
  opsReservationPdfHref,
  parseOpsReservationPdfFlags,
} from "@/lib/ops/ops-pdf-query";

test("ops reservation PDF href only sends include flags, never amounts", () => {
  assert.equal(
    opsReservationPdfHref("/tr/ops/reservations/abc/pdf", {
      includeContact: false,
      includePricing: false,
    }),
    "/tr/ops/reservations/abc/pdf?includeContact=0&includePricing=0",
  );
  assert.equal(
    opsReservationPdfHref("/tr/ops/reservations/abc/pdf", {
      includeContact: true,
      includePricing: true,
    }),
    "/tr/ops/reservations/abc/pdf?includeContact=1&includePricing=1",
  );
  const href = opsReservationPdfHref("/tr/ops/reservations/abc/pdf", {
    includeContact: false,
    includePricing: true,
  });
  assert.doesNotMatch(href, /selectedPrice|totalPrice|amount|5393|₺/);
});

test("ops reservation PDF query treats only explicit 1 as include, ignoring forged amounts", () => {
  const hidden = parseOpsReservationPdfFlags(
    new URLSearchParams("includeContact=0&includePricing=0&price=99999&selectedPrice=1"),
  );
  assert.deepEqual(hidden, { includeContact: false, includePricing: false });

  const shown = parseOpsReservationPdfFlags(
    new URLSearchParams("includeContact=1&includePricing=1&total=0"),
  );
  assert.deepEqual(shown, { includeContact: true, includePricing: true });

  const omitted = parseOpsReservationPdfFlags(new URLSearchParams("price=111.02"));
  assert.deepEqual(omitted, { includeContact: false, includePricing: false });

  const truthyButNotOne = parseOpsReservationPdfFlags(
    new URLSearchParams("includePricing=true&includeContact=yes"),
  );
  assert.deepEqual(truthyButNotOne, { includeContact: false, includePricing: false });
});

test("contact and pricing PDF flags are independent", () => {
  assert.deepEqual(
    parseOpsReservationPdfFlags(new URLSearchParams("includeContact=1&includePricing=0")),
    { includeContact: true, includePricing: false },
  );
  assert.deepEqual(
    parseOpsReservationPdfFlags(new URLSearchParams("includeContact=0&includePricing=1")),
    { includeContact: false, includePricing: true },
  );
});
