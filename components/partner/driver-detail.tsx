"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { fromStoredPhone } from "@/lib/booking/phone";
import { PhoneField } from "@/components/booking/phone-field";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  partnerActivateDriverAction,
  partnerDeactivateDriverAction,
  partnerDeleteDriverAction,
  partnerUpdateDriverAction,
  type PartnerDriverFormState,
} from "@/lib/partner/driver-actions";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { type PartnerCopy } from "@/lib/partner/copy";
import { partnerDriverDetailMode } from "@/lib/partner/driver-detail-view";
import { formatPartnerDriverLanguagesFull } from "@/lib/partner/driver-languages";
import {
  formatPartnerFleetPhone,
  type PartnerDriverRecord,
} from "@/lib/partner/fleet-view";
import { joinPartnerContactName } from "@/lib/partner/contact-name";

type PartnerDriverDetailProps = {
  locale: Locale;
  copy: PartnerCopy;
  driver: PartnerDriverRecord;
};

type DriverDraft = {
  fullName: string;
  nationalId: string;
  email: string;
  phoneCountry: string;
  phoneNational: string;
  languages: string[];
};

type EditableField = "fullName" | "nationalId" | "email" | "phone" | "languages";

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

function draftFromDriver(driver: PartnerDriverRecord): DriverDraft {
  const storedPhone = fromStoredPhone(driver.phoneCountryCode, driver.phone);
  return {
    fullName: joinPartnerContactName(driver.firstName, driver.lastName) || driver.fullName,
    nationalId: driver.nationalId ?? "",
    email: driver.email ?? "",
    phoneCountry: storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE,
    phoneNational: storedPhone.national,
    languages: driver.languageCodes,
  };
}

function draftsEqual(left: DriverDraft, right: DriverDraft) {
  return (
    left.fullName.trim().replace(/\s+/g, " ") === right.fullName.trim().replace(/\s+/g, " ") &&
    left.nationalId.replace(/\D/g, "") === right.nationalId.replace(/\D/g, "") &&
    left.email.trim().toLowerCase() === right.email.trim().toLowerCase() &&
    left.phoneCountry === right.phoneCountry &&
    left.phoneNational.replace(/\D/g, "") === right.phoneNational.replace(/\D/g, "") &&
    left.languages.join(",") === right.languages.join(",")
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <path
        d="M4 16.5V20h3.5L18.8 8.7a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0L4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14.2 6.3 17.7 9.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DetailRow({
  label,
  editLabel,
  editing,
  onEdit,
  children,
}: {
  label: string;
  editLabel: string;
  editing: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="partner-profile-row">
      <div className="partner-profile-row-head">
        <p className="partner-billing-label">{label}</p>
        <button
          type="button"
          className="partner-edit-btn"
          aria-label={editLabel}
          aria-pressed={editing}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
      </div>
      {children}
    </div>
  );
}

export function PartnerDriverDetail({ locale, copy, driver }: PartnerDriverDetailProps) {
  const baseline = useMemo(() => draftFromDriver(driver), [driver]);
  const [draft, setDraft] = useState(baseline);
  const [editing, setEditing] = useState<Partial<Record<EditableField, boolean>>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveState, saveAction, saving] = useActionState<PartnerDriverFormState, FormData>(
    async (prev, formData) => {
      const result = await partnerUpdateDriverAction(prev, formData);
      if (result.ok) {
        setEditing({});
      }
      return result;
    },
    { error: null, ok: false },
  );
  const [activateState, activateAction, activating] = useActionState(
    partnerActivateDriverAction,
    { error: null, ok: false },
  );
  const [deactivateState, deactivateAction, deactivating] = useActionState(
    partnerDeactivateDriverAction,
    { error: null, ok: false },
  );
  const [deleteState, deleteAction, deleting] = useActionState(partnerDeleteDriverAction, {
    error: null,
    ok: false,
  });
  const dirty = !draftsEqual(draft, baseline);
  const isEditing = Object.values(editing).some(Boolean);
  const mode = partnerDriverDetailMode(isEditing, dirty);
  const listHref = localizedPath(locale, "/partner/drivers");

  function discardEdits() {
    setDraft(baseline);
    setEditing({});
  }

  return (
    <section className="partner-billing-card partner-profile-card" aria-labelledby="partner-driver-title">
      <div className="partner-driver-detail-head">
        <h1 id="partner-driver-title" className="partner-driver-title">
          {driver.fullName}
        </h1>
        <span
          className={`ops-status-badge ${
            driver.status === "active" ? "is-active" : "is-inactive"
          }`}
        >
          {driver.status === "active" ? copy.driverActive : copy.driverInactive}
        </span>
      </div>

      <form action={saveAction} className="partner-profile-form">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={driver.id} />
        <input type="hidden" name="fullName" value={draft.fullName} />
        <input type="hidden" name="nationalId" value={draft.nationalId} />
        <input type="hidden" name="email" value={draft.email} />
        <input type="hidden" name="phoneCountryCode" value={draft.phoneCountry} />
        <input type="hidden" name="phoneNational" value={draft.phoneNational} />
        <input type="hidden" name="languages" value={draft.languages.join(",")} />

        <DetailRow
          label={copy.driverFullName}
          editLabel={`${copy.editField}: ${copy.driverFullName}`}
          editing={Boolean(editing.fullName)}
          onEdit={() => setEditing((current) => ({ ...current, fullName: !current.fullName }))}
        >
          {editing.fullName ? (
            <div className="ops-field">
              <input
                value={draft.fullName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
          ) : (
            <p className="partner-billing-value">{draft.fullName || "—"}</p>
          )}
        </DetailRow>

        <DetailRow
          label={copy.driverNationalId}
          editLabel={`${copy.editField}: ${copy.driverNationalId}`}
          editing={Boolean(editing.nationalId)}
          onEdit={() =>
            setEditing((current) => ({ ...current, nationalId: !current.nationalId }))
          }
        >
          {editing.nationalId ? (
            <div className="ops-field">
              <input
                inputMode="numeric"
                maxLength={11}
                value={draft.nationalId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, nationalId: event.target.value }))
                }
              />
            </div>
          ) : (
            <p className="partner-billing-value">{draft.nationalId || "—"}</p>
          )}
        </DetailRow>

        <DetailRow
          label={copy.driverEmail}
          editLabel={`${copy.editField}: ${copy.driverEmail}`}
          editing={Boolean(editing.email)}
          onEdit={() => setEditing((current) => ({ ...current, email: !current.email }))}
        >
          {editing.email ? (
            <div className="ops-field">
              <input
                type="email"
                autoComplete="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
          ) : (
            <p className="partner-billing-value">{draft.email || "—"}</p>
          )}
        </DetailRow>

        <DetailRow
          label={copy.phoneNumber}
          editLabel={`${copy.editField}: ${copy.phoneNumber}`}
          editing={Boolean(editing.phone)}
          onEdit={() => setEditing((current) => ({ ...current, phone: !current.phone }))}
        >
          {editing.phone ? (
            <PhoneField
              locale={locale}
              countryCode={draft.phoneCountry}
              nationalNumber={draft.phoneNational}
              pickerLayout="anchored"
              onCountryChange={(phoneCountry) =>
                setDraft((current) => ({ ...current, phoneCountry }))
              }
              onNationalChange={(phoneNational) =>
                setDraft((current) => ({ ...current, phoneNational }))
              }
            />
          ) : (
            <p className="partner-billing-value">{formatPartnerFleetPhone(driver.phone)}</p>
          )}
        </DetailRow>

        <DetailRow
          label={copy.driverLanguages}
          editLabel={`${copy.editField}: ${copy.driverLanguages}`}
          editing={Boolean(editing.languages)}
          onEdit={() =>
            setEditing((current) => ({ ...current, languages: !current.languages }))
          }
        >
          {editing.languages ? (
            <LanguageMultiSelect
              locale={locale}
              value={draft.languages}
              searchLabel={copy.languageSearch}
              emptyLabel={copy.languageNoResults}
              selectedLabel={copy.languageSelected}
              includeFormField={false}
              onChange={(languages) => setDraft((current) => ({ ...current, languages }))}
            />
          ) : (
            <p className="partner-billing-value">
              {formatPartnerDriverLanguagesFull(draft.languages, locale)}
            </p>
          )}
        </DetailRow>

        {saveState.ok && mode === "view" ? (
          <p className="ops-form-ok" role="status">
            {copy.driverSaved}
          </p>
        ) : null}
        {saveState.error && mode !== "view" ? (
          <p className="ops-form-error" role="alert">
            {copy[ERROR_COPY[saveState.error]]}
          </p>
        ) : null}
        {activateState.error || deactivateState.error ? (
          <p className="ops-form-error" role="alert">
            {copy.driverSaveFailed}
          </p>
        ) : null}
        {mode === "edit-dirty" ? (
          <div className="partner-profile-actions">
            <button type="submit" className="ops-btn-primary" disabled={saving}>
              {saving ? copy.savingProfile : copy.saveProfile}
            </button>
          </div>
        ) : null}
      </form>

      <div className="partner-profile-actions partner-driver-status-actions">
        {driver.status === "active" ? (
          <form action={deactivateAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={driver.id} />
            <button
              type="submit"
              className="ops-btn-cancel-soft"
              disabled={mode !== "view" || deactivating}
            >
              {copy.deactivateDriver}
            </button>
          </form>
        ) : (
          <form action={activateAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={driver.id} />
            <button
              type="submit"
              className="ops-btn-activate"
              disabled={mode !== "view" || activating}
            >
              {copy.activateDriver}
            </button>
          </form>
        )}
        <button
          type="button"
          className="ops-btn-danger"
          disabled={mode !== "view" || deleting}
          onClick={() => setDeleteOpen(true)}
        >
          {copy.deleteDriver}
        </button>
        {mode === "view" ? (
          <a className="ops-btn-secondary" href={listHref}>
            {copy.closeDriver}
          </a>
        ) : (
          <button type="button" className="ops-btn-secondary" onClick={discardEdits}>
            {copy.cancelEdit}
          </button>
        )}
      </div>

      <form action={deleteAction} id="partner-driver-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={driver.id} />
      </form>

      {deleteOpen ? (
        <OpsConfirmDialog
          title={copy.deleteDriverConfirm}
          error={deleteState.error ? copy.deleteDriverFailed : null}
          pending={deleting}
          cancelLabel={copy.cancelEdit}
          confirmLabel={deleting ? copy.deleteDriver : copy.deleteDriverYes}
          confirmFormId="partner-driver-delete-form"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}
