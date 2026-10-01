"use client";

import { useEffect, useMemo, useState } from "react";
import { FleetInlineSelect } from "@/components/partner/fleet-inline-select";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { type PartnerCopy } from "@/lib/partner/copy";
import { filterPartnerVehicles } from "@/lib/partner/driver-list-view";
import {
  patchPartnerVehicleCompanyAction,
  patchPartnerVehicleDriverAction,
} from "@/lib/partner/fleet-list-actions";
import {
  companyChoicesForRow,
  fleetChoicesForPartner,
  type FleetChoicesByPartner,
} from "@/lib/partner/fleet-pairing-rules";
import {
  partnerVehicleBrandModel,
  partnerVehicleCapacityLabel,
  vehicleStatusBadgeClass,
  type PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";
import { vehicleStatusLabel } from "@/lib/partner/vehicle-labels";

type PartnerVehicleListProps = {
  locale: Locale;
  copy: PartnerCopy;
  vehicles: PartnerVehicleRecord[];
  companies: readonly UetdsCompanyRef[];
  fleetChoices: FleetChoicesByPartner;
  addHref: string;
  justAdded?: boolean;
};

export function PartnerVehicleList({
  locale,
  copy,
  vehicles,
  companies,
  fleetChoices,
  addHref,
  justAdded = false,
}: PartnerVehicleListProps) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(vehicles);
  const rowSignature = vehicles
    .map((vehicle) =>
      [vehicle.id, vehicle.uetdsCompanyId ?? "", vehicle.defaultDriverId ?? ""].join(":"),
    )
    .join("|");
  const [seenRows, setSeenRows] = useState(rowSignature);
  if (seenRows !== rowSignature) {
    setSeenRows(rowSignature);
    setRows(vehicles);
  }

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

  const visible = useMemo(() => filterPartnerVehicles(rows, query), [rows, query]);

  return (
    <>
      <div className="ops-page-head partner-drivers-head">
        <h1>{copy.vehicles}</h1>
        <input
          type="search"
          className="partner-drivers-search"
          value={query}
          placeholder={copy.vehicleSearchPlaceholder}
          aria-label={copy.vehicleSearchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <a className="ops-btn-primary partner-drivers-add" href={addHref}>
          {copy.addVehicle}
        </a>
      </div>
      {justAdded ? (
        <p className="ops-form-ok partner-drivers-success" role="status">
          {copy.vehicleAdded}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="partner-empty">
          <p className="partner-empty-lead">{copy.vehicleEmpty}</p>
          <a className="ops-btn-primary" href={addHref}>
            {copy.addVehicle}
          </a>
        </div>
      ) : visible.length === 0 ? (
        <p className="partner-empty-lead">{copy.vehicleSearchEmpty}</p>
      ) : (
        <div className="ops-table-wrap partner-drivers-table">
          <table className="ops-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{copy.vehiclePlate}</th>
                <th>{copy.vehicleBrandModel}</th>
                <th>{copy.vehicleModelYear}</th>
                <th>{copy.vehicleClass}</th>
                <th>{copy.vehicleCapacity}</th>
                <th>{copy.uetdsCompanyColumn}</th>
                <th>{copy.defaultDriver}</th>
                <th>{copy.vehicleStatus}</th>
                <th>{copy.vehicleDetail}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((vehicle, index) => (
                <tr key={vehicle.id}>
                  <td>{index + 1}</td>
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
                    <FleetInlineSelect
                      value={vehicle.uetdsCompanyId ?? ""}
                      options={companyChoicesForRow(companies, vehicle.uetdsCompany)}
                      emptyLabel={copy.uetdsNotifyNone}
                      label={copy.uetdsCompanyColumn}
                      saveFailedLabel={copy.vehicleSaveFailed}
                      onSave={async (next) => {
                        const result = await patchPartnerVehicleCompanyAction({
                          locale,
                          vehicleId: vehicle.id,
                          companyId: next,
                        });
                        if (!result.ok) return false;
                        setRows((current) =>
                          current.map((item) =>
                            item.id === vehicle.id
                              ? { ...item, uetdsCompanyId: result.companyId, uetdsCompany: result.company }
                              : item,
                          ),
                        );
                        return true;
                      }}
                    />
                  </td>
                  <td>
                    <FleetInlineSelect
                      value={vehicle.defaultDriverId ?? ""}
                      options={fleetChoicesForPartner(fleetChoices, vehicle.partnerId).drivers}
                      emptyLabel={copy.fleetPairNone}
                      label={copy.defaultDriver}
                      saveFailedLabel={copy.vehicleSaveFailed}
                      onSave={async (next) => {
                        const result = await patchPartnerVehicleDriverAction({
                          locale,
                          vehicleId: vehicle.id,
                          driverId: next,
                        });
                        if (!result.ok) return false;
                        setRows((current) =>
                          current.map((item) => {
                            if (item.id === vehicle.id) {
                              return { ...item, defaultDriverId: result.driverId };
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
                    <a
                      className="ops-row-detail"
                      href={localizedPath(locale, `/partner/vehicles/${vehicle.id}`)}
                    >
                      {copy.vehicleDetail}
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
