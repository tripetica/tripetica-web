"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { GpsCompanyLock } from "@/components/gps/company-lock";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { createGpsDeviceAction, type GpsActionState } from "@/lib/gps/actions";
import { gpsErrorText, type GpsCopy } from "@/lib/gps/copy";
import { type GpsVehicleChoice } from "@/lib/gps/queries";

type PartnerChoice = { id: string; partner_code: string; name: string };

export function GpsDeviceCreateForm({
  locale,
  copy,
  partners,
  vehicles,
}: {
  locale: Locale;
  copy: GpsCopy;
  partners: PartnerChoice[];
  vehicles: GpsVehicleChoice[];
}) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [state, action, pending] = useActionState(createGpsDeviceAction, null as GpsActionState | null);
  const partnerOptions = useMemo(
    () => [
      { value: "", label: copy.stock },
      ...partners.map((partner) => ({
        value: partner.id,
        label: `${partner.partner_code} · ${partner.name}`,
      })),
    ],
    [copy.stock, partners],
  );
  const vehicleOptions = useMemo(
    () => [
      { value: "", label: copy.unassigned },
      ...vehicles
        .filter((vehicle) => vehicle.partner_id === partnerId)
        .map((vehicle) => ({ value: vehicle.id, label: vehicle.plate })),
    ],
    [copy.unassigned, partnerId, vehicles],
  );
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId && vehicle.partner_id === partnerId) ?? null;

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [router, state]);

  function changePartner(next: string) {
    setPartnerId(next);
    setVehicleId("");
  }

  return (
    <form action={action} className="ops-form gps-create">
      <h2>{copy.newDevice}</h2>
      <input type="hidden" name="locale" value={locale} />
      <label className="ops-field">
        <span>{copy.partner}</span>
        <SearchableSelect
          name="partnerId"
          value={partnerId}
          options={partnerOptions}
          placeholder={copy.partnerSearch}
          emptyLabel={copy.selectEmpty}
          onChange={changePartner}
        />
      </label>
      <label className="ops-field">
        <span>{copy.vehicle}</span>
        <SearchableSelect
          name="vehicleId"
          value={selectedVehicle?.id ?? ""}
          options={vehicleOptions}
          placeholder={copy.vehicleSearch}
          emptyLabel={copy.selectEmpty}
          disabled={!partnerId}
          onChange={setVehicleId}
        />
      </label>
      {selectedVehicle ? (
        <GpsCompanyLock
          label={copy.company}
          value={selectedVehicle.uetds_company}
          missing={copy.companyMissing}
        />
      ) : null}
      <label className="ops-field">
        <span>{copy.deviceId}</span>
        <input name="deviceCode" autoComplete="off" placeholder="TPT-000000000000" />
        <small>{copy.deviceCodeHint}</small>
      </label>
      <label className="ops-field">
        <span>{copy.imei}</span>
        <input name="imei" inputMode="numeric" autoComplete="off" />
        <small>{copy.imeiHint}</small>
      </label>
      <button type="submit" className="ops-btn-primary" disabled={pending}>
        {copy.create}
      </button>
      {state?.error ? <p className="ops-form-error">{gpsErrorText(copy, state.error)}</p> : null}
      {state?.ok && state.token && state.deviceId ? (
        <div className="ops-note">
          <p>{copy.tokenOnce}</p>
          <p><code>{state.token}</code></p>
          <a href={localizedPath(locale, `/ops/gps/${state.deviceId}`)}>{copy.openDevice}</a>
        </div>
      ) : null}
    </form>
  );
}
