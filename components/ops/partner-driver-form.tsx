"use client";

import { type DriverMembershipStatus } from "@/lib/ops/driver-membership";

import { useActionState, useState } from "react";
import { PhoneField } from "@/components/booking/phone-field";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { UetdsCompanySelect } from "@/components/ops/uetds-company-select";
import {
  DriverUetdsSubscriptionSection,
  driverSubscriptionDraftEquals,
  driverSubscriptionDraftFromState,
  type DriverSubscriptionDraft,
} from "@/components/uetds/driver-uetds-subscription-section";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { type UetdsDriverSubscriptionState } from "@/lib/uetds/driver-subscription";
import { useOpsStickyOffset } from "@/components/ops/use-ops-sticky-offset";
import { fromStoredPhone } from "@/lib/booking/phone";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  activateOpsPartnerDriverAction,
  deactivateOpsPartnerDriverAction,
  deleteOpsPartnerDriverAction,
  updateOpsPartnerDriverAction,
  type OpsFleetFormState,
} from "@/lib/ops/partner-fleet-actions";
import { partnerStatusBadgeClass, partnerStatusLabel } from "@/lib/ops/partner-labels";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { formatPartnerDriverLanguagesFull } from "@/lib/partner/driver-languages";
import { type PartnerDriverRecord } from "@/lib/partner/fleet-view";

type PartnerDriverFormProps = {
  locale: Locale;
  copy: OpsCopy;
  driver: PartnerDriverRecord;
  activeUetdsCompanies: readonly UetdsCompanyRef[];
  subscription: UetdsDriverSubscriptionState;
  membership?: DriverMembershipStatus;
  canManage: boolean;
  linkedPartner?: { id: string; name: string; code: string };
  backHref?: string;
  returnTo?: "ops-drivers" | "partner";
};

function fleetError(error: OpsFleetFormState["error"], copy: OpsCopy, fallback: string) {
  if (error === "forbidden") {
    return copy.forbidden;
  }
  if (error === "invalid-name") {
    return `${fallback} (${copy.driverFullName})`;
  }
  if (error === "invalid-phone") {
    return `${fallback} (${copy.phone})`;
  }
  if (error === "invalid-national-id") {
    return copy.invalidNationalId;
  }
  if (error === "invalid-languages") {
    return copy.invalidLanguages;
  }
  if (error === "duplicate-national-id") {
    return copy.duplicateNationalId;
  }
  if (error === "invalid-email") {
    return copy.invalidDriverEmail;
  }
  if (error === "duplicate-email") {
    return copy.duplicateDriverEmail;
  }
  if (error === "in-use") {
    return copy.fleetInUse;
  }
  if (error === "invalid-uetds-company") {
    return copy.invalidUetdsCompany;
  }
  if (error === "invalid-subscription-fee") {
    return copy.invalidSubscriptionFee;
  }
  if (error === "invalid-subscription-currency") {
    return copy.invalidSubscriptionCurrency;
  }
  return fallback;
}

function driverStamp(driver: PartnerDriverRecord, subscription: UetdsDriverSubscriptionState) {
  return [
    driver.id,
    driver.updatedAt,
    driver.status,
    driver.fullName,
    driver.phone,
    driver.nationalId,
    driver.email,
    driver.languageCodes.join(","),
    driver.uetdsCompanyId ?? "",
    subscription.enrolled ? "1" : "0",
    subscription.enrolledAt ?? "",
    subscription.monthlyFee ?? "",
    subscription.currency ?? "",
    subscription.periods.map((p) => `${p.year}-${p.month}:${p.status}`).join(","),
  ].join(":");
}

export function PartnerDriverForm(props: PartnerDriverFormProps) {
  return (
    <PartnerDriverFormEditor
      key={`${driverStamp(props.driver, props.subscription)}:${props.membership ?? "standard"}`}
      {...props}
    />
  );
}

function PartnerDriverFormEditor({
  locale,
  copy,
  driver,
  activeUetdsCompanies,
  subscription,
  membership = "standard",
  canManage,
  linkedPartner,
  backHref,
  returnTo = "partner",
}: PartnerDriverFormProps) {
  const storedPhone = fromStoredPhone(driver.phoneCountryCode, driver.phone);
  const initial = {
    fullName: driver.fullName,
    nationalId: driver.nationalId ?? "",
    email: driver.email ?? "",
    phoneCountry: storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE,
    phoneNational: storedPhone.national,
    languages: driver.languageCodes,
    uetdsCompanyId: driver.uetdsCompanyId ?? "",
  };
  const [membershipDraft, setMembershipDraft] = useState<DriverMembershipStatus>(membership);
  const initialSubscription = driverSubscriptionDraftFromState(subscription);
  const [values, setValues] = useState(initial);
  const [baseline] = useState(initial);
  const [subscriptionDraft, setSubscriptionDraft] = useState<DriverSubscriptionDraft>(
    initialSubscription,
  );
  const [subscriptionBaseline] = useState(initialSubscription);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scrolled = useOpsStickyOffset();
  const [saveState, saveAction, savePending] = useActionState<OpsFleetFormState, FormData>(
    updateOpsPartnerDriverAction,
    { error: null, ok: false },
  );
  const [activateState, activateAction, activatePending] = useActionState<
    OpsFleetFormState,
    FormData
  >(activateOpsPartnerDriverAction, { error: null, ok: false });
  const [deactivateState, deactivateAction, deactivatePending] = useActionState<
    OpsFleetFormState,
    FormData
  >(deactivateOpsPartnerDriverAction, { error: null, ok: false });
  const [deleteState, deleteAction, deletePending] = useActionState<OpsFleetFormState, FormData>(
    deleteOpsPartnerDriverAction,
    { error: null, ok: false },
  );

  const dirty =
    values.fullName.trim() !== baseline.fullName.trim() ||
    values.nationalId.replace(/\D/g, "") !== baseline.nationalId.replace(/\D/g, "") ||
    values.email.trim().toLowerCase() !== baseline.email.trim().toLowerCase() ||
    values.phoneCountry !== baseline.phoneCountry ||
    values.phoneNational.replace(/[\s-]+/g, "") !==
      baseline.phoneNational.replace(/[\s-]+/g, "") ||
    values.languages.join(",") !== baseline.languages.join(",") ||
    values.uetdsCompanyId !== baseline.uetdsCompanyId ||
    !driverSubscriptionDraftEquals(subscriptionDraft, subscriptionBaseline) || membershipDraft !== membership;
  const panelLocale = locale === "en" || locale === "ru" ? locale : "tr";
  const resolvedBackHref =
    backHref ?? `${localizedPath(locale, `/ops/partners/${driver.partnerId}`)}?tab=drivers`;

  return (
    <section className="ops-page ops-partner-detail ops-partner-entity">
      <form action={saveAction} className="ops-partner-editor">
        <div className={scrolled ? "ops-partner-sticky is-scrolled" : "ops-partner-sticky"}>
          <div className="ops-partner-sticky-identity">
            <h1 className="ops-partner-title">
              <span>{driver.fullName}</span>
              <span className="ops-partner-title-sep" aria-hidden="true">
                -
              </span>
              <span className={`ops-status-badge ${partnerStatusBadgeClass(driver.status)}`}>
                {partnerStatusLabel(driver.status, copy)}
              </span>
            </h1>
          </div>
          <div className="ops-partner-sticky-actions">
            {canManage ? (
              <button type="submit" className="ops-btn-primary" disabled={!dirty || savePending}>
                {savePending ? copy.saving : copy.save}
              </button>
            ) : null}
            {canManage && driver.status === "inactive" ? (
              <button
                type="submit"
                formAction={activateAction}
                className="ops-btn-activate"
                disabled={dirty || activatePending}
              >
                {activatePending ? copy.activatingPartner : copy.activatePartner}
              </button>
            ) : null}
            {canManage && driver.status === "active" ? (
              <button
                type="submit"
                formAction={deactivateAction}
                className="ops-btn-cancel-soft"
                disabled={dirty || deactivatePending}
              >
                {deactivatePending ? copy.deactivatingPartner : copy.deactivatePartner}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="ops-btn-danger"
                disabled={deletePending}
                onClick={() => setDeleteOpen(true)}
              >
                {deletePending ? copy.deletingPartner : copy.deletePartner}
              </button>
            ) : null}
            <a className="ops-btn-secondary" href={resolvedBackHref}>
              {copy.back}
            </a>
          </div>
        </div>

        {linkedPartner ? (
          <div className="ops-partner-identity ops-driver-linked-partner">
            <div>
              <p className="partner-billing-label">{copy.linkedPartner}</p>
              <a href={localizedPath(locale, `/ops/partners/${linkedPartner.id}`)}>
                {linkedPartner.name}
              </a>
              <p className="ops-driver-linked-code">{linkedPartner.code}</p>
            </div>
          </div>
        ) : null}

        {saveState.ok && !dirty ? <p className="ops-form-ok">{copy.driverSaved}</p> : null}
        {saveState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(saveState.error, copy, copy.driverSaveFailed)}
          </p>
        ) : null}
        {activateState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(activateState.error, copy, copy.driverActivateFailed)}
          </p>
        ) : null}
        {deactivateState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(deactivateState.error, copy, copy.driverDeactivateFailed)}
          </p>
        ) : null}
        {deleteState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(deleteState.error, copy, copy.deleteDriverFailed)}
          </p>
        ) : null}

        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="partnerId" value={driver.partnerId} />
        <input type="hidden" name="id" value={driver.id} />
        <input type="hidden" name="phoneCountryCode" value={values.phoneCountry} />
        <input type="hidden" name="phoneNational" value={values.phoneNational} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="ops-user-form ops-partner-entity-form">
          <label className="ops-field">
            <span>{copy.driverFullName}</span>
            <input
              name="fullName"
              value={values.fullName}
              onChange={(event) =>
                setValues((current) => ({ ...current, fullName: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <label className="ops-field">
            <span>{copy.driverNationalId}</span>
            <input
              name="nationalId"
              inputMode="numeric"
              maxLength={11}
              value={values.nationalId}
              onChange={(event) =>
                setValues((current) => ({ ...current, nationalId: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <label className="ops-field">
            <span>{copy.email}</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) =>
                setValues((current) => ({ ...current, email: event.target.value }))
              }
              disabled={!canManage}
            />
          </label>
          <PhoneField
            locale={locale}
            countryCode={values.phoneCountry}
            nationalNumber={values.phoneNational}
            pickerLayout="anchored"
            onCountryChange={(next) =>
              setValues((current) => ({ ...current, phoneCountry: next }))
            }
            onNationalChange={(next) =>
              setValues((current) => ({ ...current, phoneNational: next }))
            }
          />
          <div className="ops-field">
            <span>{copy.driverLanguages}</span>
            {canManage ? (
              <LanguageMultiSelect
                locale={locale}
                value={values.languages}
                searchLabel={copy.languageSearch}
                emptyLabel={copy.languageNoResults}
                selectedLabel={copy.driverLanguages}
                onChange={(languages) => setValues((current) => ({ ...current, languages }))}
              />
            ) : (
              <p className="partner-billing-value">
                {formatPartnerDriverLanguagesFull(values.languages, locale)}
              </p>
            )}
          </div>
          <UetdsCompanySelect
            value={values.uetdsCompanyId}
            activeCompanies={activeUetdsCompanies}
            currentCompany={driver.uetdsCompany ?? null}
            fieldLabel={copy.uetdsNotifyCompany}
            noneLabel={copy.uetdsNotifyNone}
            searchPlaceholder={copy.uetdsCompanySearch}
            emptyLabel={copy.uetdsCompanyEmpty}
            disabled={!canManage}
            onChange={(uetdsCompanyId) =>
              setValues((current) => ({ ...current, uetdsCompanyId }))
            }
          />
          <DriverUetdsSubscriptionSection
            membershipControl={
              <label className="ops-field">
                <span>Üyelik Statüsü</span>
                <select name="membershipStatus" value={membershipDraft} disabled={!canManage || savePending}
                  onChange={(event) => setMembershipDraft(event.target.value as DriverMembershipStatus)}>
                  <option value="standard">Standart Üye</option>
                  <option value="gold">Gold Üye</option>
                </select>
              </label>
            }
            locale={panelLocale}
            value={subscriptionDraft}
            disabled={!canManage}
            sectionTitle={copy.uetdsSubscriptionTitle}
            enrollLabel={copy.uetdsSubscriptionEnroll}
            enrollHint={copy.uetdsSubscriptionEnrollHint}
            feeLabel={copy.uetdsSubscriptionFee}
            currencyLabel={copy.uetdsSubscriptionCurrency}
            monthsLabel={copy.uetdsSubscriptionMonths}
            statusLabels={{
              unpaid: copy.uetdsSubscriptionUnpaid,
              paid: copy.uetdsSubscriptionPaid,
              free: copy.uetdsSubscriptionFree,
            }}
            onChange={setSubscriptionDraft}
          />
        </div>
      </form>

      <form action={deleteAction} id="partner-driver-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="partnerId" value={driver.partnerId} />
        <input type="hidden" name="id" value={driver.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
      </form>

      {deleteOpen ? (
        <OpsConfirmDialog
          title={copy.deleteDriverConfirm}
          error={deleteState.error ? copy.deleteDriverFailed : null}
          pending={deletePending}
          cancelLabel={copy.deletePartnerNo}
          confirmLabel={deletePending ? copy.deletingPartner : copy.deletePartnerYes}
          confirmFormId="partner-driver-delete-form"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}
