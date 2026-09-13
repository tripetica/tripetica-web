"use client";

import { useState } from "react";
import {
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import { KNOWN_VEHICLE_CODES } from "@/lib/booking/fx/vehicle-totals";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { formatOpsSelectedPrice } from "@/lib/ops/money";
import { type OpsRecordEditInput } from "@/lib/ops/record-edit";
import { PriceEditModal } from "@/components/ops/price-edit-modal";

type RecordDetailEditProps = {
  locale: Locale;
  copy: OpsCopy;
  initial: OpsRecordEditInput;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (value: OpsRecordEditInput) => void;
};

export function RecordDetailEdit({
  locale,
  copy,
  initial,
  saving,
  error,
  onCancel,
  onSave,
}: RecordDetailEditProps) {
  const [form, setForm] = useState<OpsRecordEditInput>(initial);
  const [formSource, setFormSource] = useState(initial);
  const [priceModalOpen, setPriceModalOpen] = useState(false);

  if (formSource !== initial) {
    setFormSource(initial);
    setForm(initial);
  }

  const selectedPrice = formatOpsSelectedPrice(
    form.priceManuallyOverridden
      ? form.manualPriceTotals[form.currency]
      : form.calculatedPriceTotals[form.currency],
    form.currency,
    locale,
  );

  function patch<K extends keyof OpsRecordEditInput>(key: K, value: OpsRecordEditInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function patchPassenger(
    sequenceNo: number,
    key: keyof OpsRecordEditInput["passengers"][number],
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      passengers: current.passengers.map((passenger) =>
        passenger.sequenceNo === sequenceNo ? { ...passenger, [key]: value } : passenger,
      ),
    }));
  }

  return (
    <div className="ops-record-edit">
      <section className="ops-edit-section">
        <div className="ops-edit-grid">
          <label className="ops-field">
            <span>{copy.pickupDate}</span>
            <input
              type="date"
              value={form.pickupDate}
              onChange={(event) => patch("pickupDate", event.target.value)}
            />
          </label>
          <label className="ops-field">
            <span>{copy.pickupTime}</span>
            <input
              type="time"
              value={form.pickupTime}
              onChange={(event) => patch("pickupTime", event.target.value)}
            />
          </label>
          <label className="ops-field ops-field-wide">
            <span>{copy.pickup}</span>
            <input
              value={form.pickupName}
              onChange={(event) => patch("pickupName", event.target.value)}
            />
          </label>
          <label className="ops-field ops-field-wide">
            <span>{copy.pickupAddress}</span>
            <input
              value={form.pickupAddress}
              onChange={(event) => patch("pickupAddress", event.target.value)}
            />
          </label>
          <label className="ops-field ops-field-wide">
            <span>{copy.dropoff}</span>
            <input
              value={form.dropoffName}
              onChange={(event) => patch("dropoffName", event.target.value)}
            />
          </label>
          <label className="ops-field ops-field-wide">
            <span>{copy.dropoffAddress}</span>
            <input
              value={form.dropoffAddress}
              onChange={(event) => patch("dropoffAddress", event.target.value)}
            />
          </label>
          <label className="ops-field">
            <span>{copy.flight}</span>
            <input
              value={form.flightCode}
              onChange={(event) => patch("flightCode", event.target.value)}
            />
          </label>
          <label className="ops-field">
            <span>{copy.passengerCount}</span>
            <input
              type="number"
              min={1}
              value={form.passengerCount}
              onChange={(event) => patch("passengerCount", Number(event.target.value))}
            />
          </label>
          <label className="ops-field">
            <span>{copy.luggage}</span>
            <input
              type="number"
              min={0}
              value={form.luggageCount}
              onChange={(event) => patch("luggageCount", Number(event.target.value))}
            />
          </label>
          <label className="ops-field">
            <span>{copy.babySeat}</span>
            <input
              type="number"
              min={0}
              value={form.babySeatCount}
              onChange={(event) => patch("babySeatCount", Number(event.target.value))}
            />
          </label>
          <label className="ops-check ops-field-wide">
            <input
              type="checkbox"
              checked={form.meetAndGreet}
              onChange={(event) => patch("meetAndGreet", event.target.checked)}
            />
            <span>{copy.meetAndGreet}</span>
          </label>
        </div>
      </section>

      <section className="ops-edit-section">
        <h3>{copy.vehiclePrice}</h3>
        <div className="ops-edit-grid">
          <label className="ops-field">
            <span>{copy.vehicleCode}</span>
            <select
              value={form.vehicleCode}
              onChange={(event) => patch("vehicleCode", event.target.value)}
            >
              <option value="">—</option>
              {KNOWN_VEHICLE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="ops-field">
            <span>{copy.currency}</span>
            <select
              value={form.currency}
              onChange={(event) =>
                patch("currency", event.target.value as DisplayCurrency)
              }
            >
              {DISPLAY_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="ops-field">
            <span>{copy.paymentMethod}</span>
            <select
              value={form.paymentMethod}
              onChange={(event) => patch("paymentMethod", event.target.value)}
            >
              <option value="">—</option>
              <option value="cash">{copy.paymentCash}</option>
              <option value="sbp">{copy.paymentSbp}</option>
            </select>
          </label>
        </div>
        <div className="ops-edit-price-row">
          <div>
            <p className="ops-selected-price-label">{copy.selectedPrice}</p>
            <p className="ops-selected-price-value">{selectedPrice || "—"}</p>
          </div>
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={() => setPriceModalOpen(true)}
          >
            {copy.editPrice}
          </button>
        </div>
      </section>

      <section className="ops-edit-section">
        <h3>{copy.customer}</h3>
        <div className="ops-edit-grid">
          <label className="ops-field">
            <span>{copy.firstName}</span>
            <input
              value={form.customerFirstName}
              onChange={(event) => patch("customerFirstName", event.target.value)}
            />
          </label>
          <label className="ops-field">
            <span>{copy.lastName}</span>
            <input
              value={form.customerLastName}
              onChange={(event) => patch("customerLastName", event.target.value)}
            />
          </label>
          <label className="ops-field">
            <span>{copy.email}</span>
            <input
              type="email"
              value={form.customerEmail}
              onChange={(event) => patch("customerEmail", event.target.value)}
            />
          </label>
          <label className="ops-field">
            <span>{copy.phone}</span>
            <input
              value={form.customerPhone}
              onChange={(event) => patch("customerPhone", event.target.value)}
            />
          </label>
          <label className="ops-field ops-field-wide">
            <span>{copy.passengerNote}</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => patch("notes", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="ops-edit-section">
        <h3>{copy.passengerInfo}</h3>
        {form.passengers.length === 0 ? (
          <p className="ops-empty">{copy.noPassengers}</p>
        ) : (
          <div className="ops-table-wrap ops-passenger-wrap">
            <table className="ops-table ops-passenger-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{copy.firstName}</th>
                  <th>{copy.lastName}</th>
                  <th>{copy.nationality}</th>
                  <th>{copy.gender}</th>
                  <th>{copy.identity}</th>
                  <th>{copy.primary}</th>
                </tr>
              </thead>
              <tbody>
                {form.passengers.map((passenger) => (
                  <tr key={passenger.sequenceNo}>
                    <td>{passenger.sequenceNo}</td>
                    <td>
                      <input
                        className="ops-inline-input"
                        value={passenger.firstName}
                        onChange={(event) =>
                          patchPassenger(passenger.sequenceNo, "firstName", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="ops-inline-input"
                        value={passenger.lastName}
                        onChange={(event) =>
                          patchPassenger(passenger.sequenceNo, "lastName", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="ops-inline-input"
                        value={passenger.countryCode}
                        onChange={(event) =>
                          patchPassenger(passenger.sequenceNo, "countryCode", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="ops-inline-input"
                        value={passenger.gender}
                        onChange={(event) =>
                          patchPassenger(passenger.sequenceNo, "gender", event.target.value)
                        }
                      >
                        <option value="">—</option>
                        <option value="female">{copy.genderFemale}</option>
                        <option value="male">{copy.genderMale}</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="ops-inline-input"
                        value={passenger.identityNumber}
                        onChange={(event) =>
                          patchPassenger(
                            passenger.sequenceNo,
                            "identityNumber",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>{passenger.isPrimary ? copy.yes : copy.no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? <p className="ops-form-error">{error}</p> : null}

      <div className="ops-edit-actions">
        <button type="button" className="ops-btn-ghost" onClick={onCancel} disabled={saving}>
          {copy.cancelEdit}
        </button>
        <button
          type="button"
          className="ops-btn-primary"
          onClick={() => onSave(form)}
          disabled={saving}
        >
          {saving ? copy.savingChanges : copy.saveChanges}
        </button>
      </div>

      <PriceEditModal
        locale={locale}
        copy={copy}
        open={priceModalOpen}
        fxSnapshot={form.fxSnapshot}
        totals={
          form.priceManuallyOverridden ? form.manualPriceTotals : form.calculatedPriceTotals
        }
        onClose={() => setPriceModalOpen(false)}
        onApply={(totals, overridden) => {
          setForm((current) => ({
            ...current,
            priceManuallyOverridden: overridden,
            manualPriceTotals: totals,
          }));
          setPriceModalOpen(false);
        }}
      />
    </div>
  );
}
