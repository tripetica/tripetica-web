import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFxSnapshot,
  convertEurTotal,
  currencyTotalsFromBook,
  displayAmountFromEur,
  fxBookFromEurRates,
  bookFromQuoteCache,
} from "./convert";
import { quoteCacheFromErApiPayload } from "./er-api";
import { microEurAmount } from "./decimal-rate";
import { vehicleQuoteViewFromApplied, visibleVehicleQuoteViews } from "./vehicle-totals";
import {
  formatAmountDigits,
  formatCurrencyPill,
  formatEurAmount,
} from "@/lib/booking/pricing/format-eur";
import { type TransferPricingBreakdown } from "@/lib/booking/pricing/transfer-pricing";
import {
  BUSINESS_MINIVAN_CODE,
  BUS_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  quotePremiumEconomySedan,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { quoteTransferBase } from "@/lib/booking/pricing/transfer-pricing";

const SAMPLE_ER = {
  result: "success",
  base_code: "EUR",
  rates: { EUR: 1, USD: 1.2, TRY: 40, RUB: 97, GBP: 0.85 },
};

const book = bookFromQuoteCache(
  quoteCacheFromErApiPayload(SAMPLE_ER, Date.parse("2026-08-25T00:00:00.000Z")),
);

const baseTransfer: TransferPricingBreakdown = {
  openingFeeEur: 25,
  distanceFeeEur: 8.25,
  locationSurchargeEur: 0,
  timeSurchargeEur: 0,
  baseTransferFeeEur: 33.25,
  pricingVersion: "transfer-pricing.v1",
  pickupProvinceCode: "istanbul",
  pickupDistrictCode: "besiktas",
  dropoffProvinceCode: "istanbul",
  dropoffDistrictCode: "besiktas",
};

test("EUR total is unchanged and other currencies multiply API rates", () => {
  assert.equal(book.EUR?.rate, "1");
  assert.equal(convertEurTotal(40, book.EUR!).precise, "40");
  assert.equal(convertEurTotal(40, book.USD!).precise, "48");
  assert.equal(convertEurTotal(40, book.TRY!).precise, "1600");
  assert.equal(convertEurTotal(40, book.GBP!).precise, "34");
  const totals = currencyTotalsFromBook(40, book);
  assert.equal(totals.find((item) => item.code === "EUR")?.amount, 40);
});

test("TR EN RU share the same raw FX totals; only display text changes", () => {
  const totals = currencyTotalsFromBook(40, book);
  const raw = Object.fromEntries(totals.map((item) => [item.code, item.amount]));
  assert.deepEqual(raw, {
    USD: 48,
    EUR: 40,
    TRY: 1600,
    RUB: 4120,
    GBP: 34,
  });
  for (const locale of ["tr", "en", "ru"] as const) {
    const localized = currencyTotalsFromBook(40, book);
    assert.deepEqual(
      localized.map((item) => item.amount),
      totals.map((item) => item.amount),
    );
    assert.equal(formatCurrencyPill("EUR", 40, locale).includes("40"), true);
  }
  assert.equal(formatCurrencyPill("EUR", 40, "en"), "€ 40.00");
  assert.equal(formatCurrencyPill("EUR", 40, "tr"), "€ 40,00");
  assert.equal(formatCurrencyPill("EUR", 40, "ru"), "€ 40,00");
  assert.equal(formatAmountDigits(39.92, "tr"), "39,92");
  assert.equal(formatAmountDigits(39.92, "en"), "39.92");
  assert.notEqual(formatEurAmount(39.92, "tr"), formatEurAmount(39.92, "en"));
});

test("localized price text is never parsed back into FX math", () => {
  assert.throws(() => microEurAmount("39,92"));
  assert.throws(() => convertEurTotal("39,92", book.USD!));
  assert.equal(convertEurTotal(39.92, book.USD!).precise, convertEurTotal("39.92", book.USD!).precise);
});

test("selected occupancy does not change applied vehicle FX totals", () => {
  const applied = vehicleQuoteViewFromApplied(
    baseTransfer,
    {
      passengerCount: 2,
      luggageCount: 2,
      babySeatCount: 0,
      meetAndGreet: false,
    },
    { book },
  );
  const selectedWouldBe = vehicleQuoteViewFromApplied(
    baseTransfer,
    {
      passengerCount: 3,
      luggageCount: 3,
      babySeatCount: 1,
      meetAndGreet: true,
    },
    { book },
  );
  assert.equal(applied.totalEur, 33.25);
  assert.notEqual(selectedWouldBe.totalEur, applied.totalEur);
  assert.equal(
    applied.totals.map((item) => item.code).join(","),
    "USD,EUR,TRY,RUB,GBP",
  );
});

test("applied occupancy refresh updates every currency", () => {
  const before = vehicleQuoteViewFromApplied(
    baseTransfer,
    { passengerCount: 2, luggageCount: 2, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  const after = vehicleQuoteViewFromApplied(
    baseTransfer,
    { passengerCount: 3, luggageCount: 3, babySeatCount: 1, meetAndGreet: true },
    { book },
  );
  assert.ok(after.totalEur > before.totalEur);
  for (const code of ["USD", "EUR", "TRY", "RUB", "GBP"] as const) {
    const prev = before.totals.find((item) => item.code === code)?.amount;
    const next = after.totals.find((item) => item.code === code)?.amount;
    assert.notEqual(next, null);
    assert.ok((next ?? 0) > (prev ?? 0));
  }
});

test("a stored FX snapshot stays frozen when live rates change", () => {
  const oldBook = fxBookFromEurRates({ USD: "1.10" });
  const newBook = fxBookFromEurRates({ USD: "1.30" });
  const snapshot = buildFxSnapshot(33.25, oldBook);
  const frozen = vehicleQuoteViewFromApplied(
    baseTransfer,
    { passengerCount: 2, luggageCount: 2, babySeatCount: 0, meetAndGreet: false },
    { snapshot, book: newBook },
  );
  const live = vehicleQuoteViewFromApplied(
    baseTransfer,
    { passengerCount: 2, luggageCount: 2, babySeatCount: 0, meetAndGreet: false },
    { book: newBook },
  );
  assert.equal(frozen.totals.find((item) => item.code === "USD")?.amount, 36.58);
  assert.equal(live.totals.find((item) => item.code === "USD")?.amount, 43.23);
});

test("unavailable currencies are null, never zero", () => {
  const totals = currencyTotalsFromBook(27.37, fxBookFromEurRates({ USD: "1.1664" }));
  assert.equal(totals.find((item) => item.code === "RUB")?.amount, null);
  assert.equal(formatCurrencyPill("RUB", null, "tr"), "₽ —");
  assert.notEqual(formatCurrencyPill("RUB", null, "tr"), "₽ 0");
});

test("TRY display uses at most 2 decimals and RUB is a whole ruble", () => {
  const tryAmount = currencyTotalsFromBook(180, fxBookFromEurRates({ TRY: "56.0821" })).find(
    (item) => item.code === "TRY",
  )?.amount;
  const rubAmount = currencyTotalsFromBook(180, fxBookFromEurRates({ RUB: "98.5" })).find(
    (item) => item.code === "RUB",
  )?.amount;
  assert.equal(tryAmount, 10094.78);
  assert.equal(rubAmount, 17730);
});

test("transfer EUR base and extras are unchanged by FX conversion", () => {
  const quote = quoteTransferBase({
    distanceKm: 15,
    pickupAtLocal: "2026-08-28T10:00",
    pickup: { provinceCode: "istanbul", districtCode: "besiktas" },
    dropoff: { provinceCode: "istanbul", districtCode: "besiktas" },
  });
  assert.equal(quote.openingFeeEur, 25);
  assert.equal(quote.distanceFeeEur, 8.25);
  assert.equal(quote.baseTransferFeeEur, 33.25);
  const vehicle = quotePremiumEconomySedan(quote, {
    passengerCount: 3,
    luggageCount: 3,
    babySeatCount: 1,
    meetAndGreet: false,
  });
  const converted = vehicleQuoteViewFromApplied(
    quote,
    {
      passengerCount: 3,
      luggageCount: 3,
      babySeatCount: 1,
      meetAndGreet: false,
    },
    { book },
  );
  assert.equal(converted.totalEur, vehicle.totalEur);
  assert.equal(converted.baseServiceFeeEur, vehicle.baseServiceFeeEur);
  assert.equal(converted.extraPassengerFeeEur, vehicle.extraPassengerFeeEur);
  assert.equal(converted.extraLuggageFeeEur, vehicle.extraLuggageFeeEur);
  assert.equal(converted.babySeatFeeEur, vehicle.babySeatFeeEur);
});

test("fee line items convert from EUR with the same snapshot rates as the total", () => {
  const view = vehicleQuoteViewFromApplied(
    baseTransfer,
    { passengerCount: 2, luggageCount: 2, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(view.baseServiceFeeEur, 33.25);
  assert.equal(view.fxRates.USD?.rate, book.USD?.rate);
  for (const code of ["USD", "EUR", "TRY", "RUB", "GBP"] as const) {
    const total = view.totals.find((item) => item.code === code)?.amount ?? null;
    const fromTotal = convertEurTotal(view.totalEur, book[code]!).display;
    const fromFee = displayAmountFromEur(view.baseServiceFeeEur, code, view.fxRates);
    assert.equal(total, fromTotal);
    assert.equal(fromFee, convertEurTotal(view.baseServiceFeeEur, book[code]!).display);
  }
  assert.equal(displayAmountFromEur(40, "USD", view.fxRates), convertEurTotal(40, book.USD!).display);
  assert.equal(displayAmountFromEur(40, "TRY", view.fxRates), convertEurTotal(40, book.TRY!).display);
});

test("sedan and minivan convert with the same snapshot rates", () => {
  const occupancy = {
    passengerCount: 2,
    luggageCount: 2,
    babySeatCount: 0,
    meetAndGreet: false,
  };
  const snapshot = buildFxSnapshot(33.25, book);
  const live = fxBookFromEurRates({ USD: "9", EUR: "1", TRY: "40", RUB: "97", GBP: "0.85" });
  const views = visibleVehicleQuoteViews(baseTransfer, occupancy, {
    snapshot,
    book: live,
  });
  assert.equal(views.map((item) => item.vehicleCode).join(","), [
    PREMIUM_ECONOMY_SEDAN_CODE,
    STANDARD_MINIVAN_CODE,
    BUSINESS_MINIVAN_CODE,
    FIRST_CLASS_MINIVAN_CODE,
    FIRST_CLASS_SEDAN_CODE,
  ].join(","));
  assert.equal(views[0]?.fxRates.USD?.rate, book.USD?.rate);
  assert.equal(views[1]?.fxRates.USD?.rate, book.USD?.rate);
  assert.equal(views[2]?.fxRates.USD?.rate, book.USD?.rate);
  assert.equal(views[3]?.fxRates.USD?.rate, book.USD?.rate);
  assert.equal(views[4]?.fxRates.USD?.rate, book.USD?.rate);
  assert.notEqual(views[0]?.totalEur, views[1]?.totalEur);
  assert.notEqual(views[1]?.totalEur, views[2]?.totalEur);
  assert.equal(
    views[2]?.totals.find((item) => item.code === "USD")?.amount,
    displayAmountFromEur(views[2]!.totalEur, "USD", snapshot.rates),
  );
  assert.equal(
    views[3]?.totals.find((item) => item.code === "USD")?.amount,
    displayAmountFromEur(views[3]!.totalEur, "USD", snapshot.rates),
  );
  assert.equal(
    views[4]?.totals.find((item) => item.code === "USD")?.amount,
    displayAmountFromEur(views[4]!.totalEur, "USD", snapshot.rates),
  );
  assert.equal(
    views[1]?.totals.find((item) => item.code === "USD")?.amount,
    displayAmountFromEur(views[1]!.totalEur, "USD", snapshot.rates),
  );
  assert.notEqual(
    views[1]?.totals.find((item) => item.code === "USD")?.amount,
    displayAmountFromEur(views[1]!.totalEur, "USD", live),
  );
});

test("visibility uses occupancy, not a second currency book", () => {
  const overSedan = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 4, luggageCount: 1, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    overSedan.map((item) => item.vehicleCode),
    [STANDARD_MINIVAN_CODE, BUSINESS_MINIVAN_CODE, FIRST_CLASS_MINIVAN_CODE],
  );
  const overMinivan = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 8, luggageCount: 1, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    overMinivan.map((item) => item.vehicleCode),
    [MINIBUS_CODE],
  );
  const unset = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: null, luggageCount: null, babySeatCount: null, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    unset.map((item) => item.vehicleCode),
    [
      PREMIUM_ECONOMY_SEDAN_CODE,
      STANDARD_MINIVAN_CODE,
      BUSINESS_MINIVAN_CODE,
      FIRST_CLASS_MINIVAN_CODE,
      FIRST_CLASS_SEDAN_CODE,
      MINIBUS_CODE,
      MIDIBUS_CODE,
      BUS_CODE,
    ],
  );
  const unsetZero = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 0, luggageCount: null, babySeatCount: null, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    unsetZero.map((item) => item.vehicleCode),
    unset.map((item) => item.vehicleCode),
  );
  const businessMax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 6, luggageCount: 6, babySeatCount: 2, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    businessMax.map((item) => item.vehicleCode),
    [STANDARD_MINIVAN_CODE, BUSINESS_MINIVAN_CODE],
  );
  const sevenPassengers = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 7, luggageCount: 1, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    sevenPassengers.map((item) => item.vehicleCode),
    [STANDARD_MINIVAN_CODE, MINIBUS_CODE],
  );
  const firstClassMax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 5, luggageCount: 5, babySeatCount: 2, meetAndGreet: true },
    { book },
  );
  assert.equal(
    firstClassMax.some((item) => item.vehicleCode === FIRST_CLASS_MINIVAN_CODE),
    true,
  );
  assert.equal(
    firstClassMax.find((item) => item.vehicleCode === FIRST_CLASS_MINIVAN_CODE)
      ?.meetAndGreetFeeEur,
    0,
  );
  const firstClassSedanFit = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 3, luggageCount: 3, babySeatCount: 1, meetAndGreet: true },
    { book },
  );
  assert.equal(
    firstClassSedanFit.some((item) => item.vehicleCode === FIRST_CLASS_SEDAN_CODE),
    true,
  );
  assert.equal(
    firstClassSedanFit.find((item) => item.vehicleCode === FIRST_CLASS_SEDAN_CODE)
      ?.meetAndGreetFeeEur,
    0,
  );
  assert.equal(
    overSedan.some((item) => item.vehicleCode === FIRST_CLASS_SEDAN_CODE),
    false,
  );
  assert.equal(
    overSedan.some((item) => item.vehicleCode === MINIBUS_CODE),
    false,
  );
  const minibusFit = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 7, luggageCount: 7, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    minibusFit.map((item) => item.vehicleCode),
    [STANDARD_MINIVAN_CODE, MINIBUS_CODE],
  );
  const minibusBelow = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 6, luggageCount: 6, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    minibusBelow.some((item) => item.vehicleCode === MINIBUS_CODE),
    false,
  );
  const minibusMax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 18, luggageCount: 19, babySeatCount: 3, meetAndGreet: true },
    { book },
  );
  assert.deepEqual(
    minibusMax.map((item) => item.vehicleCode),
    [MINIBUS_CODE, MIDIBUS_CODE],
  );
  assert.equal(
    minibusMax.find((item) => item.vehicleCode === MINIBUS_CODE)?.meetAndGreetFeeEur,
    7,
  );
  const ninePassengers = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 9, luggageCount: 0, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    ninePassengers.map((item) => item.vehicleCode),
    [MINIBUS_CODE],
  );
  const bagsOnly = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 2, luggageCount: 10, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    bagsOnly.some((item) => item.vehicleCode === MINIBUS_CODE),
    true,
  );
  const overMaxBags = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 1, luggageCount: 20, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    overMaxBags.some((item) => item.vehicleCode === MINIBUS_CODE),
    false,
  );
  const overMaxPax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 19, luggageCount: 1, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    overMaxPax.some((item) => item.vehicleCode === MINIBUS_CODE),
    false,
  );
  const onePassengerUnsetBags = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 1, luggageCount: null, babySeatCount: null, meetAndGreet: false },
    { book },
  );
  assert.deepEqual(
    onePassengerUnsetBags.map((item) => item.vehicleCode),
    [
      PREMIUM_ECONOMY_SEDAN_CODE,
      STANDARD_MINIVAN_CODE,
      BUSINESS_MINIVAN_CODE,
      FIRST_CLASS_MINIVAN_CODE,
      FIRST_CLASS_SEDAN_CODE,
    ],
  );
  const midibusByPax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 17, luggageCount: 0, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    midibusByPax.some((item) => item.vehicleCode === MIDIBUS_CODE),
    true,
  );
  const midibusByBags = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 2, luggageCount: 18, babySeatCount: 4, meetAndGreet: true },
    { book },
  );
  assert.equal(
    midibusByBags.some((item) => item.vehicleCode === MIDIBUS_CODE),
    true,
  );
  assert.equal(
    midibusByBags.find((item) => item.vehicleCode === MIDIBUS_CODE)
      ?.meetAndGreetFeeEur,
    10,
  );
  const midibusBelow = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 16, luggageCount: 17, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    midibusBelow.some((item) => item.vehicleCode === MIDIBUS_CODE),
    false,
  );
  const midibusOverMaxPax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 26, luggageCount: 18, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    midibusOverMaxPax.some((item) => item.vehicleCode === MIDIBUS_CODE),
    false,
  );
  const midibusOverMaxBags = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 17, luggageCount: 28, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    midibusOverMaxBags.some((item) => item.vehicleCode === MIDIBUS_CODE),
    false,
  );
  const busByPax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 25, luggageCount: 0, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    busByPax.some((item) => item.vehicleCode === BUS_CODE),
    true,
  );
  const busByBags = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 2, luggageCount: 25, babySeatCount: 4, meetAndGreet: true },
    { book },
  );
  assert.equal(
    busByBags.some((item) => item.vehicleCode === BUS_CODE),
    true,
  );
  assert.equal(
    busByBags.find((item) => item.vehicleCode === BUS_CODE)?.meetAndGreetFeeEur,
    15,
  );
  const busBelow = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 24, luggageCount: 24, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    busBelow.some((item) => item.vehicleCode === BUS_CODE),
    false,
  );
  assert.equal(
    midibusOverMaxPax.some((item) => item.vehicleCode === BUS_CODE),
    true,
  );
  const busOverMaxPax = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 46, luggageCount: 25, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    busOverMaxPax.some((item) => item.vehicleCode === BUS_CODE),
    false,
  );
  const busOverMaxBags = visibleVehicleQuoteViews(
    baseTransfer,
    { passengerCount: 25, luggageCount: 46, babySeatCount: 0, meetAndGreet: false },
    { book },
  );
  assert.equal(
    busOverMaxBags.some((item) => item.vehicleCode === BUS_CODE),
    false,
  );
});
