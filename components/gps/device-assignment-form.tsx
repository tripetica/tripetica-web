"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { GpsCompanyLock } from "@/components/gps/company-lock";
import { assignGpsDeviceAction } from "@/lib/gps/actions";
import { type GpsCopy } from "@/lib/gps/copy";
import { type Locale } from "@/lib/i18n/config";
import { type GpsVehicleChoice } from "@/lib/gps/queries";

export function GpsDeviceAssignmentForm({
  locale,
  copy,
  deviceId,
  partnerId,
  vehicleId,
  partners,
  vehicles,
}: {
  locale: Locale;
  copy: GpsCopy;
  deviceId: string;
  partnerId: string | null;
  vehicleId: string | null;
  partners: { id: string; partner_code: string; name: string }[];
  vehicles: GpsVehicleChoice[];
}) {
  const [partner, setPartner] = useState(partnerId ?? "");
  const [vehicle, setVehicle] = useState(vehicleId ?? "");
  const partnerOptions = useMemo(
    () => [
      { value: "", label: copy.stock },
      ...partners.map((item) => ({
        value: item.id,
        label: `${item.partner_code} · ${item.name}`,
      })),
    ],
    [copy.stock, partners],
  );
  const vehicleOptions = useMemo(
    () => [
      { value: "", label: copy.unassigned },
      ...vehicles
        .filter((item) => item.partner_id === partner)
        .map((item) => ({ value: item.id, label: item.plate })),
    ],
    [copy.unassigned, partner, vehicles],
  );
  const selected = vehicles.find((item) => item.id === vehicle && item.partner_id === partner) ?? null;

  function changePartner(next: string) {
    setPartner(next);
    setVehicle((current) => (
      vehicles.some((item) => item.id === current && item.partner_id === next) ? current : ""
    ));
  }

  return (
    <form action={assignGpsDeviceAction} className="gps-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <label>
        <span>{copy.partner}</span>
        <SearchableSelect
          name="partnerId"
          value={partner}
          options={partnerOptions}
          placeholder={copy.partnerSearch}
          emptyLabel={copy.selectEmpty}
          onChange={changePartner}
        />
      </label>
      <label>
        <span>{copy.vehicle}</span>
        <SearchableSelect
          name="vehicleId"
          value={selected?.id ?? ""}
          options={vehicleOptions}
          placeholder={copy.vehicleSearch}
          emptyLabel={copy.selectEmpty}
          disabled={!partner}
          onChange={setVehicle}
        />
      </label>
      {selected ? (
        <GpsCompanyLock
          label={copy.company}
          value={selected.uetds_company}
          missing={copy.companyMissing}
        />
      ) : null}
      <button type="submit" className="ops-btn-primary">{copy.assignSave}</button>
    </form>
  );
}
