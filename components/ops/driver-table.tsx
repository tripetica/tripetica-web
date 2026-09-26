"use client";

import { useEffect, useRef, useState } from "react";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { searchOpsDriversAction } from "@/lib/ops/driver-actions";
import { type OpsCopy } from "@/lib/ops/copy";
import { type OpsDriverListItem } from "@/lib/ops/drivers";
import { partnerStatusBadgeClass, partnerStatusLabel } from "@/lib/ops/partner-labels";
import { pageCount } from "@/lib/ops/format";
import {
  nextDriverNameSortDir,
  type DriverNameSortDir,
} from "@/lib/partner/driver-list-view";
import { formatPartnerDriverLanguages } from "@/lib/partner/driver-languages";
import { formatPartnerFleetPhone, formatUetdsCompanyListLabel } from "@/lib/partner/fleet-view";

type OpsDriverTableProps = {
  locale: Locale;
  copy: OpsCopy;
  initialQuery: string;
  initialDir: DriverNameSortDir;
  initialPage: number;
  initialItems: OpsDriverListItem[];
  initialTotal: number;
  pageSize: number;
};

export function OpsDriverTable({
  locale,
  copy,
  initialQuery,
  initialDir,
  initialPage,
  initialItems,
  initialTotal,
  pageSize,
}: OpsDriverTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [dir, setDir] = useState<DriverNameSortDir>(initialDir);
  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const pages = pageCount(total, pageSize);
  const startIndex = (page - 1) * pageSize;
  const skipFirstFetch = useRef(true);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void searchOpsDriversAction({ query, dir, page }).then((result) => {
        setItems(result.items);
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
        <div className="ops-table-wrap">
          <table className="ops-table">
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
                <th>{copy.status}</th>
                <th>{copy.linkedPartner}</th>
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
                  <td>{formatUetdsCompanyListLabel(driver.uetdsCompany, copy.uetdsCompanyExternal)}</td>
                  <td>
                    <span className={`ops-status-badge ${partnerStatusBadgeClass(driver.status)}`}>
                      {partnerStatusLabel(driver.status, copy)}
                    </span>
                  </td>
                  <td>
                    <a href={localizedPath(locale, `/ops/partners/${driver.partnerId}`)}>
                      {driver.partnerName}
                    </a>
                  </td>
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
