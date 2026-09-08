"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutCompleteCta } from "@/components/booking/checkout-complete-cta";
import { CheckoutPickupPrepDialog } from "@/components/booking/checkout-pickup-prep-dialog";
import { CheckoutContact } from "@/components/booking/checkout-contact";
import { CheckoutLegal } from "@/components/booking/checkout-legal";
import {
  CheckoutOtherPassengers,
} from "@/components/booking/checkout-other-passengers";
import {
  CheckoutPassengerForm,
  emptyPassengerForm,
  firstIncompleteExtraSequence,
  type PassengerFieldErrors,
  type PassengerFormValue,
} from "@/components/booking/checkout-passenger-form";
import { CheckoutPayment } from "@/components/booking/checkout-payment";
import { CheckoutSummary } from "@/components/booking/checkout-summary";
import { EditFinalizePanel } from "@/components/booking/edit-finalize-panel";
import { type CheckoutPaymentMethod } from "@/lib/booking/checkout-complete";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import {
  scrollToCheckoutField,
  validateCheckoutForm,
  type CheckoutValidationErrors,
} from "@/lib/booking/checkout-validation";
import { type BookingDraftView, type BookingPassengerView } from "@/lib/booking/draft-view";
import { formatNationalInput, emailValidity, phoneValidity } from "@/lib/booking/phone";
import { formatCurrencyPill } from "@/lib/booking/pricing/format-eur";
import { displayAmountFromEur } from "@/lib/booking/fx/convert";
import { isBosphorusDinnerTour, BOSPHORUS_OPEN_DATE_EVENT } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  formatIstanbulLocalDateDisplayLong,
  formatIstanbulLocalDisplay,
} from "@/lib/booking/istanbul-time";
import { bookingPaymentPath, bookingSuccessPath } from "@/lib/booking/page-config";
import {
  SBP_UNSUPPORTED_CURRENCY,
  type SbpAllowedCurrency,
} from "@/lib/payments/online-payment";
import {
  resolveCheckoutContactInitial,
  resolveCheckoutMainPassengerInitial,
  type CheckoutAccountPrefill,
} from "@/lib/booking/checkout-account-prefill";
import { resolveCountryIso2WithLocaleDefault } from "@/lib/geo/locale-defaults";
import { type Locale } from "@/lib/i18n/config";

function checkoutFxRates(draft: BookingDraftView) {
  if (Object.keys(draft.fxRates).length > 0) {
    return draft.fxRates;
  }
  const appliedQuote = draft.vehicleQuotes.find(
    (quote) => quote.vehicleCode === draft.appliedVehicleCode,
  );
  return appliedQuote?.fxRates ?? draft.vehicleQuotes[0]?.fxRates ?? {};
}

function bosphorusCutoffConfirmLabel(
  locale: Locale,
  local: string,
  mode: "confirm" | "confirming",
) {
  const copy = checkoutCopy[locale];
  const date = formatIstanbulLocalDateDisplayLong(local, locale);
  const template =
    mode === "confirming" ? copy.bosphorusCutoffConfirming : copy.bosphorusCutoffConfirm;
  return template.replace("{date}", date);
}

type ExtraMode = "now" | "later";

function validationMessages(locale: Locale) {
  const copy = checkoutCopy[locale];
  return {
    required: copy.required,
    emailInvalid: copy.emailInvalid,
    phoneInvalid: copy.phoneInvalid,
    legalRequired: copy.legalRequired,
    paymentRequired: copy.paymentRequired,
    captchaRequired: copy.captchaRequired,
  };
}

function resolveCompleteError(
  locale: Locale,
  status: number,
  payload: { reason?: string },
) {
  const copy = checkoutCopy[locale];
  if (status >= 500) {
    return copy.completeServerError;
  }
  if (status === 400) {
    if (payload.reason === "legal") {
      return copy.legalRequired;
    }
    if (payload.reason === "captcha") {
      return copy.captchaRequired;
    }
    return copy.completeError;
  }
  if (status === 404 || status === 403) {
    return copy.completeServerError;
  }
  return copy.completeServerError;
}

function pickupPrepTimeLabel(locale: Locale, local: string) {
  return formatIstanbulLocalDisplay(local, locale);
}

function pickupPrepCopy(
  locale: Locale,
  local: string,
  mode: "body" | "confirm" | "confirming",
) {
  const time = pickupPrepTimeLabel(locale, local);
  const copy = checkoutCopy[locale];
  if (mode === "body") {
    return copy.pickupPrepBody.replace("{time}", time);
  }
  if (mode === "confirming") {
    return copy.pickupPrepConfirming.replace("{time}", time);
  }
  return copy.pickupPrepConfirm.replace("{time}", time);
}

type CompleteApiPayload = {
  ok?: boolean;
  error?: string;
  reason?: string;
  next?: "success" | "payment";
  suggestedPickupAtLocal?: string;
};

async function postCompleteReservation(body: Record<string, unknown>) {
  const response = await fetch("/api/booking/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as CompleteApiPayload;
  return { response, payload };
}

async function persistCheckoutCurrency(locale: Locale, currency: SbpAllowedCurrency) {
  const response = await fetch("/api/booking/draft/selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, currency }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { draft?: BookingDraftView };
  return payload.draft ?? null;
}

type BookingCheckoutStageProps = {
  locale: Locale;
  draft: BookingDraftView;
  accountPrefill?: CheckoutAccountPrefill | null;
  onDraftChange: (draft: BookingDraftView) => void;
  onBack: () => void;
  onChooseAnotherDate?: () => void;
};

function passengerFromDraft(
  passengers: BookingPassengerView[],
  sequence: number,
  locale: Locale,
) {
  return emptyPassengerForm(
    passengers.find((item) => item.sequenceNo === sequence) ?? null,
    locale,
  );
}

function extrasFromDraft(
  sequences: number[],
  passengers: BookingPassengerView[],
  locale: Locale,
) {
  return Object.fromEntries(
    sequences.map((sequence) => [
      sequence,
      passengerFromDraft(passengers, sequence, locale),
    ]),
  );
}

export function BookingCheckoutStage({
  locale,
  draft,
  accountPrefill = null,
  onDraftChange,
  onBack,
  onChooseAnotherDate,
}: BookingCheckoutStageProps) {
  const router = useRouter();
  const copy = checkoutCopy[locale];
  const contactInitial = resolveCheckoutContactInitial({
    locale,
    draftEmail: draft.customerEmail,
    draftPhone: draft.customerPhone,
    draftPhoneCountryCode: draft.customerCountryCode,
    account: accountPrefill,
  });
  const mainInitial = resolveCheckoutMainPassengerInitial({
    locale,
    passenger: draft.passengers.find((item) => item.sequenceNo === 1) ?? null,
    account: accountPrefill,
  });
  const extraCount = Math.max(0, (draft.applied.passengerCount ?? 1) - 1);
  const extraSequences = useMemo(
    () => Array.from({ length: extraCount }, (_, index) => index + 2),
    [extraCount],
  );
  const hasSavedExtras = draft.passengers.some((item) => item.sequenceNo > 1);

  const [email, setEmail] = useState(contactInitial.email);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailDirty, setEmailDirty] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<string | null>(() =>
    resolveCountryIso2WithLocaleDefault(contactInitial.phoneCountryIso2, locale),
  );
  const [phoneNational, setPhoneNational] = useState(contactInitial.phoneNational);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneDirty, setPhoneDirty] = useState(false);
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [main, setMain] = useState<PassengerFormValue>(() => ({
    countryCode: mainInitial.countryCode,
    identityNumber: mainInitial.identityNumber,
    firstName: mainInitial.firstName,
    lastName: mainInitial.lastName,
    gender: mainInitial.gender,
  }));
  const [extras, setExtras] = useState<Record<number, PassengerFormValue>>(() =>
    extrasFromDraft(extraSequences, draft.passengers, locale),
  );
  const [mode, setMode] = useState<ExtraMode | null>(hasSavedExtras ? "now" : null);
  const [openSequence, setOpenSequence] = useState<number | null>(() =>
    hasSavedExtras
      ? firstIncompleteExtraSequence(
          extraSequences,
          extrasFromDraft(extraSequences, draft.passengers, locale),
        )
      : null,
  );
  const [payment, setPayment] = useState<CheckoutPaymentMethod | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [cashCaptchaInstance, setCashCaptchaInstance] = useState(0);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [pickupPrepLocal, setPickupPrepLocal] = useState<string | null>(null);
  const [pickupPrepKind, setPickupPrepKind] = useState<"transfer" | "bosphorus" | null>(
    null,
  );
  const [confirmingPickupPrep, setConfirmingPickupPrep] = useState(false);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [mainErrors, setMainErrors] = useState<PassengerFieldErrors>({});
  const persistSeq = useRef(0);
  const currencySeq = useRef(0);
  const emailTimer = useRef<number>(0);
  const phoneTimer = useRef<number>(0);
  const notesTimer = useRef<number>(0);
  const passengerTimers = useRef<Record<number, number>>({});
  const emailRef = useRef({ value: email, dirty: emailDirty });
  const phoneRef = useRef({
    country: phoneCountry,
    national: phoneNational,
    dirty: phoneDirty,
  });
  const mainRef = useRef(main);
  const legalRef = useRef(legalAccepted);
  const paymentRef = useRef(payment);
  const captchaTokenRef = useRef(captchaToken);

  useEffect(() => {
    emailRef.current = { value: email, dirty: emailDirty };
    phoneRef.current = {
      country: phoneCountry,
      national: phoneNational,
      dirty: phoneDirty,
    };
    mainRef.current = main;
    legalRef.current = legalAccepted;
    paymentRef.current = payment;
    captchaTokenRef.current = captchaToken;
  }, [
    captchaToken,
    email,
    emailDirty,
    legalAccepted,
    main,
    payment,
    phoneCountry,
    phoneDirty,
    phoneNational,
  ]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setExtras((current) => {
        let changed = false;
        const next = { ...current };
        for (const sequence of extraSequences) {
          if (next[sequence] == null) {
            next[sequence] = passengerFromDraft(draft.passengers, sequence, locale);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
  }, [draft.passengers, extraSequences, locale]);

  function applyDraft(next: BookingDraftView | null) {
    if (next) {
      onDraftChange(next);
    }
  }

  async function saveContact(patch: {
    email?: string | null;
    phoneCountryCode?: string | null;
    phoneNational?: string | null;
    notes?: string | null;
  }) {
    const seq = ++persistSeq.current;
    const response = await fetch("/api/booking/draft/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, ...patch }),
    });
    const payload = (await response.json()) as { draft?: BookingDraftView };
    if (seq === persistSeq.current && response.ok && payload.draft) {
      applyDraft(payload.draft);
    }
  }

  async function savePassenger(sequenceNo: number, value: PassengerFormValue) {
    const seq = ++persistSeq.current;
    const response = await fetch("/api/booking/draft/passenger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        sequenceNo,
        countryCode: value.countryCode,
        identityNumber: value.identityNumber,
        firstName: value.firstName,
        lastName: value.lastName,
        gender: value.gender,
      }),
    });
    const payload = (await response.json()) as { draft?: BookingDraftView };
    if (seq === persistSeq.current && response.ok && payload.draft) {
      applyDraft(payload.draft);
    }
  }

  function queueEmail(next: string) {
    window.clearTimeout(emailTimer.current);
    emailTimer.current = window.setTimeout(() => {
      void saveContact({ email: next });
    }, 700);
  }

  function queuePhone(country: string | null, national: string) {
    window.clearTimeout(phoneTimer.current);
    phoneTimer.current = window.setTimeout(() => {
      void saveContact({
        phoneCountryCode: country,
        phoneNational: national,
      });
    }, 700);
  }

  function queueNotes(next: string) {
    window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => {
      void saveContact({ notes: next });
    }, 700);
  }

  function syncEmailError(value: string, force: boolean) {
    const status = emailValidity(value);
    const message =
      status === "valid"
        ? null
        : status === "empty"
          ? copy.required
          : copy.emailInvalid;
    setEmailError((current) => (force || current ? message : current));
  }

  function syncPhoneError(country: string | null, national: string, force: boolean) {
    const status = phoneValidity(country, national);
    const message =
      status === "valid"
        ? null
        : !country || status === "empty"
          ? copy.required
          : copy.phoneInvalid;
    setPhoneError((current) => (force || current ? message : current));
  }

  function runCheckoutValidation(options: { requirePayment: boolean; requireCaptcha: boolean }) {
    return validateCheckoutForm(
      {
        email: emailRef.current.value,
        phoneCountry: phoneRef.current.country,
        phoneNational: phoneRef.current.national,
        mainPassenger: mainRef.current,
        legalAccepted: legalRef.current,
        payment: paymentRef.current,
        captchaToken: captchaTokenRef.current,
        requirePayment: options.requirePayment,
        requireCaptcha: options.requireCaptcha,
      },
      validationMessages(locale),
    );
  }

  function applyCheckoutValidation(result: CheckoutValidationErrors, scroll: boolean) {
    setEmailError(result.emailError);
    setPhoneError(result.phoneError);
    setMainErrors(result.mainErrors);
    setLegalError(result.legalError);
    setPaymentError(result.paymentError);
    setCaptchaError(result.captchaError);
    if (scroll && result.firstInvalid) {
      scrollToCheckoutField(result.firstInvalid);
    }
    return result.isValid;
  }

  function changePayment(next: CheckoutPaymentMethod) {
    const valid = applyCheckoutValidation(
      runCheckoutValidation({ requirePayment: false, requireCaptcha: false }),
      true,
    );
    if (!valid) {
      return;
    }
    if (next === payment) {
      return;
    }
    setCashCaptchaInstance((value) => value + 1);
    setPayment(next);
    setPaymentError(null);
    setCaptchaToken(null);
    setCaptchaError(null);
  }

  async function changeSbpCurrency(next: SbpAllowedCurrency) {
    if (next === draft.currency || currencyBusy) {
      return;
    }
    const previous = draft.currency;
    const previousTotal = draft.appliedVehicleTotal;
    const seq = ++currencySeq.current;
    setCurrencyBusy(true);
    const nextTotal = (() => {
      // Package / Bosphorus: use frozen snapshot totals — no new FX conversion.
      if (!draft.appliedVehicleCode) {
        const prepared = draft.fxTotals[next];
        if (prepared != null) {
          return prepared;
        }
      }
      if (draft.appliedVehicleTotalEur == null) {
        return draft.appliedVehicleTotal;
      }
      return displayAmountFromEur(
        draft.appliedVehicleTotalEur,
        next,
        checkoutFxRates(draft),
      );
    })();
    onDraftChange({
      ...draft,
      currency: next,
      appliedVehicleTotal: nextTotal ?? draft.appliedVehicleTotal,
    });
    try {
      const serverDraft = await persistCheckoutCurrency(locale, next);
      if (seq !== currencySeq.current) {
        return;
      }
      if (serverDraft) {
        onDraftChange(serverDraft);
        return;
      }
      onDraftChange({
        ...draft,
        currency: previous,
        appliedVehicleTotal: previousTotal,
      });
    } catch {
      if (seq !== currencySeq.current) {
        return;
      }
      onDraftChange({
        ...draft,
        currency: previous,
        appliedVehicleTotal: previousTotal,
      });
    } finally {
      if (seq === currencySeq.current) {
        setCurrencyBusy(false);
      }
    }
  }

  async function flushCheckoutDraft() {
    window.clearTimeout(emailTimer.current);
    window.clearTimeout(phoneTimer.current);
    window.clearTimeout(notesTimer.current);
    await saveContact({
      email: emailRef.current.value,
      phoneCountryCode: phoneRef.current.country,
      phoneNational: phoneRef.current.national,
      notes,
    });
    await savePassenger(1, mainRef.current);
  }

  async function handleComplete() {
    if (completing || confirmingPickupPrep) {
      return;
    }
    const currentPayment = paymentRef.current;
    const valid = applyCheckoutValidation(
      runCheckoutValidation({
        requirePayment: true,
        requireCaptcha: true,
      }),
      true,
    );
    if (!valid) {
      return;
    }
    if (currentPayment !== "cash" && currentPayment !== "sbp") {
      return;
    }
    if (currentPayment === "sbp" && draft.currency === SBP_UNSUPPORTED_CURRENCY) {
      return;
    }
    setCompleteError(null);
    setCompleting(true);
    try {
      await flushCheckoutDraft();
      const { response, payload } = await postCompleteReservation({
        locale,
        payment: currentPayment,
        legalAccepted: legalRef.current,
        captchaToken,
      });
      if (response.status === 409 && payload.suggestedPickupAtLocal) {
        setPickupPrepLocal(payload.suggestedPickupAtLocal);
        setPickupPrepKind(
          payload.reason === "bosphorus-day-cutoff" ? "bosphorus" : "transfer",
        );
        return;
      }
      if (!response.ok || payload.ok !== true) {
        if (payload.reason === "captcha" || response.status === 429) {
          setCaptchaToken(null);
          setCaptchaError(checkoutCopy[locale].captchaRequired);
          setCashCaptchaInstance((value) => value + 1);
        }
        setCompleteError(resolveCompleteError(locale, response.status, payload));
        return;
      }
      if (payload.next === "payment" || currentPayment === "sbp") {
        router.push(`/${locale}${bookingPaymentPath}`);
        return;
      }
      router.push(`/${locale}${bookingSuccessPath}`);
    } catch {
      setCompleteError(checkoutCopy[locale].completeServerError);
    } finally {
      setCompleting(false);
    }
  }

  async function handleConfirmPickupPrep() {
    if (!pickupPrepLocal || completing || confirmingPickupPrep) {
      return;
    }
    if (pickupPrepKind === "bosphorus") {
      setCompleteError(null);
      setConfirmingPickupPrep(true);
      try {
        const response = await fetch("/api/booking/draft/selected", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale, localDateTime: pickupPrepLocal }),
        });
        if (!response.ok) {
          setCompleteError(checkoutCopy[locale].completeServerError);
          return;
        }
        const payload = (await response.json()) as { draft?: BookingDraftView };
        if (payload.draft) {
          onDraftChange(payload.draft);
        }
        setPickupPrepLocal(null);
        setPickupPrepKind(null);
      } catch {
        setCompleteError(checkoutCopy[locale].completeServerError);
      } finally {
        setConfirmingPickupPrep(false);
      }
      return;
    }

    const currentPayment = paymentRef.current;
    if (currentPayment !== "cash" && currentPayment !== "sbp") {
      return;
    }
    if (currentPayment === "sbp" && draft.currency === SBP_UNSUPPORTED_CURRENCY) {
      return;
    }
    setCompleteError(null);
    setConfirmingPickupPrep(true);
    try {
      const { response, payload } = await postCompleteReservation({
        locale,
        payment: currentPayment,
        legalAccepted: legalRef.current,
        captchaToken: captchaTokenRef.current,
        acceptAdjustedPickup: true,
        expectedPickupAtLocal: pickupPrepLocal,
      });
      if (
        response.status === 409 &&
        payload.reason === "pickup-prep-stale" &&
        payload.suggestedPickupAtLocal
      ) {
        setPickupPrepLocal(payload.suggestedPickupAtLocal);
        setPickupPrepKind("transfer");
        return;
      }
      if (!response.ok || payload.ok !== true) {
        if (payload.reason === "captcha" || response.status === 429) {
          setCaptchaToken(null);
          setCaptchaError(checkoutCopy[locale].captchaRequired);
          setCashCaptchaInstance((value) => value + 1);
        }
        setCompleteError(resolveCompleteError(locale, response.status, payload));
        setPickupPrepLocal(null);
        setPickupPrepKind(null);
        return;
      }
      setPickupPrepLocal(null);
      setPickupPrepKind(null);
      if (payload.next === "payment" || currentPayment === "sbp") {
        router.push(`/${locale}${bookingPaymentPath}`);
        return;
      }
      router.push(`/${locale}${bookingSuccessPath}`);
    } catch {
      setCompleteError(checkoutCopy[locale].completeServerError);
      setPickupPrepLocal(null);
      setPickupPrepKind(null);
    } finally {
      setConfirmingPickupPrep(false);
    }
  }

  function dismissPickupPrepDialog() {
    if (confirmingPickupPrep) {
      return;
    }
    setPickupPrepLocal(null);
    setPickupPrepKind(null);
  }

  function handleBosphorusChooseAnotherDate() {
    if (confirmingPickupPrep) {
      return;
    }
    setPickupPrepLocal(null);
    setPickupPrepKind(null);
    if (onChooseAnotherDate) {
      onChooseAnotherDate();
      return;
    }
    onBack();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(BOSPHORUS_OPEN_DATE_EVENT));
    }, 50);
  }

  const totalLabel =
    draft.appliedVehicleTotal !== null
      ? formatCurrencyPill(draft.currency, draft.appliedVehicleTotal, locale)
      : "—";
  const sbpFxRates = checkoutFxRates(draft);
  const isBosphorus = isBosphorusDinnerTour(draft.serviceType, draft.tourCode);
  const backLabel = isBosphorus
    ? bosphorusDinnerCopy[locale].backToSelection
    : copy.backToVehicles;

  return (
    <div className="booking-checkout">
      <button type="button" className="booking-back checkout-back" onClick={onBack}>
        {backLabel}
      </button>
      <div className="checkout-layout">
        <CheckoutSummary locale={locale} draft={draft} />
        <div className="checkout-main">
            <>
          <CheckoutContact
            locale={locale}
            email={email}
            emailError={emailError}
            phoneCountry={phoneCountry}
            phoneNational={phoneNational}
            phoneError={phoneError}
            onEmailChange={(value) => {
              emailRef.current.value = value;
              emailRef.current.dirty = true;
              setEmail(value);
              setEmailDirty(true);
              queueEmail(value);
              syncEmailError(value, false);
            }}
            onEmailBlur={() => {
              const { value } = emailRef.current;
              emailRef.current.dirty = true;
              setEmailDirty(true);
              window.clearTimeout(emailTimer.current);
              syncEmailError(value, true);
              void saveContact({ email: value });
            }}
            onPhoneCountryChange={(iso2) => {
              const formatted = formatNationalInput(iso2, phoneNational);
              phoneRef.current.country = iso2;
              phoneRef.current.national = formatted;
              setPhoneCountry(iso2);
              setPhoneNational(formatted);
              window.clearTimeout(phoneTimer.current);
              syncPhoneError(iso2, formatted, false);
              void saveContact({ phoneCountryCode: iso2, phoneNational: formatted });
            }}
            onPhoneNationalChange={(value) => {
              phoneRef.current.national = value;
              phoneRef.current.dirty = true;
              setPhoneNational(value);
              setPhoneDirty(true);
              queuePhone(phoneCountry, value);
              syncPhoneError(phoneCountry, value, false);
            }}
            onPhoneBlur={() => {
              const { country, national } = phoneRef.current;
              phoneRef.current.dirty = true;
              setPhoneDirty(true);
              window.clearTimeout(phoneTimer.current);
              if (country) {
                syncPhoneError(country, national, true);
              }
              void saveContact({
                phoneCountryCode: country,
                phoneNational: national,
              });
            }}
          />
          <div className="checkout-card glass-surface">
            <CheckoutPassengerForm
              locale={locale}
              title={copy.mainPassengerTitle}
              required
              idPrefix="main"
              value={main}
              fieldErrors={mainErrors}
              onChange={(next) => {
                mainRef.current = next;
                setMain(next);
                setMainErrors((current) => ({
                  countryCode: next.countryCode ? null : current.countryCode,
                  firstName: next.firstName.trim() ? null : current.firstName,
                  lastName: next.lastName.trim() ? null : current.lastName,
                }));
              }}
              onPersist={(value) => {
                window.clearTimeout(passengerTimers.current[1]);
                void savePassenger(1, value);
              }}
              onRequiredBlur={(field) => {
                const passenger = mainRef.current;
                const missing =
                  field === "countryCode"
                    ? !passenger.countryCode
                    : field === "firstName"
                      ? !passenger.firstName.trim()
                      : !passenger.lastName.trim();
                if (!missing) {
                  return;
                }
                setMainErrors((current) => ({ ...current, [field]: copy.required }));
              }}
            />
          </div>
          {extraCount > 0 ? (
            <CheckoutOtherPassengers
              locale={locale}
              sequences={extraSequences}
              mode={mode}
              openSequence={openSequence}
              values={extras}
              onModeChange={(next) => {
                if (next === "now" && mode !== "now") {
                  setOpenSequence(firstIncompleteExtraSequence(extraSequences, extras));
                }
                setMode(next);
              }}
              onToggle={(sequence) =>
                setOpenSequence((current) => (current === sequence ? null : sequence))
              }
              onChange={(sequence, value) => {
                setExtras((current) => {
                  const next = { ...current };
                  next[sequence] = value;
                  return next;
                });
              }}
              onPersist={(sequence, value) => {
                window.clearTimeout(passengerTimers.current[sequence]);
                if (
                  !value.countryCode &&
                  !value.identityNumber.trim() &&
                  !value.firstName.trim() &&
                  !value.lastName.trim()
                ) {
                  return;
                }
                void savePassenger(sequence, value);
              }}
            />
          ) : null}
          <section className="checkout-card glass-surface" aria-labelledby="checkout-notes-title">
            <h2 id="checkout-notes-title" className="checkout-card-title">
              {copy.notesTitle}
            </h2>
            <label className="checkout-field">
              <span className="sr-only">{copy.notesTitle}</span>
              <textarea
                className="checkout-textarea"
                rows={4}
                value={notes}
                placeholder={copy.notesPlaceholder}
                onChange={(event) => {
                  setNotes(event.target.value);
                  queueNotes(event.target.value);
                }}
                onBlur={() => {
                  window.clearTimeout(notesTimer.current);
                  void saveContact({ notes });
                }}
              />
            </label>
          </section>
          <CheckoutLegal
            locale={locale}
            accepted={legalAccepted}
            error={legalError}
            onAcceptedChange={(accepted) => {
              legalRef.current = accepted;
              setLegalAccepted(accepted);
              if (accepted) {
                setLegalError(null);
              }
            }}
          />
          {draft.editMode ? (
            <EditFinalizePanel
              locale={locale}
              draft={draft}
              homeHref={`/${locale}`}
              onValidateBeforeCommit={async () => {
                const valid = applyCheckoutValidation(
                  runCheckoutValidation({
                    requirePayment: false,
                    requireCaptcha: false,
                  }),
                  true,
                );
                if (!valid) {
                  return false;
                }
                await flushCheckoutDraft();
                return true;
              }}
            />
          ) : (
            <>
              <CheckoutPayment
                locale={locale}
                method={payment}
                currency={draft.currency}
                totalEur={draft.appliedVehicleTotalEur}
                fxRates={sbpFxRates}
                captchaInstance={cashCaptchaInstance}
                paymentError={paymentError}
                captchaError={captchaError}
                currencyBusy={currencyBusy}
                onMethodChange={changePayment}
                onCurrencyChange={(code) => void changeSbpCurrency(code)}
                onCaptchaTokenChange={(token) => {
                  setCaptchaToken(token);
                  if (token) {
                    setCaptchaError(null);
                  }
                }}
              />
              <CheckoutCompleteCta
                locale={locale}
                total={totalLabel}
                loading={completing || confirmingPickupPrep}
                disabled={
                  payment === "sbp" && draft.currency === SBP_UNSUPPORTED_CURRENCY
                }
                paymentMethod={payment}
                completedCode={null}
                error={completeError}
                onComplete={() => void handleComplete()}
              />
            </>
          )}
            </>
        </div>
      </div>
      {pickupPrepLocal && pickupPrepKind === "bosphorus" ? (
        <CheckoutPickupPrepDialog
          title={copy.bosphorusCutoffTitle}
          body={copy.bosphorusCutoffBody}
          backLabel={copy.bosphorusCutoffChooseDate}
          confirmLabel={
            confirmingPickupPrep
              ? bosphorusCutoffConfirmLabel(locale, pickupPrepLocal, "confirming")
              : bosphorusCutoffConfirmLabel(locale, pickupPrepLocal, "confirm")
          }
          confirming={confirmingPickupPrep}
          onBack={handleBosphorusChooseAnotherDate}
          onConfirm={() => void handleConfirmPickupPrep()}
        />
      ) : null}
      {pickupPrepLocal && pickupPrepKind === "transfer" ? (
        <CheckoutPickupPrepDialog
          title={copy.pickupPrepTitle}
          body={pickupPrepCopy(locale, pickupPrepLocal, "body")}
          backLabel={copy.pickupPrepBack}
          confirmLabel={
            confirmingPickupPrep
              ? pickupPrepCopy(locale, pickupPrepLocal, "confirming")
              : pickupPrepCopy(locale, pickupPrepLocal, "confirm")
          }
          confirming={confirmingPickupPrep}
          onBack={dismissPickupPrepDialog}
          onConfirm={() => void handleConfirmPickupPrep()}
        />
      ) : null}
    </div>
  );
}
