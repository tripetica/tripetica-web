"use client";

import { useEffect, useMemo, useState } from "react";
import { FleetInlineSelect } from "@/components/partner/fleet-inline-select";
import { PartnerDriverSubscriptionReadOnlyCells } from "@/components/uetds/driver-subscription-list-cells";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { type PartnerCopy } from "@/lib/partner/copy";
import {
  patchPartnerDriverAuthorityAction,
  patchPartnerDriverCompanyAction,
  patchPartnerDriverVehicleAction,
} from "@/lib/partner/fleet-list-actions";
import {
  authoritiesForCompany,
  companyChoicesForRow,
  fleetChoicesForPartner,
  type FleetChoicesByPartner,
} from "@/lib/partner/fleet-pairing-rules";
import {
  filterAndSortPartnerDrivers,
  nextDriverNameSortDir,
  type DriverNameSortDir,
} from "@/lib/partner/driver-list-view";
import { formatPartnerDriverLanguages } from "@/lib/partner/driver-languages";
import { formatPartnerFleetPhone, type PartnerDriverRecord } from "@/lib/partner/fleet-view";
import {
  addSubscriptionMonths,
  istanbulSubscriptionPeriodKey,
  subscriptionPeriodLabel,
} from "@/lib/uetds/driver-subscription";

type PartnerDriverListProps = {
  locale: Locale;
  copy: PartnerCopy;
  drivers: PartnerDriverRecord[];
  companies: readonly UetdsCompanyRef[];
  fleetChoices: FleetChoicesByPartner;
  addHref: string;
  justAdded?: boolean;
};

export function PartnerDriverList({
  locale,
  copy,
  drivers,
  companies,
  fleetChoices,
  addHref,
  justAdded = false,
}: PartnerDriverListProps) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(drivers);
  const rowSignature = drivers
    .map((driver) =>
      [driver.id, driver.uetdsCompanyId ?? "", driver.defaultVehicleId ?? "", driver.defaultAuthorityId ?? ""].join(":"),
    )
    .join("|");
  const [seenRows, setSeenRows] = useState(rowSignature);
  if (seenRows !== rowSignature) {
    setSeenRows(rowSignature);
    setRows(drivers);
  }
  const [dir, setDir] = useState<DriverNameSortDir>("asc");
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
    notManaged: copy.uetdsSubscriptionNotManaged,
    invalidFee: "",
    saveFailed: "",
  };

  useEffect(() => {
    if (!justAdded || typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (!url.searchParams.has("added")) {
      return;
    }
    url.searchParams.delete("added");
    const search = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  }, [justAdded]);

  const visible = useMemo(
    () => filterAndSortPartnerDrivers(rows, query, dir),
    [rows, query, dir],
  );

  return (
    <>
      <div className="ops-page-head partner-drivers-head">
        <h1>{copy.drivers}</h1>
        <input
          type="search"
          className="partner-drivers-search"
          value={query}
          placeholder={copy.driverSearchPlaceholder}
          aria-label={copy.driverSearchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <a className="ops-btn-primary partner-drivers-add" href={addHref}>
          {copy.addDriver}
        </a>
      </div>
      {justAdded ? (
        <p className="ops-form-ok partner-drivers-success" role="status">
          {copy.driverAdded}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="partner-empty">
          <p className="partner-empty-lead">{copy.driverEmpty}</p>
          <a className="ops-btn-primary" href={addHref}>
            {copy.addDriver}
          </a>
        </div>
      ) : visible.length === 0 ? (
        <p className="partner-empty-lead">{copy.driverSearchEmpty}</p>
      ) : (
        <div className="ops-table-wrap partner-drivers-table">
          <table className="ops-table partner-drivers-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th aria-sort={dir === "asc" ? "ascending" : "descending"}>
                  <button
                    type="button"
                    className="ops-sort-link is-active"
                    onClick={() => setDir((current) => nextDriverNameSortDir(current))}
                  >
                    <span>{copy.driverFullName}</span>
                    <span className="ops-sort-arrow" aria-hidden="true">
                      {dir === "asc" ? "↑" : "↓"}
                    </span>
                  </button>
                </th>
                <th>{copy.phoneNumber}</th>
                <th>{copy.driverEmail}</th>
                <th>{copy.driverLanguages}</th>
                <th>{copy.uetdsCompanyColumn}</th>
                <th>{copy.defaultVehicle}</th>
                <th>{copy.defaultEdevletAuthority}</th>
                <th>{copy.driverStatus}</th>
                <th>{copy.membershipStatusColumn}</th>
                <th className="ops-driver-sub-fee">{copy.uetdsSubscriptionFee}</th>
                <th className="ops-driver-sub-currency">{copy.uetdsSubscriptionCurrency}</th>
                <th className="ops-driver-sub-status">
                  {periodLabel} / {copy.uetdsSubscriptionStatusColumn}
                </th>
                <th className="ops-driver-sub-status">
                  {nextPeriodLabel} / {copy.uetdsSubscriptionStatusColumn}
                </th>
                <th>{copy.driverDetail}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((driver, index) => (
                <tr key={driver.id}>
                  <td>{index + 1}</td>
                  <td>{driver.fullName}</td>
                  <td>{formatPartnerFleetPhone(driver.phone)}</td>
                  <td>{driver.email?.trim() || "—"}</td>
                  <td>{formatPartnerDriverLanguages(driver.languageCodes, locale)}</td>
                  <td>
                    <FleetInlineSelect
                      value={driver.uetdsCompanyId ?? ""}
                      options={companyChoicesForRow(companies, driver.uetdsCompany)}
                      emptyLabel={copy.uetdsNotifyNone}
                      label={copy.uetdsCompanyColumn}
                      saveFailedLabel={copy.driverSaveFailed}
                      onSave={async (next) => {
                        const result = await patchPartnerDriverCompanyAction({
                          locale,
                          driverId: driver.id,
                          companyId: next,
                        });
                        if (!result.ok) return false;
                        setRows((current) =>
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
                  </td>
                  <td>
                    <FleetInlineSelect
                      value={driver.defaultVehicleId ?? ""}
                      options={fleetChoicesForPartner(fleetChoices, driver.partnerId).vehicles}
                      emptyLabel={copy.fleetPairNone}
                      label={copy.defaultVehicle}
                      saveFailedLabel={copy.driverSaveFailed}
                      onSave={async (next) => {
                        const result = await patchPartnerDriverVehicleAction({
                          locale,
                          driverId: driver.id,
                          vehicleId: next,
                        });
                        if (!result.ok) return false;
                        setRows((current) =>
                          current.map((item) => {
                            if (item.id === driver.id) {
                              return { ...item, defaultVehicleId: result.vehicleId };
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
                    <FleetInlineSelect
                      value={driver.defaultAuthorityId ?? ""}
                      options={authoritiesForCompany(
                        fleetChoicesForPartner(fleetChoices, driver.partnerId).authorities,
                        driver.uetdsCompanyId ?? "",
                      )}
                      emptyLabel={copy.fleetPairNone}
                      label={copy.defaultEdevletAuthority}
                      saveFailedLabel={copy.invalidEdevletAuthority}
                      onSave={async (next) => {
                        const result = await patchPartnerDriverAuthorityAction({
                          locale,
                          driverId: driver.id,
                          authorityId: next,
                        });
                        if (!result.ok) return false;
                        setRows((current) =>
                          current.map((item) =>
                            item.id === driver.id ? { ...item, defaultAuthorityId: result.authorityId } : item,
                          ),
                        );
                        return true;
                      }}
                    />
                  </td>
                  <td>
                    <span
                      className={`ops-status-badge ${
                        driver.status === "active" ? "is-active" : "is-inactive"
                      }`}
                    >
                      {driver.status === "active" ? copy.driverActive : copy.driverInactive}
                    </span>
                  </td>
                  <td>
                    {driver.membershipStatus === "gold" ? copy.membershipGold : copy.membershipStandard}
                  </td>
                  <PartnerDriverSubscriptionReadOnlyCells
                    locale={locale}
                    summary={driver.uetdsSubscription}
                    labels={subscriptionLabels}
                  />
                  <td>
                    <a
                      className="ops-row-detail"
                      href={localizedPath(locale, `/partner/drivers/${driver.id}`)}
                    >
                      {copy.driverDetail}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
