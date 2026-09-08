import { fromStoredPhone } from "@/lib/booking/phone";
import { normalizeIso2 } from "@/lib/geo/countries";
import { defaultCountryIso2ForLocale } from "@/lib/geo/locale-defaults";
import { type Locale } from "@/lib/i18n/config";
import { type BookingPassengerView } from "@/lib/booking/draft-view";

/** Serializable account profile slice for checkout prefill (no secrets). */
export type CheckoutAccountPrefill = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
};

export type CheckoutContactInitial = {
  email: string;
  phoneCountryIso2: string | null;
  phoneNational: string;
};

export type CheckoutMainPassengerInitial = {
  countryCode: string | null;
  identityNumber: string;
  firstName: string;
  lastName: string;
  gender: "female" | "male";
  /** True when first/last came from draft (not account-only fill). */
  fromDraft: boolean;
};

function nonEmpty(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

/**
 * Draft contact fields win over account profile; account fills only blanks.
 * Does not invent phone/email when both are empty.
 */
export function resolveCheckoutContactInitial(input: {
  locale: Locale;
  draftEmail: string | null | undefined;
  draftPhone: string | null | undefined;
  draftPhoneCountryCode: string | null | undefined;
  account: CheckoutAccountPrefill | null | undefined;
}): CheckoutContactInitial {
  const draftEmail = nonEmpty(input.draftEmail);
  const accountEmail = nonEmpty(input.account?.email);
  const email = draftEmail ?? accountEmail ?? "";

  const draftPhone = fromStoredPhone(
    input.draftPhoneCountryCode,
    input.draftPhone,
  );
  const accountPhone = fromStoredPhone(
    input.account?.phoneCountryCode,
    input.account?.phone,
  );

  const draftHasPhone =
    Boolean(nonEmpty(input.draftPhone)) ||
    Boolean(nonEmpty(draftPhone.national));
  const draftHasCountry = Boolean(normalizeIso2(input.draftPhoneCountryCode));

  let phoneCountryIso2: string | null;
  let phoneNational: string;

  if (draftHasPhone || draftHasCountry) {
    phoneCountryIso2 =
      normalizeIso2(draftPhone.iso2) ??
      normalizeIso2(input.draftPhoneCountryCode) ??
      null;
    phoneNational = draftPhone.national;
  } else if (
    Boolean(nonEmpty(input.account?.phone)) ||
    Boolean(nonEmpty(accountPhone.national)) ||
    Boolean(normalizeIso2(input.account?.phoneCountryCode))
  ) {
    phoneCountryIso2 =
      normalizeIso2(accountPhone.iso2) ??
      normalizeIso2(input.account?.phoneCountryCode) ??
      null;
    phoneNational = accountPhone.national;
  } else {
    phoneCountryIso2 = null;
    phoneNational = "";
  }

  return {
    email,
    phoneCountryIso2:
      phoneCountryIso2 ?? defaultCountryIso2ForLocale(input.locale),
    phoneNational,
  };
}

/**
 * Priority: draft passenger → account profile nationality → locale default country.
 * Identity/gender are only taken from draft (account profile has no such fields).
 */
export function resolveCheckoutMainPassengerInitial(input: {
  locale: Locale;
  passenger: BookingPassengerView | null | undefined;
  account: CheckoutAccountPrefill | null | undefined;
}): CheckoutMainPassengerInitial {
  const pax = input.passenger;
  const draftFirst = nonEmpty(pax?.firstName);
  const draftLast = nonEmpty(pax?.lastName);
  const accountFirst = nonEmpty(input.account?.firstName);
  const accountLast = nonEmpty(input.account?.lastName);

  const firstName = draftFirst ?? accountFirst ?? "";
  const lastName = draftLast ?? accountLast ?? "";

  const draftCountry = normalizeIso2(pax?.countryCode);
  const accountCountry = normalizeIso2(input.account?.nationalityCode);
  const countryCode =
    draftCountry ?? accountCountry ?? defaultCountryIso2ForLocale(input.locale);

  const identityNumber = nonEmpty(pax?.identityNumber) ?? "";
  const gender =
    pax?.gender === "male" || pax?.gender === "female" ? pax.gender : "female";

  return {
    countryCode,
    identityNumber,
    firstName,
    lastName,
    gender,
    fromDraft: Boolean(draftFirst || draftLast || draftCountry || identityNumber),
  };
}

export function accountActorToCheckoutPrefill(actor: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
} | null): CheckoutAccountPrefill | null {
  if (!actor) {
    return null;
  }
  return {
    firstName: nonEmpty(actor.firstName),
    lastName: nonEmpty(actor.lastName),
    email: nonEmpty(actor.email),
    phone: nonEmpty(actor.phone),
    phoneCountryCode: normalizeIso2(actor.phoneCountryCode),
    nationalityCode: normalizeIso2(actor.nationalityCode),
  };
}
