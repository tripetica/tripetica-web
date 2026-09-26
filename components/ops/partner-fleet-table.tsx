import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { partnerStatusBadgeClass, partnerStatusLabel } from "@/lib/ops/partner-labels";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";
import { vehicleStatusLabel } from "@/lib/partner/vehicle-labels";
import { type DriverNameSortDir } from "@/lib/partner/driver-list-view";
import { formatPartnerDriverLanguages } from "@/lib/partner/driver-languages";
import {
  formatPartnerFleetPhone,
  formatUetdsCompanyListLabel,
  partnerVehicleBrandModel,
  partnerVehicleCapacityLabel,
  vehicleStatusBadgeClass,
  type PartnerDriverRecord,
  type PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";

type PartnerFleetTableProps = {
  locale: Locale;
  copy: OpsCopy;
  partnerId: string;
  drivers?: PartnerDriverRecord[];
  vehicles?: PartnerVehicleRecord[];
  emptyLabel?: string;
  nameSortDir?: DriverNameSortDir;
  onNameSort?: () => void;
};

export function PartnerFleetTable({
  locale,
  copy,
  partnerId,
  drivers,
  vehicles,
  emptyLabel,
  nameSortDir = "asc",
  onNameSort,
}: PartnerFleetTableProps) {
  if (drivers) {
    if (drivers.length === 0) {
      return <p className="ops-empty">{emptyLabel ?? copy.emptyPartnerDrivers}</p>;
    }
    return (
      <div className="ops-table-wrap ops-partner-fleet-table">
        <table className="ops-table">
          <thead>
            <tr>
              <th>{copy.driverRowIndex}</th>
              <th aria-sort={nameSortDir === "asc" ? "ascending" : "descending"}>
                {onNameSort ? (
                  <button
                    type="button"
                    className="ops-sort-link is-active"
                    onClick={onNameSort}
                  >
                    <span>{copy.driverFullName}</span>
                    <span className="ops-sort-arrow" aria-hidden="true">
                      {nameSortDir === "asc" ? "↑" : "↓"}
                    </span>
                  </button>
                ) : (
                  copy.driverFullName
                )}
              </th>
              <th>{copy.phone}</th>
              <th>{copy.driverLanguages}</th>
              <th>{copy.uetdsCompanyColumn}</th>
              <th>{copy.status}</th>
              <th>{copy.details}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, index) => (
              <tr key={driver.id}>
                <td>{index + 1}</td>
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
                  <a
                    className="ops-row-detail"
                    href={localizedPath(locale, `/ops/partners/${partnerId}/drivers/${driver.id}`)}
                  >
                    {copy.details}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const items = vehicles ?? [];
  if (items.length === 0) {
    return <p className="ops-empty">{emptyLabel ?? copy.emptyPartnerVehicles}</p>;
  }
  return (
    <div className="ops-table-wrap ops-partner-fleet-table">
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
            <th>{copy.details}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((vehicle, index) => (
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
              <td>{formatUetdsCompanyListLabel(vehicle.uetdsCompany, copy.uetdsCompanyExternal)}</td>
              <td>
                <span className={`ops-status-badge ${vehicleStatusBadgeClass(vehicle.status)}`}>
                  {vehicleStatusLabel(vehicle.status, copy)}
                </span>
              </td>
              <td>
                <a
                  className="ops-row-detail"
                  href={localizedPath(locale, `/ops/partners/${partnerId}/vehicles/${vehicle.id}`)}
                >
                  {copy.details}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
