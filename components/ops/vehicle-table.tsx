"use client";

import { useEffect, useRef, useState } from "react";
import { FleetInlineSelect } from "@/components/partner/fleet-inline-select";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { patchOpsVehicleCompanyAction, patchOpsVehicleDriverAction } from "@/lib/ops/fleet-list-actions";
import { searchOpsVehiclesAction } from "@/lib/ops/vehicle-actions";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { type OpsVehicleListItem } from "@/lib/ops/vehicles";
import { pageCount } from "@/lib/ops/format";
import {
  companyChoicesForRow,
  fleetChoicesForPartner,
  type FleetChoice,
  type FleetChoicesByPartner,
} from "@/lib/partner/fleet-pairing-rules";
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
  canManage: boolean;
  companies: readonly UetdsCompanyRef[];
  initialFleetChoices: FleetChoicesByPartner;
};

export function OpsVehicleTable({
  locale,
  copy,
  initialQuery,
  initialPage,
  initialItems,
  initialTotal,
  pageSize,
  canManage,
  companies,
  initialFleetChoices,
}: OpsVehicleTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState(initialItems);
  const [fleetChoices, setFleetChoices] = useState(initialFleetChoices);
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
                <th>{copy.defaultDriver}</th>
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
                  <td>
                    {canManage ? (
                      <FleetInlineSelect
                        value={vehicle.uetdsCompanyId ?? ""}
                        options={companyChoicesForRow(companies, vehicle.uetdsCompany)}
                        emptyLabel={copy.uetdsNotifyNone}
                        label={copy.uetdsCompanyColumn}
                        saveFailedLabel={copy.vehicleSaveFailed}
                        onSave={async (next) => {
                          const result = await patchOpsVehicleCompanyAction({
                            locale,
                            partnerId: vehicle.partnerId,
                            vehicleId: vehicle.id,
                            companyId: next,
                          });
                          if (!result.ok) return false;
                          setItems((current) =>
                            current.map((item) =>
                              item.id === vehicle.id
                                ? { ...item, uetdsCompanyId: result.companyId, uetdsCompany: result.company }
                                : item,
                            ),
                          );
                          return true;
                        }}
                      />
                    ) : (
                      formatUetdsCompanyListLabel(vehicle.uetdsCompany, copy.uetdsCompanyExternal)
                    )}
                  </td>
                  <td>
                    <OpsVehicleDriverCell
                      canManage={canManage}
                      value={vehicle.defaultDriverId}
                      options={fleetChoicesForPartner(fleetChoices, vehicle.partnerId).drivers}
                      emptyLabel={copy.fleetPairNone}
                      label={copy.defaultDriver}
                      saveFailedLabel={copy.vehicleSaveFailed}
                      onSave={async (next) => {
                        const result = await patchOpsVehicleDriverAction({
                          locale,
                          partnerId: vehicle.partnerId,
                          vehicleId: vehicle.id,
                          driverId: next,
                        });
                        if (!result.ok) return false;
                        setItems((current) =>
                          current.map((item) => {
                            if (item.id === vehicle.id) {
                              return { ...item, defaultDriverId: result.driverId };
                            }
                            if (item.partnerId !== vehicle.partnerId) {
                              return item;
                            }
                            if (result.releasedVehicleId && item.id === result.releasedVehicleId) {
                              return { ...item, defaultDriverId: null };
                            }
                            if (result.driverId && item.defaultDriverId === result.driverId) {
                              return { ...item, defaultDriverId: null };
                            }
                            return item;
                          }),
                        );
                        return true;
                      }}
                    />
                  </td>
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

function OpsVehicleDriverCell({
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
