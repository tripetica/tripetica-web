"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FleetInlineSelect } from "@/components/partner/fleet-inline-select";
import { OpsDriverSubscriptionInlineCells } from "@/components/uetds/driver-subscription-list-cells";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { patchOpsDriverMembershipAction, searchOpsDriversAction } from "@/lib/ops/driver-actions";
import {
  patchOpsDriverAuthorityAction,
  patchOpsDriverCompanyAction,
  patchOpsDriverVehicleAction,
} from "@/lib/ops/fleet-list-actions";
import { type OpsCopy } from "@/lib/ops/copy";
import { type OpsDriverListItem } from "@/lib/ops/drivers";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { partnerStatusBadgeClass, partnerStatusLabel } from "@/lib/ops/partner-labels";
import { pageCount } from "@/lib/ops/format";
import {
  nextDriverNameSortDir,
  type DriverNameSortDir,
} from "@/lib/partner/driver-list-view";
import { formatPartnerDriverLanguages } from "@/lib/partner/driver-languages";
import {
  authoritiesForCompany,
  companyChoicesForRow,
  fleetChoicesForPartner,
  type FleetChoice,
  type FleetChoicesByPartner,
} from "@/lib/partner/fleet-pairing-rules";
import { formatPartnerFleetPhone, formatUetdsCompanyListLabel } from "@/lib/partner/fleet-view";
import { type DriverMembershipStatus } from "@/lib/ops/driver-membership";
import {
  addSubscriptionMonths,
  istanbulSubscriptionPeriodKey,
  subscriptionPeriodLabel,
  type UetdsDriverSubscriptionListSummary,
} from "@/lib/uetds/driver-subscription";

type OpsDriverTableProps = {
  locale: Locale;
  copy: OpsCopy;
  canManage: boolean;
  initialQuery: string;
  initialDir: DriverNameSortDir;
  initialPage: number;
  initialItems: OpsDriverListItem[];
  initialTotal: number;
  pageSize: number;
  companies: readonly UetdsCompanyRef[];
  initialFleetChoices: FleetChoicesByPartner;
};

export function OpsDriverTable({
  locale,
  copy,
  canManage,
  initialQuery,
  initialDir,
  initialPage,
  initialItems,
  initialTotal,
  pageSize,
  companies,
  initialFleetChoices,
}: OpsDriverTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [dir, setDir] = useState<DriverNameSortDir>(initialDir);
  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState(initialItems);
  const [fleetChoices, setFleetChoices] = useState(initialFleetChoices);
  const [total, setTotal] = useState(initialTotal);
  const pages = pageCount(total, pageSize);
  const startIndex = (page - 1) * pageSize;
  const skipFirstFetch = useRef(true);
  const panelLocale = locale === "en" || locale === "ru" ? locale : "tr";
  const period = istanbulSubscriptionPeriodKey();
  const periodLabel = subscriptionPeriodLabel(period, panelLocale);
  const nextPeriodLabel = subscriptionPeriodLabel(addSubscriptionMonths(period, 1), panelLocale);
  const subscriptionLabels = {
    fee: copy.uetdsSubscriptionFee,
    currency: copy.uetdsSubscriptionCurrency,
    unpaid: copy.uetdsSubscriptionUnpaid,
    paid: copy.uetdsSubscriptionPaid,
    free: copy.uetdsSubscriptionFree,
    notManaged: copy.uetdsSubscriptionEnrollHint,
    invalidFee: copy.invalidSubscriptionFee,
    saveFailed: copy.driverSaveFailed,
  };

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void searchOpsDriversAction({ query, dir, page }).then((result) => {
        setItems(result.items);
        setFleetChoices(result.fleetChoices);
        setTotal(result.total);
        if (result.page !== page) {
          setPage(result.page);
        }
      });
      const url = new URL(window.location.href);
      if (query.trim()) {
        url.searchParams.set("q", query.trim());
      } else {
        url.searchParams.delete("q");
      }
      url.searchParams.set("dir", dir);
      if (page > 1) {
        url.searchParams.set("page", String(page));
      } else {
        url.searchParams.delete("page");
      }
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, dir, page]);

  function onMembershipChange(driverId: string, status: DriverMembershipStatus) {
    setItems((current) =>
      current.map((item) => (item.id === driverId ? { ...item, membershipStatus: status } : item)),
    );
  }

  function onSummaryChange(driverId: string, summary: UetdsDriverSubscriptionListSummary) {
    setItems((current) =>
      current.map((item) =>
        item.id === driverId ? { ...item, uetdsSubscription: summary } : item,
      ),
    );
  }

  return (
    <>
      <div className="ops-drivers-head">
        <h1>{copy.drivers}</h1>
        <input
          type="search"
          className="ops-drivers-search"
          value={query}
          placeholder={copy.driverSearchPlaceholder}
          aria-label={copy.driverSearchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {items.length === 0 ? (
        <p className="ops-empty">{total === 0 && !query.trim() ? copy.emptyDrivers : copy.emptyDriverSearch}</p>
      ) : (
        <div className="ops-table-wrap ops-drivers-table-wrap">
          <table className="ops-table ops-drivers-table">
            <thead>
              <tr>
                <th>{copy.driverRowIndex}</th>
                <th aria-sort={dir === "asc" ? "ascending" : "descending"}>
                  <button
                    type="button"
                    className="ops-sort-link is-active"
                    onClick={() => {
                      setDir((current) => nextDriverNameSortDir(current));
                      setPage(1);
                    }}
                  >
                    <span>{copy.driverFullName}</span>
                    <span className="ops-sort-arrow" aria-hidden="true">
                      {dir === "asc" ? "↑" : "↓"}
                    </span>
                  </button>
                </th>
                <th>{copy.phone}</th>
                <th>{copy.driverLanguages}</th>
                <th>{copy.uetdsCompanyColumn}</th>
                <th>{copy.defaultVehicle}</th>
                <th>{copy.defaultEdevletAuthority}</th>
                <th>{copy.status}</th>
                <th>{copy.membershipStatusColumn}</th>
                <th>{copy.linkedPartner}</th>
                <th className="ops-driver-sub-fee">{copy.uetdsSubscriptionFee}</th>
                <th className="ops-driver-sub-currency">{copy.uetdsSubscriptionCurrency}</th>
                <th className="ops-driver-sub-status">
                  {periodLabel} / {copy.uetdsSubscriptionStatusColumn}
                </th>
                <th className="ops-driver-sub-status">
                  {nextPeriodLabel} / {copy.uetdsSubscriptionStatusColumn}
                </th>
                <th>{copy.details}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((driver, index) => (
                <tr key={driver.id}>
                  <td>{startIndex + index + 1}</td>
                  <td>{driver.fullName}</td>
                  <td>{formatPartnerFleetPhone(driver.phone)}</td>
                  <td>{formatPartnerDriverLanguages(driver.languageCodes, locale)}</td>
                  <td>
                    {canManage ? (
                      <FleetInlineSelect
                        value={driver.uetdsCompanyId ?? ""}
                        options={companyChoicesForRow(companies, driver.uetdsCompany)}
                        emptyLabel={copy.uetdsNotifyNone}
                        label={copy.uetdsCompanyColumn}
                        saveFailedLabel={copy.driverSaveFailed}
                        onSave={async (next) => {
                          const result = await patchOpsDriverCompanyAction({
                            locale,
                            partnerId: driver.partnerId,
                            driverId: driver.id,
                            companyId: next,
                          });
                          if (!result.ok) return false;
                          setItems((current) =>
                            current.map((item) =>
                              item.id === driver.id
                                ? {
                                    ...item,
                                    uetdsCompanyId: result.companyId,
                                    uetdsCompany: result.company,
                                    defaultAuthorityId: result.authorityId,
                                  }
                                : item,
                            ),
                          );
                          return true;
                        }}
                      />
                    ) : (
                      formatUetdsCompanyListLabel(driver.uetdsCompany, copy.uetdsCompanyExternal)
                    )}
                  </td>
                  <td>
                    <OpsFleetChoiceCell
                      canManage={canManage}
                      value={driver.defaultVehicleId}
                      options={fleetChoicesForPartner(fleetChoices, driver.partnerId).vehicles}
                      emptyLabel={copy.fleetPairNone}
                      label={copy.defaultVehicle}
                      saveFailedLabel={copy.driverSaveFailed}
                      onSave={async (next) => {
                        const result = await patchOpsDriverVehicleAction({
                          locale,
                          partnerId: driver.partnerId,
                          driverId: driver.id,
                          vehicleId: next,
                        });
                        if (!result.ok) return false;
                        setItems((current) =>
                          current.map((item) => {
                            if (item.id === driver.id) {
                              return { ...item, defaultVehicleId: result.vehicleId };
                            }
                            if (item.partnerId !== driver.partnerId) {
                              return item;
                            }
                            if (result.releasedDriverId && item.id === result.releasedDriverId) {
                              return { ...item, defaultVehicleId: null };
                            }
                            if (result.vehicleId && item.defaultVehicleId === result.vehicleId) {
                              return { ...item, defaultVehicleId: null };
                            }
                            return item;
                          }),
                        );
                        return true;
                      }}
                    />
                  </td>
                  <td>
                    <OpsFleetChoiceCell
                      canManage={canManage}
                      value={driver.defaultAuthorityId}
                      options={authoritiesForCompany(
                        fleetChoicesForPartner(fleetChoices, driver.partnerId).authorities,
                        driver.uetdsCompanyId ?? "",
                      )}
                      emptyLabel={copy.fleetPairNone}
                      label={copy.defaultEdevletAuthority}
                      saveFailedLabel={copy.driverSaveFailed}
                      onSave={async (next) => {
                        const result = await patchOpsDriverAuthorityAction({
                          locale,
                          partnerId: driver.partnerId,
                          driverId: driver.id,
                          authorityId: next,
                        });
                        if (!result.ok) return false;
                        setItems((current) =>
                          current.map((item) =>
                            item.id === driver.id
                              ? { ...item, defaultAuthorityId: result.authorityId }
                              : item,
                          ),
                        );
                        return true;
                      }}
                    />
                  </td>
                  <td>
                    <span className={`ops-status-badge ${partnerStatusBadgeClass(driver.status)}`}>
                      {partnerStatusLabel(driver.status, copy)}
                    </span>
                  </td>
                  <td className="ops-driver-membership">
                    <OpsDriverMembershipCell
                      locale={locale}
                      driverId={driver.id}
                      partnerId={driver.partnerId}
                      status={driver.membershipStatus}
                      canManage={canManage}
                      goldLabel={copy.membershipGold}
                      standardLabel={copy.membershipStandard}
                      saveFailedLabel={copy.driverSaveFailed}
                      onChange={onMembershipChange}
                    />
                  </td>
                  <td>
                    <a href={localizedPath(locale, `/ops/partners/${driver.partnerId}`)}>
                      {driver.partnerName}
                    </a>
                  </td>
                  <OpsDriverSubscriptionInlineCells
                    locale={locale}
                    driverId={driver.id}
                    canManage={canManage}
                    summary={driver.uetdsSubscription}
                    labels={subscriptionLabels}
                    onSummaryChange={onSummaryChange}
                  />
                  <td>
                    <a
                      className="ops-row-detail"
                      href={localizedPath(locale, `/ops/drivers/${driver.id}`)}
                    >
                      {copy.details}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 ? (
        <div className="ops-pagination">
          <span>
            {copy.page} {page} {copy.of} {pages}
          </span>
          {page > 1 ? (
            <button type="button" className="ops-sort-link" onClick={() => setPage((current) => current - 1)}>
              {copy.previous}
            </button>
          ) : (
            <span />
          )}
          {page < pages ? (
            <button type="button" className="ops-sort-link" onClick={() => setPage((current) => current + 1)}>
              {copy.next}
            </button>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </>
  );
}

function OpsDriverMembershipCell({
  locale,
  driverId,
  partnerId,
  status,
  canManage,
  goldLabel,
  standardLabel,
  saveFailedLabel,
  onChange,
}: {
  locale: Locale;
  driverId: string;
  partnerId: string;
  status: DriverMembershipStatus;
  canManage: boolean;
  goldLabel: string;
  standardLabel: string;
  saveFailedLabel: string;
  onChange: (driverId: string, status: DriverMembershipStatus) => void;
}) {
  const [draft, setDraft] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const source = `${driverId}:${status}`;
  const [seen, setSeen] = useState(source);
  if (seen !== source) {
    setSeen(source);
    setDraft(status);
    setError(null);
  }

  if (!canManage) {
    return <>{status === "gold" ? goldLabel : standardLabel}</>;
  }

  return (
    <>
      <select
        className="ops-driver-sub-select ops-driver-membership-select"
        aria-label={status === "gold" ? goldLabel : standardLabel}
        value={draft}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value === "gold" ? "gold" : "standard";
          if (next === status) return;
          setDraft(next);
          startTransition(async () => {
            const result = await patchOpsDriverMembershipAction({
              locale,
              driverId,
              partnerId,
              status: next,
            });
            if (!result.ok || result.driverId !== driverId) {
              setDraft(status);
              setError(saveFailedLabel);
              return;
            }
            setError(null);
            onChange(driverId, result.status);
          });
        }}
      >
        <option value="standard">{standardLabel}</option>
        <option value="gold">{goldLabel}</option>
      </select>
      {error ? (
        <span className="ops-driver-sub-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

function OpsFleetChoiceCell({
  canManage,
  value,
  options,
  emptyLabel,
  label,
  saveFailedLabel,
  onSave,
}: {
  canManage: boolean;
  value: string | null;
  options: readonly FleetChoice[];
  emptyLabel: string;
  label: string;
  saveFailedLabel: string;
  onSave: (next: string) => Promise<boolean>;
}) {
  if (!canManage) {
    if (!value) {
      return emptyLabel;
    }
    return options.find((option) => option.id === value)?.label ?? emptyLabel;
  }
  return (
    <FleetInlineSelect
      value={value ?? ""}
      options={options}
      emptyLabel={emptyLabel}
      label={label}
      saveFailedLabel={saveFailedLabel}
      onSave={onSave}
    />
  );
}
