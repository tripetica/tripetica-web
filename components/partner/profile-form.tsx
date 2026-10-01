"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { fromStoredPhone } from "@/lib/booking/phone";
import { PhoneField } from "@/components/booking/phone-field";
import { PartnerPasswordField } from "@/components/partner/password-field";
import { PartnerPasswordForm } from "@/components/partner/password-form";
import { countryName } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import {
  partnerSendEmailChangeCodeAction,
  partnerUpdateProfileAction,
  partnerVerifyEmailChangeAction,
  type PartnerEmailCodeState,
  type PartnerProfileState,
} from "@/lib/partner/actions";
import {
  normalizePartnerAddress,
  normalizePartnerPersonName,
  normalizePartnerTaxOffice,
} from "@/lib/partner/application-fields";
import { joinPartnerContactName } from "@/lib/partner/contact-name";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type PartnerSelfProfile } from "@/lib/partner/profile";

type PartnerProfileFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  profile: PartnerSelfProfile;
  authoritySection?: ReactNode;
};

type ProfileDraft = {
  addressLine: string;
  taxOffice: string;
  contactName: string;
  phoneCountry: string;
  phoneNational: string;
};

type EditableField = "address" | "taxOffice" | "contact" | "phone";

const PROFILE_ERROR_COPY: Record<
  Exclude<PartnerProfileState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-contact": "invalidContact",
  "invalid-phone": "invalidPhone",
  "invalid-address": "invalidAddress",
  "invalid-tax-office": "invalidTaxOffice",
  failed: "profileSaveFailed",
};

const EMAIL_ERROR_COPY: Record<
  Exclude<PartnerEmailCodeState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-email": "invalidEmail",
  invalid: "verificationInvalid",
  expired: "verificationExpired",
  used: "verificationUsed",
  locked: "verificationLocked",
  "email-mismatch": "unverifiedEmail",
  throttled: "verificationThrottled",
  "mail-failed": "verificationMailFailed",
  duplicate: "emailTaken",
  "current-invalid": "currentPasswordInvalid",
  mismatch: "emailConfirmMismatch",
  "same-email": "emailUnchanged",
  "not-found": "passwordResetNotFound",
  pending: "pendingLogin",
  inactive: "inactiveLogin",
  failed: "verificationFailed",
};

function businessTypeLabel(value: PartnerSelfProfile["businessType"], copy: PartnerCopy) {
  if (value === "individual") {
    return copy.businessIndividual;
  }
  if (value === "company") {
    return copy.businessCompany;
  }
  return "—";
}

function draftFromProfile(profile: PartnerSelfProfile): ProfileDraft {
  const storedPhone = fromStoredPhone(profile.phoneCountryCode, profile.phone);
  return {
    addressLine: profile.addressLine ?? "",
    taxOffice: profile.taxOffice ?? "",
    contactName: joinPartnerContactName(profile.contactFirstName, profile.contactLastName),
    phoneCountry: storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE,
    phoneNational: storedPhone.national,
  };
}

function draftsEqual(left: ProfileDraft, right: ProfileDraft) {
  return (
    normalizePartnerAddress(left.addressLine) === normalizePartnerAddress(right.addressLine) &&
    normalizePartnerTaxOffice(left.taxOffice) === normalizePartnerTaxOffice(right.taxOffice) &&
    normalizePartnerPersonName(left.contactName) ===
      normalizePartnerPersonName(right.contactName) &&
    left.phoneCountry === right.phoneCountry &&
    left.phoneNational.replace(/\D/g, "") === right.phoneNational.replace(/\D/g, "")
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

function ProfileRow({
  label,
  editLabel,
  editable,
  editing,
  onEdit,
  children,
}: {
  label: string;
  editLabel?: string;
  editable?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="partner-profile-row">
      <div className="partner-profile-row-head">
        <p className="partner-billing-label">{label}</p>
        {editable ? (
          <button
            type="button"
            className="partner-edit-btn"
            aria-label={editLabel}
            aria-pressed={editing}
            onClick={onEdit}
          >
            <PencilIcon />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function PartnerProfileForm({ locale, copy, profile, authoritySection }: PartnerProfileFormProps) {
  const baseline = useMemo(() => draftFromProfile(profile), [profile]);
  const [draft, setDraft] = useState(baseline);
  const [editing, setEditing] = useState<Partial<Record<EditableField, boolean>>>({});
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileState, saveProfile, saving] = useActionState<PartnerProfileState, FormData>(
    async (prev, formData) => {
      const result = await partnerUpdateProfileAction(prev, formData);
      if (result.ok) {
        setEditing({});
      }
      return result;
    },
    { error: null, ok: false },
  );
  const [sendState, sendCode, sending] = useActionState<PartnerEmailCodeState, FormData>(
    partnerSendEmailChangeCodeAction,
    { error: null, ok: false },
  );
  const [verifyState, verifyCode, verifying] = useActionState<PartnerEmailCodeState, FormData>(
    async (prev, formData) => {
      const result = await partnerVerifyEmailChangeAction(prev, formData);
      if (result.verified) {
        setEmailOpen(false);
      }
      return result;
    },
    { error: null, ok: false },
  );
  const dirty = !draftsEqual(draft, baseline);
  const codeSent = Boolean(sendState.sent);
  const emailChanged = Boolean(verifyState.verified);

  function toggleEdit(field: EditableField) {
    setEditing((current) => ({ ...current, [field]: !current[field] }));
  }

  return (
    <section className="partner-billing-card partner-profile-card" aria-labelledby="partner-profile-title">
        <form action={saveProfile} className="partner-profile-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="phoneCountryCode" value={draft.phoneCountry} />
          <input type="hidden" name="phoneNational" value={draft.phoneNational} />
          <input type="hidden" name="addressLine" value={draft.addressLine} />
          <input type="hidden" name="taxOffice" value={draft.taxOffice} />
          <input type="hidden" name="contactName" value={draft.contactName} />

          <ProfileRow label={copy.businessType}>
            <p className="partner-billing-value">{businessTypeLabel(profile.businessType, copy)}</p>
          </ProfileRow>

          <ProfileRow
            label={
              profile.businessType === "individual"
                ? copy.legalNameIndividual
                : copy.legalNameCompany
            }
          >
            <p className="partner-billing-value">{profile.name}</p>
          </ProfileRow>

          <ProfileRow
            label={copy.address}
            editable
            editing={editing.address}
            editLabel={`${copy.editField}: ${copy.address}`}
            onEdit={() => toggleEdit("address")}
          >
            {editing.address ? (
              <div className="ops-field">
                <textarea
                  rows={3}
                  value={draft.addressLine}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, addressLine: event.target.value }))
                  }
                />
              </div>
            ) : (
              <p className="partner-billing-value">{draft.addressLine || "—"}</p>
            )}
          </ProfileRow>

          <ProfileRow label={copy.country}>
            <p className="partner-billing-value">
              {countryName(profile.countryCode, locale) ?? profile.countryCode ?? "—"}
            </p>
          </ProfileRow>

          <ProfileRow
            label={copy.taxOffice}
            editable
            editing={editing.taxOffice}
            editLabel={`${copy.editField}: ${copy.taxOffice}`}
            onEdit={() => toggleEdit("taxOffice")}
          >
            {editing.taxOffice ? (
              <div className="ops-field">
                <input
                  value={draft.taxOffice}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, taxOffice: event.target.value }))
                  }
                />
              </div>
            ) : (
              <p className="partner-billing-value">{draft.taxOffice || "—"}</p>
            )}
          </ProfileRow>

          <ProfileRow label={copy.taxNumber}>
            <p className="partner-billing-value">{profile.taxNumber || "—"}</p>
          </ProfileRow>

          <ProfileRow
            label={copy.contactFullName}
            editable
            editing={editing.contact}
            editLabel={`${copy.editField}: ${copy.contactFullName}`}
            onEdit={() => toggleEdit("contact")}
          >
            {editing.contact ? (
              <div className="ops-field">
                <input
                  autoComplete="name"
                  value={draft.contactName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, contactName: event.target.value }))
                  }
                />
              </div>
            ) : (
              <p className="partner-billing-value">{draft.contactName || "—"}</p>
            )}
          </ProfileRow>

          <ProfileRow
            label={copy.phoneNumber}
            editable
            editing={editing.phone}
            editLabel={`${copy.editField}: ${copy.phoneNumber}`}
            onEdit={() => toggleEdit("phone")}
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
              <p className="partner-billing-value">
                {draft.phoneNational || profile.phone || "—"}
              </p>
            )}
          </ProfileRow>

          {profileState.ok && !dirty ? (
            <p className="ops-form-ok" role="status">
              {copy.profileSaved}
            </p>
          ) : null}
          {profileState.error ? (
            <p className="ops-form-error" role="alert">
              {copy[PROFILE_ERROR_COPY[profileState.error]]}
            </p>
          ) : null}
          {dirty ? (
            <div className="partner-profile-actions">
              <button type="submit" className="ops-btn-primary" disabled={saving}>
                {saving ? copy.savingProfile : copy.saveProfile}
              </button>
            </div>
          ) : null}
        </form>

        <div className="partner-profile-account">
          <ProfileRow
            label={copy.emailAddress}
            editable
            editing={emailOpen}
            editLabel={`${copy.editField}: ${copy.emailAddress}`}
            onEdit={() => setEmailOpen((current) => !current)}
          >
            <p className="partner-billing-value">{profile.email}</p>
          </ProfileRow>

          {emailOpen ? (
            <form className="partner-email-form partner-profile-panel">
              <input type="hidden" name="locale" value={locale} />
              <label className="ops-field">
                <span>{copy.newEmail}</span>
                <input type="email" name="newEmail" autoComplete="email" required />
              </label>
              <label className="ops-field">
                <span>{copy.confirmNewEmail}</span>
                <input type="email" name="confirmNewEmail" autoComplete="email" required />
              </label>
              <PartnerPasswordField
                label={copy.currentPassword}
                name="currentPassword"
                autoComplete="current-password"
                required
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
              />
              {sendState.sent ? (
                <p className="ops-form-ok" role="status">
                  {copy.verificationCodeSent}
                </p>
              ) : null}
              {codeSent ? (
                <label className="ops-field">
                  <span>{copy.verificationCode}</span>
                  <input
                    className="partner-code-input"
                    name="verificationCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    maxLength={6}
                    pattern="\d{6}"
                  />
                </label>
              ) : null}
              {sendState.error ? (
                <p className="ops-form-error" role="alert">
                  {copy[EMAIL_ERROR_COPY[sendState.error]]}
                </p>
              ) : null}
              {verifyState.error ? (
                <p className="ops-form-error" role="alert">
                  {copy[EMAIL_ERROR_COPY[verifyState.error]]}
                </p>
              ) : null}
              <div className="partner-profile-actions">
                <button
                  type="submit"
                  className="ops-btn-secondary"
                  formAction={sendCode}
                  disabled={sending || verifying}
                >
                  {sending ? copy.sendingCode : copy.sendVerificationCode}
                </button>
                {codeSent ? (
                  <button
                    type="submit"
                    className="ops-btn-primary"
                    formAction={verifyCode}
                    disabled={sending || verifying || emailChanged}
                  >
                    {verifying ? copy.verifyingCode : copy.verifyCode}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ops-btn-ghost"
                  onClick={() => setEmailOpen(false)}
                >
                  {copy.cancelEdit}
                </button>
              </div>
            </form>
          ) : null}

          {emailChanged ? (
            <p className="ops-form-ok" role="status">
              {copy.emailChanged}
            </p>
          ) : null}

          {authoritySection}

          <div className="partner-password-trigger">
            {passwordOpen ? (
              <div className="partner-password-panel partner-profile-panel">
                <PartnerPasswordForm locale={locale} copy={copy} mode="optional" />
                <button
                  type="button"
                  className="ops-btn-ghost"
                  onClick={() => setPasswordOpen(false)}
                >
                  {copy.cancelEdit}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="ops-btn-secondary"
                onClick={() => setPasswordOpen(true)}
              >
                {copy.changePasswordSubmit}
              </button>
            )}
          </div>
        </div>
      </section>
  );
}
