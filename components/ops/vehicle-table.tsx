"use client";

import { useEffect, useRef, useState } from "react";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { searchOpsVehiclesAction } from "@/lib/ops/vehicle-actions";
import { type OpsVehicleListItem } from "@/lib/ops/vehicles";
import { pageCount } from "@/lib/ops/format";
import {
  formatUetdsCompanyListLabel,
  partnerVehicleBrandModel,
  partnerVehicleCapacityLabel,
  vehicleStatusBadgeClass,
} from "@/lib/partner/fleet-view";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";
import { vehicleStatusLabel } from "@/lib/partner/vehicle-labels";

type OpsVehicleTableProps = {
  locale: Locale;
  copy: OpsCopy;
  initialQuery: string;
  initialPage: number;
  initialItems: OpsVehicleListItem[];
  initialTotal: number;
  pageSize: number;
};

export function OpsVehicleTable({
  locale,
  copy,
  initialQuery,
  initialPage,
  initialItems,
  initialTotal,
  pageSize,
}: OpsVehicleTableProps) {
  const [query, setQuery] = useState(initialQuery);
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
      void searchOpsVehiclesAction({ query, page }).then((result) => {
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
      if (page > 1) {
        url.searchParams.set("page", String(page));
      } else {
        url.searchParams.delete("page");
      }
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, page]);

  return (
    <>
      <div className="ops-drivers-head">
        <h1>{copy.vehicles}</h1>
        <input
          type="search"
          className="ops-drivers-search"
          value={query}
          placeholder={copy.vehicleSearchPlaceholder}
          aria-label={copy.vehicleSearchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {items.length === 0 ? (
        <p className="ops-empty">
          {total === 0 && !query.trim() ? copy.emptyVehicles : copy.emptyVehicleSearch}
        </p>
      ) : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.driverRowIndex}</th>
                <th>{copy.vehiclePlate}</th>
                <th>{copy.vehicleBrandModel}</th>
                <th>{copy.vehicleModelYear}</th>
                <th>{copy.vehicleClass}</th>
                <th>{copy.vehicleCapacity}</th>
                <th>{copy.uetdsCompanyColumn}</th>
                <th>{copy.status}</th>
                <th>{copy.linkedPartner}</th>
                <th>{copy.details}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((vehicle, index) => (
                <tr key={vehicle.id}>
                  <td>{startIndex + index + 1}</td>
                  <td>{vehicle.plate}</td>
                  <td>{partnerVehicleBrandModel(vehicle)}</td>
                  <td>{vehicle.modelYear ?? "—"}</td>
                  <td>
                    {vehicle.vehicleClassCode
                      ? partnerVehicleClassLabel(vehicle.vehicleClassCode, locale)
                      : "—"}
                  </td>
                  <td>{partnerVehicleCapacityLabel(vehicle, copy)}</td>
                  <td>{formatUetdsCompanyListLabel(vehicle.uetdsCompany, copy.uetdsCompanyExternal)}</td>
                  <td>
                    <span className={`ops-status-badge ${vehicleStatusBadgeClass(vehicle.status)}`}>
                      {vehicleStatusLabel(vehicle.status, copy)}
                    </span>
                  </td>
                  <td>
                    <a href={localizedPath(locale, `/ops/partners/${vehicle.partnerId}`)}>
                      {vehicle.partnerName}
                    </a>
                  </td>
                  <td>
                    <a
                      className="ops-row-detail"
                      href={localizedPath(locale, `/ops/vehicles/${vehicle.id}`)}
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
