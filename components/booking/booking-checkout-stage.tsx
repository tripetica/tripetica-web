"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckoutCompleteCta } from "@/components/booking/checkout-complete-cta";
import { CheckoutContact } from "@/components/booking/checkout-contact";
import { CheckoutLegal } from "@/components/booking/checkout-legal";
import {
  CheckoutOtherPassengers,
} from "@/components/booking/checkout-other-passengers";
import {
  CheckoutPassengerForm,
  emptyPassengerForm,
  firstIncompleteExtraSequence,
  isPassengerFormComplete,
  type PassengerFieldErrors,
  type PassengerFormValue,
} from "@/components/booking/checkout-passenger-form";
import { CheckoutPayment } from "@/components/booking/checkout-payment";
import { CheckoutSummary } from "@/components/booking/checkout-summary";
import {
  checkoutCanComplete,
  type CheckoutPaymentMethod,
} from "@/lib/booking/checkout-complete";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { type BookingDraftView, type BookingPassengerView } from "@/lib/booking/draft-view";
import { emailValidity, formatNationalInput, fromStoredPhone, phoneValidity } from "@/lib/booking/phone";
import { formatCurrencyPill } from "@/lib/booking/pricing/format-eur";
import { type Locale } from "@/lib/i18n/config";

type ExtraMode = "now" | "later";
type CheckoutScrollField =
  | "email"
  | "phone"
  | "nationality"
  | "firstName"
  | "lastName"
  | "legal";

const CHECKOUT_FIELD_IDS: Record<CheckoutScrollField, string> = {
  email: "checkout-email",
  phone: "checkout-phone",
  nationality: "main-nationality-field",
  firstName: "main-first",
  lastName: "main-last",
  legal: "checkout-legal",
};

type BookingCheckoutStageProps = {
  locale: Locale;
  draft: BookingDraftView;
  onDraftChange: (draft: BookingDraftView) => void;
  onBack: () => void;
};

function passengerFromDraft(
  passengers: BookingPassengerView[],
  sequence: number,
) {
  return emptyPassengerForm(
    passengers.find((item) => item.sequenceNo === sequence) ?? null,
  );
}

function extrasFromDraft(
  sequences: number[],
  passengers: BookingPassengerView[],
) {
  return Object.fromEntries(
    sequences.map((sequence) => [sequence, passengerFromDraft(passengers, sequence)]),
  );
}

export function BookingCheckoutStage({
  locale,
  draft,
  onDraftChange,
  onBack,
}: BookingCheckoutStageProps) {
  const copy = checkoutCopy[locale];
  const storedPhone = fromStoredPhone(draft.customerCountryCode, draft.customerPhone);
  const extraCount = Math.max(0, (draft.applied.passengerCount ?? 1) - 1);
  const extraSequences = useMemo(
    () => Array.from({ length: extraCount }, (_, index) => index + 2),
    [extraCount],
  );
  const hasSavedExtras = draft.passengers.some((item) => item.sequenceNo > 1);

  const [email, setEmail] = useState(draft.customerEmail ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailDirty, setEmailDirty] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<string | null>(storedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(storedPhone.national);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneDirty, setPhoneDirty] = useState(false);
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [main, setMain] = useState(() => passengerFromDraft(draft.passengers, 1));
  const [extras, setExtras] = useState<Record<number, PassengerFormValue>>(() =>
    extrasFromDraft(extraSequences, draft.passengers),
  );
  const [mode, setMode] = useState<ExtraMode | null>(hasSavedExtras ? "now" : null);
  const [openSequence, setOpenSequence] = useState<number | null>(() =>
    hasSavedExtras
      ? firstIncompleteExtraSequence(
          extraSequences,
          extrasFromDraft(extraSequences, draft.passengers),
        )
      : null,
  );
  const [payment, setPayment] = useState<CheckoutPaymentMethod | null>(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [cashCaptchaInstance, setCashCaptchaInstance] = useState(0);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [mainErrors, setMainErrors] = useState<PassengerFieldErrors>({});
  const persistSeq = useRef(0);
  const emailTimer = useRef<number>(0);
  const phoneTimer = useRef<number>(0);
  const notesTimer = useRef<number>(0);
  const passengerTimers = useRef<Record<number, number>>({});
  const emailRef = useRef({ value: email, dirty: emailDirty });
  emailRef.current.value = email;
  emailRef.current.dirty = emailDirty;
  const phoneRef = useRef({
    country: phoneCountry,
    national: phoneNational,
    dirty: phoneDirty,
  });
  phoneRef.current.country = phoneCountry;
  phoneRef.current.national = phoneNational;
  phoneRef.current.dirty = phoneDirty;
  const mainRef = useRef(main);
  mainRef.current = main;
  const legalRef = useRef(legalAccepted);
  legalRef.current = legalAccepted;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    setExtras((current) => {
      let changed = false;
      const next = { ...current };
      for (const sequence of extraSequences) {
        if (next[sequence] == null) {
          next[sequence] = passengerFromDraft(draft.passengers, sequence);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [draft.passengers, extraSequences]);

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

  function emailErrorMessage(value: string) {
    const status = emailValidity(value);
    if (status === "empty") {
      return copy.required;
    }
    if (status === "invalid") {
      return copy.emailInvalid;
    }
    return null;
  }

  function phoneErrorMessage(country: string | null, national: string) {
    const status = phoneValidity(country, national);
    if (status === "valid") {
      return null;
    }
    if (!country || status === "empty") {
      return copy.required;
    }
    return copy.phoneInvalid;
  }

  function syncEmailError(value: string, force: boolean) {
    const message = emailErrorMessage(value);
    setEmailError((current) => (force || current ? message : current));
  }

  function syncPhoneError(country: string | null, national: string, force: boolean) {
    const message = phoneErrorMessage(country, national);
    setPhoneError((current) => (force || current ? message : current));
  }

  function phoneIsValid(country: string | null, national: string) {
    return phoneValidity(country, national) === "valid";
  }

  function revealCheckoutErrors(): CheckoutScrollField | null {
    const emailMessage = emailErrorMessage(emailRef.current.value);
    const phoneMessage = phoneErrorMessage(phoneRef.current.country, phoneRef.current.national);
    const passenger = mainRef.current;
    const countryMessage = passenger.countryCode ? null : copy.required;
    const firstMessage = passenger.firstName.trim() ? null : copy.required;
    const lastMessage = passenger.lastName.trim() ? null : copy.required;
    const consentMessage = legalRef.current ? null : copy.legalRequired;
    setEmailError(emailMessage);
    setPhoneError(phoneMessage);
    setMainErrors({
      countryCode: countryMessage,
      firstName: firstMessage,
      lastName: lastMessage,
    });
    setLegalError(consentMessage);
    if (emailMessage) {
      return "email";
    }
    if (phoneMessage) {
      return "phone";
    }
    if (countryMessage) {
      return "nationality";
    }
    if (firstMessage) {
      return "firstName";
    }
    if (lastMessage) {
      return "lastName";
    }
    if (consentMessage) {
      return "legal";
    }
    return null;
  }

  function changePayment(next: CheckoutPaymentMethod) {
    const firstInvalid = revealCheckoutErrors();
    if (firstInvalid) {
      document
        .getElementById(CHECKOUT_FIELD_IDS[firstInvalid])
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (next === payment) {
      return;
    }
    if (next === "cash") {
      setCashCaptchaInstance((value) => value + 1);
    }
    setPayment(next);
    setCaptchaVerified(false);
  }

  const totalLabel =
    draft.appliedVehicleTotal !== null
      ? formatCurrencyPill(draft.currency, draft.appliedVehicleTotal, locale)
      : "—";
  const canComplete = checkoutCanComplete({
    emailValid: emailValidity(email) === "valid",
    phoneValid: phoneIsValid(phoneCountry, phoneNational),
    mainPassengerComplete: isPassengerFormComplete(main),
    payment,
    legalAccepted,
    captchaVerified,
  });

  return (
    <div className="booking-checkout">
      <button type="button" className="booking-back checkout-back" onClick={onBack}>
        {copy.backToVehicles}
      </button>
      <div className="checkout-layout">
        <CheckoutSummary locale={locale} draft={draft} />
        <div className="checkout-main">
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
          <CheckoutPayment
            locale={locale}
            method={payment}
            captchaInstance={cashCaptchaInstance}
            onMethodChange={changePayment}
            onCaptchaChange={setCaptchaVerified}
          />
          <CheckoutCompleteCta locale={locale} total={totalLabel} enabled={canComplete} />
        </div>
      </div>
    </div>
  );
}
