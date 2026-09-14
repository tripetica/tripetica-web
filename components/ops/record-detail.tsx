"use client";

import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  isOpsContactRow,
  type OpsDetailPlace,
  type OpsRecordDetail,
} from "@/lib/ops/record-detail";
import { DriverTaskSection } from "@/components/ops/driver-task-section";
import { PaymentHistorySection } from "@/components/ops/payment-history-section";

type RecordDetailProps = {
  locale: Locale;
  copy: OpsCopy;
  detail: OpsRecordDetail;
  contactsVisible?: boolean;
  onToggleContacts?: () => void;
  onPaymentHistoryUpdated?: (detail: OpsRecordDetail) => void;
  showFooterPdf?: boolean;
};

type DetailRowView = OpsRecordDetail["transfer"][number] & {
  statusBadge?: "active" | "cancelled";
  strongAmount?: boolean;
};

function reservationLeadingRows(
  detail: OpsRecordDetail,
  copy: OpsCopy,
): DetailRowView[] {
  if (detail.kind !== "reservation") {
    return [];
  }
  const rows: DetailRowView[] = [];
  if (detail.status) {
    const cancelled = detail.status === "cancelled";
    rows.push({
      label: copy.status,
      value: cancelled ? copy.reservationStatusCancelled : copy.reservationStatusActive,
      statusBadge: cancelled ? "cancelled" : "active",
    });
  }
  rows.push(...detail.summary, ...detail.service);
  return rows;
}

export function RecordDetail({
  locale,
  copy,
  detail,
  contactsVisible = true,
  onToggleContacts,
  onPaymentHistoryUpdated,
  showFooterPdf = true,
}: RecordDetailProps) {
  const isReservation = detail.kind === "reservation";

  const reservationMainRows = isReservation
    ? [
        ...detail.vehicle,
        ...detail.transfer,
      ]
    : [];

  const processVehiclePriceRows = isReservation
    ? []
    : [
        ...detail.vehicle,
        ...(detail.selectedPrice
          ? [{ label: copy.selectedPrice, value: detail.selectedPrice }]
          : []),
      ];

  return (
    <div className="ops-record-detail">
      <header className="ops-detail-hero">
        <p className="ops-detail-brand">Tripetica</p>
        <h2>{detail.title}</h2>
        {detail.code ? <p className="ops-detail-code">{detail.code}</p> : null}
      </header>
      {detail.kind === "process" ? (
        <dl className="ops-detail-summary">
          {detail.summary.map((item) => (
            <div key={item.label} className="ops-kv">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section>
        {isReservation ? (
          <DetailRows rows={reservationLeadingRows(detail, copy)} />
        ) : (
          <DetailRows rows={detail.service} />
        )}
        {detail.places.map((place) => (
          <DetailPlaceRow key={place.label} place={place} />
        ))}
        {isReservation ? (
          <DetailRows rows={reservationMainRows} />
        ) : (
          <>
            <DetailRows rows={detail.transfer} />
            <section>
              <h3>{copy.vehiclePrice}</h3>
              <DetailRows rows={processVehiclePriceRows} />
            </section>
          </>
        )}
        {detail.otherCurrencies.length > 0 ? (
          isReservation ? (
            <div className="ops-alt-amounts">
              <p className="ops-alt-amounts-label">{copy.alternatePaymentHint}</p>
              <p className="ops-alt-amounts-line">
                {detail.otherCurrencies.map((item, index) => (
                  <span key={item} className="ops-alt-amount-group">
                    {index > 0 ? (
                      <span className="ops-alt-sep" aria-hidden="true">
                        {" · "}
                      </span>
                    ) : null}
                    <span className="ops-alt-amount">{item}</span>
                  </span>
                ))}
              </p>
            </div>
          ) : (
            <div className="ops-other-currencies">
              <p className="ops-other-currencies-label">{copy.otherCurrencies}</p>
              <ul>
                {detail.otherCurrencies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </section>

      {isReservation ? (
        <section className="ops-contact-section">
          <div className="ops-customer-heading">
            <h3>{copy.contactInfo}</h3>
          </div>
          {contactsVisible ? (
            <DetailRows
              rows={detail.customer.filter((item) => isOpsContactRow(item.label, copy))}
            />
          ) : null}
          {onToggleContacts ? (
            <div className="ops-contact-toggle-wrap">
              <button
                type="button"
                className="ops-btn-secondary ops-contact-toggle"
                onClick={onToggleContacts}
              >
                {contactsVisible ? copy.hideContact : copy.showContact}
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="ops-customer-section">
          <div className="ops-customer-heading">
            <h3>{copy.customer}</h3>
          </div>
          <DetailRows rows={detail.customer} />
        </section>
      )}

      {detail.passengerNote ? (
        <section className="ops-passenger-note">
          <h3>{copy.passengerNote}</h3>
          <p className="ops-passenger-note-value">{detail.passengerNote}</p>
        </section>
      ) : null}

      <section>
        <h3>{copy.passengerInfo}</h3>
        {detail.passengers.length === 0 ? (
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
                  {!isReservation ? <th>{copy.primary}</th> : null}
                </tr>
              </thead>
              <tbody>
                {detail.passengers.map((passenger) => (
                  <tr key={passenger.sequenceNo}>
                    <td>{passenger.sequenceNo}</td>
                    <td>{passenger.firstName}</td>
                    <td>{passenger.lastName}</td>
                    <td>{passenger.nationality}</td>
                    <td>{passenger.gender}</td>
                    <td>{passenger.identity}</td>
                    {!isReservation ? <td>{passenger.isPrimary}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail.operationAssignment ? (
        <section className="ops-assignment-section">
          <h3>{copy.assignmentSection}</h3>
          <h4 className="ops-assignment-subhead">{copy.assignmentPartner}</h4>
          <DetailRows rows={detail.operationAssignment.partner} />
          <h4 className="ops-assignment-subhead">{copy.assignmentDriver}</h4>
          <DetailRows rows={detail.operationAssignment.driver} />
          <h4 className="ops-assignment-subhead">{copy.assignmentVehicle}</h4>
          <DetailRows rows={detail.operationAssignment.vehicle} />
        </section>
      ) : null}

      {detail.driverTask ? (
        <DriverTaskSection
          copy={copy}
          reservationId={detail.id}
          driverTask={detail.driverTask}
        />
      ) : null}

      {detail.technical && detail.technical.length > 0 ? (
        <section>
          <h3>{copy.technical}</h3>
          <DetailRows rows={detail.technical} />
        </section>
      ) : null}

      {detail.kind === "process" && showFooterPdf ? (
        <p className="ops-detail-actions">
          <a className="ops-btn-primary" href={detail.pdfHref}>
            {copy.downloadPdf}
          </a>
        </p>
      ) : null}

      {detail.kind === "reservation" && detail.paymentHistory ? (
        <PaymentHistorySection
          locale={locale}
          copy={copy}
          reservationId={detail.id}
          section={detail.paymentHistory}
          onUpdated={onPaymentHistoryUpdated}
        />
      ) : null}
    </div>
  );
}

function DetailRows({ rows }: { rows: DetailRowView[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className="ops-dl">
      {rows.map((item) => (
        <div
          key={`${item.label}:${item.value}:${item.note ?? ""}:${item.statusBadge ?? ""}`}
          className={`ops-kv${item.statusBadge ? " ops-kv-status" : ""}`}
        >
          <dt>{item.label}</dt>
          <dd>
            {item.statusBadge ? (
              <span
                className={`ops-status-badge${
                  item.statusBadge === "cancelled" ? " is-cancelled" : " is-active"
                }`}
              >
                {item.value}
              </span>
            ) : (
              <span
                className={
                  item.strongAmount
                    ? "ops-kv-primary ops-kv-amount-strong"
                    : item.emphasizeValue
                      ? "ops-kv-primary"
                      : undefined
                }
              >
                {item.value}
              </span>
            )}
            {item.note ? <span className="ops-kv-secondary">{item.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailPlaceRow({ place }: { place: OpsDetailPlace }) {
  if (!place.name && !place.address) {
    return null;
  }
  return (
    <div className="ops-kv">
      <dt>{place.label}</dt>
      <dd>
        {place.name ? <span className="ops-kv-primary">{place.name}</span> : null}
        {place.address ? <span className="ops-kv-secondary">{place.address}</span> : null}
      </dd>
    </div>
  );
}
