"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import { fillCopy, formatOpsDateTime, formatOpsDuration, listRowNumber } from "@/lib/ops/format";
import { driverTaskStageLabel } from "@/lib/ops/driver-task-copy";
import { formatOpsAmountOrDash } from "@/lib/ops/money";
import {
  nextReservationSortDir,
  reservationQueryRecord,
  type ReservationListFilters,
  type ReservationSortField,
} from "@/lib/ops/reservation-filters";
import { type ReservationListItem } from "@/lib/ops/reservation-types";
import { flightStatusBadge, flightNumberKey, trackingPickupIsAirport } from "@/lib/ops/flight-tracking";
import { reservationStatusLabel, reservationStatusBadgeClass, serviceLabel, paymentLabel, paymentProviderLabel, paymentStatusLabel, paymentStatusBadgeClass, refundStatusBadgeClass, refundStatusLabel } from "@/lib/ops/record-detail";
import { isPendingNoShowReview, isReservationOpsFinalStatus } from "@/lib/ops/no-show";
import { compactPaymentMovementLines } from "@/lib/ops/payment-history";
import { OpsReservationAssignmentCells } from "@/components/ops/reservation-assignment-cells";
import { OpsAssignmentCustomerNotifyCell } from "@/components/ops/assignment-customer-notify-cell";
import { OpsOccupancyCell } from "@/components/ops/occupancy-cell";
import { RecordDetailModal } from "@/components/ops/record-detail-modal";
import { type OpsAssignmentFleet, type OpsAssignmentPartnerOption } from "@/lib/ops/reservation-assignment-view";

type ReservationTableProps = {
  locale: Locale;
  copy: OpsCopy;
  items: ReservationListItem[];
  page: number;
  pageSize: number;
  filters: ReservationListFilters;
  partners: OpsAssignmentPartnerOption[];
  fleets: Record<string, OpsAssignmentFleet>;
  canAssign: boolean;
};

function SortHeader({
  locale,
  label,
  field,
  filters,
}: {
  locale: Locale;
  label: string;
  field: ReservationSortField;
  filters: ReservationListFilters;
}) {
  const active = filters.sort === field;
  const dir = active ? filters.dir || "asc" : "";
  const nextDir = nextReservationSortDir(filters.sort, filters.dir, field);
  const params = new URLSearchParams(
    Object.entries(reservationQueryRecord({ ...filters, sort: field, dir: nextDir })).filter(
      ([, value]) => value.length > 0,
    ),
  );
  const href = `${localizedPath(locale, "/ops/reservations")}?${params.toString()}`;
  const arrow = dir === "asc" ? "↑" : dir === "desc" ? "↓" : "";

  return (
    <th aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}>
      <a className={`ops-sort-link${active ? " is-active" : ""}`} href={href}>
        <span>{label}</span>
        {arrow ? (
          <span className="ops-sort-arrow" aria-hidden="true">
            {arrow}
          </span>
        ) : (
          <span className="ops-sort-arrow ops-sort-arrow-idle" aria-hidden="true">
            ↕
          </span>
        )}
      </a>
    </th>
  );
}

function FlightStatusCell({ item }: { item: ReservationListItem }) {
  const trackable =
    trackingPickupIsAirport({
      airportCode: item.pickupAirportCode,
      locationType: item.pickupLocationType,
      placeId: item.pickupPlaceId,
    }) && flightNumberKey(item.flightCode).length > 0;
  const badge = flightStatusBadge({
    trackable,
    snapshot: item.flightTracking,
  });
  if (!badge) {
    return "—";
  }
  return (
    <span className={`ops-flight-status is-${badge.tone}`}>{badge.label}</span>
  );
}

export function ReservationTable({
  locale,
  copy,
  items,
  page,
  pageSize,
  filters,
  partners,
  fleets,
  canAssign,
}: ReservationTableProps) {
  const router = useRouter();
  const headerRef = useRef<HTMLInputElement>(null);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const pageIds = useMemo(() => items.map((item) => item.id), [items]);
  const pageKey = pageIds.join(",");
  const filterKey = [
    filters.query,
    filters.status,
    filters.payment,
    filters.date,
    filters.from,
    filters.to,
    filters.sort,
    filters.dir,
  ].join("|");
  const [renderKeys, setRenderKeys] = useState({ filterKey, pageKey });

  if (renderKeys.filterKey !== filterKey) {
    setRenderKeys({ filterKey, pageKey });
    setIds(new Set());
    setDetailId(null);
  } else if (renderKeys.pageKey !== pageKey) {
    setRenderKeys({ filterKey, pageKey });
    setIds(new Set());
  }

  const pageSelected = pageIds.length > 0 && pageIds.every((id) => ids.has(id));
  const somePageChecked = !pageSelected && pageIds.some((id) => ids.has(id));

  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.indeterminate = somePageChecked;
    }
  }, [somePageChecked]);

  function isRowSelected(id: string) {
    return ids.has(id);
  }

  function toggleId(id: string) {
    const next = new Set(ids);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setIds(next);
  }

  function togglePage() {
    if (pageSelected) {
      setIds(new Set());
      return;
    }
    setIds(new Set(pageIds));
  }

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, id: string) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, label, .partner-job-assign-cell, .ops-passenger-notify-cell")) {
      return;
    }
    toggleId(id);
  }

  return (
    <>
      {ids.size > 0 ? (
        <div className="ops-selection-bar" role="status">
          <p>{fillCopy(copy.selectedCount, { n: ids.size })}</p>
          {pageSelected ? (
            <p>{fillCopy(copy.pageSelected, { n: pageIds.length })}</p>
          ) : null}
          <button
            type="button"
            className="ops-btn-ghost"
            onClick={() => setIds(new Set())}
          >
            {copy.clearSelection}
          </button>
        </div>
      ) : null}
      <div className="ops-table-wrap">
        <table className="ops-table ops-table-selectable">
          <thead>
            <tr>
              <th className="ops-check-col">
                <label className="ops-check-only">
                  <span className="ops-sr-only">{copy.selectColumn}</span>
                  <input
                    ref={headerRef}
                    type="checkbox"
                    checked={pageSelected}
                    onChange={togglePage}
                    disabled={pageIds.length === 0}
                  />
                </label>
              </th>
              <th className="ops-row-num-col">{copy.driverRowIndex}</th>
              <SortHeader
                locale={locale}
                label={copy.transferAt}
                field="pickup_at"
                filters={filters}
              />
              <th>{copy.reservationCode}</th>
              <SortHeader
                locale={locale}
                label={copy.created}
                field="created_at"
                filters={filters}
              />
              <th>{copy.serviceType}</th>
              <th>{copy.durationHours}</th>
              <th>{copy.pickup}</th>
              <th>{copy.dropoff}</th>
              <th className="ops-col-flight">{copy.flight}</th>
              <th className="ops-col-flight-status">{copy.flightStatus}</th>
              <th className="ops-col-meet">{copy.meetAndGreet}</th>
              <th>{copy.mainPassenger}</th>
              <th>{copy.phone}</th>
              <th>{copy.email}</th>
              <th className="ops-col-occupancy">{copy.passengerLuggageBaby}</th>
              <th>{copy.vehicle}</th>
              <th className="ops-col-assignment">{copy.assignmentPartner}</th>
              <th className="ops-col-assignment">{copy.assignmentDriver}</th>
              <th className="ops-col-assignment">{copy.assignmentVehicle}</th>
              <th className="ops-col-assignment">{copy.passengerNotify}</th>
              <th className="ops-col-operation">{copy.operationStatus}</th>
              <th>{copy.total}</th>
              <th>{copy.currency}</th>
              <th className="ops-col-payment">{copy.paymentMethod}</th>
              <th className="ops-col-payment">{copy.paymentProvider}</th>
              <th className="ops-col-payment">{copy.paymentStatus}</th>
              <th className="ops-col-payment">{copy.refundStatus}</th>
              <th className="ops-col-payment-movements">{copy.paymentMovementsColumn}</th>
              <th>{copy.status}</th>
              <th>{copy.details}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, rowIndex) => {
              const selected = isRowSelected(item.id);
              return (
                <tr
                  key={item.id}
                  className={selected ? "is-selected" : undefined}
                  aria-selected={selected}
                  onClick={(event) => onRowClick(event, item.id)}
                >
                  <td className="ops-check-col" onClick={(event) => event.stopPropagation()}>
                    <label className="ops-check-only">
                      <span className="ops-sr-only">{copy.selectColumn}</span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleId(item.id)}
                      />
                    </label>
                  </td>
                  <td className="ops-row-num-col">
                    {listRowNumber(page, pageSize, rowIndex)}
                  </td>
                  <td>{formatOpsDateTime(item.pickupAt, locale)}</td>
                  <td>
                    <span className="ops-cell-stack">
                      <span>{item.reservationCode}</span>
                      {isPendingNoShowReview(item.noShowReviewStatus, item.status) ? (
                        <span className="ops-no-show-badge">{copy.driverNoShowReviewBadge}</span>
                      ) : null}
                    </span>
                  </td>
                  <td>{formatOpsDateTime(item.createdAt, locale)}</td>
                  <td>
                    <span className="ops-cell-stack">
                      <span>
                        {serviceLabel(item.serviceType, copy, {
                          tourCode: item.tourCode,
                          locale,
                        })}
                      </span>
                    </span>
                  </td>
                  <td>{formatOpsDuration(item.durationHours, locale)}</td>
                  <td>{item.pickupName ?? "—"}</td>
                  <td>{item.dropoffName ?? "—"}</td>
                  <td className="ops-col-flight">{item.flightCode || "—"}</td>
                  <td className="ops-col-flight-status">
                    <FlightStatusCell item={item} />
                  </td>
                  <td className="ops-col-meet">
                    {item.meetAndGreet ? copy.yes : item.meetAndGreet === false ? copy.no : "—"}
                  </td>
                  <td>{item.customerName || "—"}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {item.customerPhone ? (
                      <span className="ops-contact-phone" tabIndex={0}>
                        {item.customerPhone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{item.customerEmail ?? "—"}</td>
                  <td className="ops-col-occupancy">
                    <OpsOccupancyCell
                      copy={copy}
                      passengerCount={item.passengerCount}
                      luggageCount={item.luggageCount}
                      babySeatCount={item.babySeatCount}
                    />
                  </td>
                  <td>{item.vehicleLabel ?? "—"}</td>
                  <OpsReservationAssignmentCells
                    locale={locale}
                    copy={copy}
                    item={item}
                    partners={partners}
                    drivers={item.acceptedPartnerId ? fleets[item.acceptedPartnerId]?.drivers ?? [] : []}
                    vehicles={item.acceptedPartnerId ? fleets[item.acceptedPartnerId]?.vehicles ?? [] : []}
                    canAssign={canAssign}
                  />
                  <td className="ops-col-assignment">
                    <OpsAssignmentCustomerNotifyCell
                      locale={locale}
                      copy={copy}
                      reservationId={item.id}
                      customerEmail={item.customerEmail}
                      locked={item.assignmentLocked}
                      canAssign={canAssign}
                      driver={item.driverAssignment}
                      vehicle={item.vehicleAssignment}
                      lastSent={item.lastAssignmentCustomerNotification}
                      assignmentUpdatedAt={item.assignmentUpdatedAt}
                    />
                  </td>
                  <td className="ops-col-operation">
                    {isReservationOpsFinalStatus(item.status) ? (
                      <span
                        className={`ops-status-badge ${reservationStatusBadgeClass(item.status)}`}
                      >
                        {reservationStatusLabel(item.status, copy)}
                      </span>
                    ) : (
                      driverTaskStageLabel(item.driverTaskStage, copy)
                    )}
                  </td>
                  <td className="ops-amount-cell">
                    {formatOpsAmountOrDash(item.totalPrice, locale)}
                  </td>
                  <td>{item.currency ?? "—"}</td>
                  <td className="ops-col-payment">
                    {paymentLabel(item.paymentMethod, copy) || "—"}
                  </td>
                  <td className="ops-col-payment">
                    {item.paymentMethod === "sbp"
                      ? paymentProviderLabel(item.paymentProvider)
                      : "—"}
                  </td>
                  <td className="ops-col-payment">
                    {item.paymentMethod === "sbp" && item.paymentStatus ? (
                      <span
                        className={`ops-status-badge ${paymentStatusBadgeClass(
                          item.paymentMethod,
                          item.paymentStatus,
                        )}`}
                      >
                        {paymentStatusLabel(item.paymentMethod, item.paymentStatus, copy)}
                      </span>
                    ) : (
                      paymentStatusLabel(item.paymentMethod, item.paymentStatus, copy)
                    )}
                  </td>
                  <td className="ops-col-payment">
                    {item.paymentMethod === "sbp" && item.refundStatus ? (
                      <span
                        className={`ops-status-badge ${refundStatusBadgeClass(item.refundStatus)}`}
                      >
                        {refundStatusLabel(item.paymentMethod, item.refundStatus, copy)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="ops-col-payment-movements">
                    {item.paymentMethod === "sbp" && item.paymentMovements.length > 0 ? (
                      <span className="ops-payment-movements-cell">
                        {compactPaymentMovementLines(
                          item.paymentMovements,
                          copy,
                          locale,
                          2,
                        ).map((line) => (
                          <span key={line} className="ops-payment-movements-line">
                            {line}
                          </span>
                        ))}
                      </span>
                    ) : (
                      copy.paymentMovementsNone
                    )}
                  </td>
                  <td>
                    <span
                      className={`ops-status-badge ${reservationStatusBadgeClass(item.status)}`}
                    >
                      {reservationStatusLabel(item.status, copy)}
                    </span>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="ops-row-detail"
                      onClick={() => setDetailId(item.id)}
                    >
                      {copy.details}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <RecordDetailModal
        locale={locale}
        copy={copy}
        kind="reservation"
        id={detailId}
        onClose={() => setDetailId(null)}
        onDeleted={() => router.refresh()}
        onUpdated={() => router.refresh()}
      />
    </>
  );
}
