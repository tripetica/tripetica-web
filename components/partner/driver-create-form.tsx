"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { PhoneField } from "@/components/booking/phone-field";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { UetdsCompanySelect } from "@/components/ops/uetds-company-select";
import { DriverPermissionsEditor } from "@/components/partner/driver-permissions";
import { DriverQualificationList } from "@/components/partner/driver-qualifications";
import { FleetOptionalSelect } from "@/components/partner/fleet-optional-select";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  partnerCreateDriverAction,
  type PartnerDriverFormState,
} from "@/lib/partner/driver-actions";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { newDriverPermissions } from "@/lib/driver-portal/permissions";
import { previewDriverQualificationAction } from "@/lib/partner/driver-qualification-actions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { isTurkishIdentityNumber, type QualificationDocument } from "@/lib/uetds/qualification";
import {
  authoritiesForCompany,
  type AuthorityChoice,
  type FleetChoice,
} from "@/lib/partner/fleet-pairing-rules";

type PartnerDriverCreateFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  activeUetdsCompanies: readonly UetdsCompanyRef[];
  vehicles: readonly FleetChoice[];
  authorities: readonly AuthorityChoice[];
};

type QueryState =
  | { status: "idle" | "loading" | "unverified" | "invalid" | "forbidden" }
  | { status: "verified"; documents: QualificationDocument[]; srcReady: boolean };

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
  "invalid-uetds-company": "invalidUetdsCompany",
  "invalid-fleet-pair": "invalidFleetPair",
  "invalid-edevlet-authority": "invalidEdevletAuthority",
  "qualification-src": "qualificationSrcTitle",
  "qualification-unverified": "qualificationUnverified",
  failed: "driverSaveFailed",
};

export function PartnerDriverCreateForm({
  locale,
  copy,
  activeUetdsCompanies,
  vehicles,
  authorities,
}: PartnerDriverCreateFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [state, action, pending] = useActionState<PartnerDriverFormState, FormData>(
    partnerCreateDriverAction,
    { error: null, ok: false },
  );
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(PARTNER_DEFAULT_COUNTRY_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [uetdsCompanyId, setUetdsCompanyId] = useState("");
  const [defaultVehicleId, setDefaultVehicleId] = useState("");
  const [defaultAuthorityId, setDefaultAuthorityId] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>({ status: "idle" });
  const [dialog, setDialog] = useState<"src" | "unverified" | null>(null);
  const authorityOptions = authoritiesForCompany(authorities, uetdsCompanyId);
  const identity = nationalId.replace(/\D/g, "");
  const identityValid = isTurkishIdentityNumber(identity);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = Boolean(
    fullName.trim()
    && identityValid
    && emailValid
    && phoneNational.trim()
    && languages.length > 0
    && uetdsCompanyId,
  );

  useEffect(() => {
    const request = ++requestRef.current;
    if (confirmRef.current) confirmRef.current.value = "";
    if (!ready) {
      setQueryState({ status: "idle" });
      return;
    }
    setQueryState({ status: "loading" });
    const timer = setTimeout(() => {
      const body = new FormData();
      body.set("nationalId", identity);
      body.set("companyId", uetdsCompanyId);
      void previewDriverQualificationAction(body).then((result) => {
        if (requestRef.current !== request) return;
        if (result.status === "verified") {
          setQueryState({ status: "verified", documents: result.documents, srcReady: result.srcReady });
          return;
        }
        setQueryState({ status: result.status });
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [ready, identity, uetdsCompanyId]);

  useEffect(() => {
    if (state.error === "qualification-src") setDialog("src");
    if (state.error === "qualification-unverified") setDialog("unverified");
  }, [state.error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!ready || queryState.status === "loading" || queryState.status === "idle") {
      event.preventDefault();
      setShowMissing(true);
      return;
    }
    const needsSrc = queryState.status === "verified" && !queryState.srcReady;
    const needsCheck = queryState.status !== "verified";
    const confirmed = confirmRef.current?.value ?? "";
    if (needsSrc && confirmed !== "src-missing") {
      event.preventDefault();
      setDialog("src");
      return;
    }
    if (needsCheck && confirmed !== "unverified") {
      event.preventDefault();
      setDialog("unverified");
    }
  }

  function confirmSave(kind: "src-missing" | "unverified") {
    if (confirmRef.current) confirmRef.current.value = kind;
    setDialog(null);
    formRef.current?.requestSubmit();
  }

  const documents = queryState.status === "verified" ? queryState.documents : [];
  const queryLabel = queryState.status === "loading"
    ? copy.qualificationLoading
    : queryState.status === "unverified" || queryState.status === "forbidden"
      ? copy.qualificationUnverified
      : null;

  return (
    <form id="driver-create-form" ref={formRef} action={action} className="partner-profile-form partner-fleet-form" noValidate onSubmit={submit}>
      <input type="hidden" name="locale" value={locale} />
      <input ref={confirmRef} type="hidden" name="qualificationConfirm" defaultValue="" />
      <input type="hidden" name="phoneCountryCode" value={phoneCountry} />
      <input type="hidden" name="phoneNational" value={phoneNational} />
      <label className="ops-field">
        <span>{copy.driverFullName}</span>
        <input name="fullName" autoComplete="name" required value={fullName} aria-invalid={showMissing && !fullName.trim()} onChange={(event) => setFullName(event.target.value)} />
      </label>
      <label className="ops-field">
        <span>{copy.driverNationalId}</span>
        <input
          name="nationalId"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          required
          value={nationalId}
          aria-invalid={showMissing && !identityValid}
          onChange={(event) => setNationalId(event.target.value.replace(/\D/g, "").slice(0, 11))}
        />
      </label>
      <label className="ops-field">
        <span>{copy.driverEmail}</span>
        <input name="email" type="email" autoComplete="email" required value={email} aria-invalid={showMissing && !emailValid} onChange={(event) => setEmail(event.target.value)} />
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
      <UetdsCompanySelect
        value={uetdsCompanyId}
        activeCompanies={activeUetdsCompanies}
        fieldLabel={copy.uetdsNotifyCompany}
        noneLabel={copy.uetdsNotifyNone}
        includeNone={false}
        searchPlaceholder={copy.uetdsCompanySearch}
        emptyLabel={copy.uetdsCompanyEmpty}
        onChange={(companyId) => {
          setUetdsCompanyId(companyId);
          if (!authoritiesForCompany(authorities, companyId).some((item) => item.id === defaultAuthorityId)) {
            setDefaultAuthorityId("");
          }
        }}
      />
      {showMissing && !fullName.trim() ? <p className="ops-form-error">{copy.invalidDriverName}</p> : null}
      {showMissing && !identityValid ? <p className="ops-form-error">{copy.invalidNationalId}</p> : null}
      {showMissing && !emailValid ? <p className="ops-form-error">{copy.invalidDriverEmail}</p> : null}
      {showMissing && !phoneNational.trim() ? <p className="ops-form-error">{copy.invalidPhone}</p> : null}
      {showMissing && languages.length === 0 ? <p className="ops-form-error">{copy.invalidDriverLanguages}</p> : null}
      {showMissing && !uetdsCompanyId ? <p className="ops-form-error">{copy.invalidUetdsCompany}</p> : null}
      <DriverQualificationList
        copy={copy}
        locale={locale}
        documents={documents}
        showWarning={queryState.status === "verified" && !queryState.srcReady}
        status={queryLabel}
        verifiedAt={null}
        latestFailed={false}
      />
      <FleetOptionalSelect
        name="defaultVehicleId"
        label={copy.defaultVehicle}
        value={defaultVehicleId}
        emptyLabel={copy.fleetPairNone}
        options={vehicles}
        onChange={setDefaultVehicleId}
      />
      <section className="partner-driver-permissions">
        <h2>{copy.driverPermissionsTitle}</h2>
        <DriverPermissionsEditor initial={newDriverPermissions()} copy={copy} persist={false} />
      </section>
      <FleetOptionalSelect
        name="defaultAuthorityId"
        label={copy.defaultEdevletAuthority}
        value={authorityOptions.some((item) => item.id === defaultAuthorityId) ? defaultAuthorityId : ""}
        emptyLabel={copy.fleetPairNone}
        options={authorityOptions}
        onChange={setDefaultAuthorityId}
      />
      {state.error && state.error !== "qualification-src" && state.error !== "qualification-unverified" ? (
        <p className="ops-form-error" role="alert">
          {copy[ERROR_COPY[state.error]]}
        </p>
      ) : null}
      <div className="partner-profile-actions">
        <button type="submit" className="ops-btn-primary" disabled={pending || queryState.status === "loading"}>
          {pending ? copy.savingProfile : copy.driverSave}
        </button>
        <a className="ops-btn-secondary" href={localizedPath(locale, "/partner/drivers")}>
          {copy.cancelEdit}
        </a>
      </div>
      {dialog ? (
        <OpsConfirmDialog
          title={dialog === "src" ? copy.qualificationSrcTitle : copy.qualificationUnverified}
          pending={pending}
          cancelLabel={copy.cancelEdit}
          confirmLabel={copy.qualificationSaveAnyway}
          confirmTone="positive"
          onClose={() => {
            if (confirmRef.current) confirmRef.current.value = "";
            setDialog(null);
          }}
          onConfirm={() => confirmSave(dialog === "src" ? "src-missing" : "unverified")}
        >
          <p>{dialog === "src" ? copy.qualificationSrcBody : copy.qualificationUnverifiedBody}</p>
        </OpsConfirmDialog>
      ) : null}
    </form>
  );
}
