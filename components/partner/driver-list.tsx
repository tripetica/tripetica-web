"use client";

import { useEffect, useMemo, useState } from "react";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type PartnerCopy } from "@/lib/partner/copy";
import {
  filterAndSortPartnerDrivers,
  nextDriverNameSortDir,
  type DriverNameSortDir,
} from "@/lib/partner/driver-list-view";
import { formatPartnerDriverLanguages } from "@/lib/partner/driver-languages";
import { formatPartnerFleetPhone, type PartnerDriverRecord } from "@/lib/partner/fleet-view";

type PartnerDriverListProps = {
  locale: Locale;
  copy: PartnerCopy;
  drivers: PartnerDriverRecord[];
  addHref: string;
  justAdded?: boolean;
};

export function PartnerDriverList({
  locale,
  copy,
  drivers,
  addHref,
  justAdded = false,
}: PartnerDriverListProps) {
  const [query, setQuery] = useState("");
  const [dir, setDir] = useState<DriverNameSortDir>("asc");

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
    () => filterAndSortPartnerDrivers(drivers, query, dir),
    [drivers, query, dir],
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
      {drivers.length === 0 ? (
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
          <table className="ops-table">
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
                <th>{copy.driverLanguages}</th>
                <th>{copy.driverStatus}</th>
                <th>{copy.driverDetail}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((driver, index) => (
                <tr key={driver.id}>
                  <td>{index + 1}</td>
                  <td>{driver.fullName}</td>
                  <td>{formatPartnerFleetPhone(driver.phone)}</td>
                  <td>{formatPartnerDriverLanguages(driver.languageCodes, locale)}</td>
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
