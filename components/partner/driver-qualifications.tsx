"use client";

import { useState, useTransition } from "react";
import { type Locale } from "@/lib/i18n/config";
import { refreshDriverQualificationAction } from "@/lib/partner/driver-qualification-actions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type DriverQualificationView, type QualificationDocument } from "@/lib/uetds/qualification";

export function DriverQualificationList({
  copy,
  locale,
  documents,
  showWarning,
  status,
  verifiedAt,
  latestFailed,
}: {
  copy: PartnerCopy;
  locale: Locale;
  documents: readonly QualificationDocument[];
  showWarning: boolean;
  status: string | null;
  verifiedAt: string | null;
  latestFailed: boolean;
}) {
  const when = verifiedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(verifiedAt))
    : null;
  return (
    <section className="driver-qualification">
      <h2>{copy.qualificationTitle}</h2>
      {status ? <p className="driver-qualification-status">{status}</p> : null}
      {documents.length > 0 ? (
        <ul className="driver-qualification-list">
          {documents.map((document) => (
            <li key={`${document.type}:${document.number ?? ""}:${document.expiresOn ?? ""}`}>
              <span className={document.status === "valid" ? "driver-qualification-valid" : "driver-qualification-invalid"}>
                {document.status === "valid" ? "✓" : "•"} {document.type} — {document.status === "valid" ? copy.qualificationValid : copy.qualificationInvalid}
              </span>
              {document.number ? <span>{copy.qualificationNumber}: {document.number}</span> : null}
              {document.expiresOn ? <span>{copy.qualificationExpires}: {document.expiresOn}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {showWarning ? (
        <p className="driver-qualification-warning" role="alert">
          <strong>{copy.qualificationWarningTitle}</strong>
          <span>{copy.qualificationWarningBody}</span>
        </p>
      ) : null}
      {when ? <p className="driver-qualification-meta">{copy.qualificationLastSuccess}: {when}</p> : null}
      {latestFailed ? <p className="driver-qualification-meta">{copy.qualificationLatestFailed}</p> : null}
    </section>
  );
}

export function DriverQualificationCard({
  copy,
  locale,
  driverId,
  companyId,
  savedCompanyId,
  initial,
}: {
  copy: PartnerCopy;
  locale: Locale;
  driverId: string;
  companyId: string;
  savedCompanyId: string | null;
  initial: DriverQualificationView;
}) {
  const [view, setView] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [failedNow, setFailedNow] = useState(false);
  const current = companyId === (savedCompanyId ?? "") ? view : null;
  const status = pending
    ? copy.qualificationLoading
    : !current || current.state === "not-queried"
      ? copy.qualificationNotQueried
      : current.state === "unverified" || current.latestFailed || failedNow
        ? copy.qualificationUnverified
        : null;
  return (
    <div className="driver-qualification-card">
      <DriverQualificationList
        copy={copy}
        locale={locale}
        documents={current?.documents ?? []}
        showWarning={Boolean(current && current.state === "verified" && !current.srcReady)}
        status={status}
        verifiedAt={current?.verifiedAt ?? null}
        latestFailed={Boolean(current?.latestFailed)}
      />
      <button
        type="button"
        className="ops-btn-secondary"
        disabled={pending || companyId !== (savedCompanyId ?? "") || !savedCompanyId}
        onClick={() => {
          setFailedNow(false);
          startTransition(async () => {
            const result = await refreshDriverQualificationAction(driverId);
            if (!result.ok) {
              setFailedNow(true);
              return;
            }
            setView(result.view);
            setFailedNow(result.view.latestFailed || result.view.state === "unverified");
          });
        }}
      >
        {copy.qualificationRefresh}
      </button>
    </div>
  );
}
