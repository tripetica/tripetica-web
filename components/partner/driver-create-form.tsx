"use client";

import { useActionState, useState } from "react";
import { PhoneField } from "@/components/booking/phone-field";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  partnerCreateDriverAction,
  type PartnerDriverFormState,
} from "@/lib/partner/driver-actions";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { type PartnerCopy } from "@/lib/partner/copy";

type PartnerDriverCreateFormProps = {
  locale: Locale;
  copy: PartnerCopy;
};

const ERROR_COPY: Record<
  Exclude<PartnerDriverFormState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-name": "invalidDriverName",
  "invalid-national-id": "invalidNationalId",
  "invalid-phone": "invalidPhone",
  "invalid-languages": "invalidDriverLanguages",
  "duplicate-national-id": "duplicateNationalId",
  "invalid-email": "invalidDriverEmail",
  "duplicate-email": "duplicateDriverEmail",
  "not-found": "driverSaveFailed",
  "in-use": "driverSaveFailed",
  failed: "driverSaveFailed",
};

export function PartnerDriverCreateForm({ locale, copy }: PartnerDriverCreateFormProps) {
  const [state, action, pending] = useActionState<PartnerDriverFormState, FormData>(
    partnerCreateDriverAction,
    { error: null, ok: false },
  );
  const [phoneCountry, setPhoneCountry] = useState(PARTNER_DEFAULT_COUNTRY_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  return (
    <form action={action} className="partner-profile-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phoneCountryCode" value={phoneCountry} />
      <input type="hidden" name="phoneNational" value={phoneNational} />
      <label className="ops-field">
        <span>{copy.driverFullName}</span>
        <input name="fullName" autoComplete="name" required />
      </label>
      <label className="ops-field">
        <span>{copy.driverNationalId}</span>
        <input
          name="nationalId"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          required
        />
      </label>
      <label className="ops-field">
        <span>{copy.driverEmail}</span>
        <input name="email" type="email" autoComplete="email" />
      </label>
      <PhoneField
        locale={locale}
        countryCode={phoneCountry}
        nationalNumber={phoneNational}
        pickerLayout="anchored"
        onCountryChange={setPhoneCountry}
        onNationalChange={setPhoneNational}
      />
      <div className="ops-field">
        <span>{copy.driverLanguages}</span>
        <LanguageMultiSelect
          locale={locale}
          value={languages}
          searchLabel={copy.languageSearch}
          emptyLabel={copy.languageNoResults}
          selectedLabel={copy.languageSelected}
          onChange={setLanguages}
        />
      </div>
      {state.error ? (
        <p className="ops-form-error" role="alert">
          {copy[ERROR_COPY[state.error]]}
        </p>
      ) : null}
      <div className="partner-profile-actions">
        <button type="submit" className="ops-btn-primary" disabled={pending}>
          {pending ? copy.savingProfile : copy.driverSave}
        </button>
        <a className="ops-btn-secondary" href={localizedPath(locale, "/partner/drivers")}>
          {copy.cancelEdit}
        </a>
      </div>
    </form>
  );
}
