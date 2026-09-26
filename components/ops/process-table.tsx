"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  deleteProcessesAction,
  previewProcessDeleteAction,
} from "@/lib/ops/actions";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { fillCopy, formatOpsDateTime, formatOpsDistance, formatOpsDuration, listRowNumber } from "@/lib/ops/format";
import { formatOpsAmountOrDash } from "@/lib/ops/money";
import { type ProcessListFilters } from "@/lib/ops/process-filters";
import { type ProcessListItem } from "@/lib/ops/process-types";
import { serviceLabel } from "@/lib/ops/record-detail";
import { OpsOccupancyCell } from "@/components/ops/occupancy-cell";
import { RecordDetailModal } from "@/components/ops/record-detail-modal";

type SelectionMode = "none" | "page" | "filtered";

type ProcessTableProps = {
  locale: Locale;
  copy: OpsCopy;
  items: ProcessListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: ProcessListFilters;
  canDelete: boolean;
};

type Preview = {
  selected: number;
  deletable: number;
  protectedCount: number;
};

export function ProcessTable({
  locale,
  copy,
  items,
  total,
  page,
  pageSize,
  filters,
  canDelete,
}: ProcessTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const headerRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<SelectionMode>("none");
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reservationDetailId, setReservationDetailId] = useState<string | null>(null);
  const pageIds = useMemo(() => items.map((item) => item.id), [items]);
  const pageKey = pageIds.join(",");
  const filterKey = [
    filters.query,
    filters.status,
    filters.locale,
    filters.conversion,
    filters.date,
    filters.from,
    filters.to,
  ].join("|");
  const [renderKeys, setRenderKeys] = useState({ filterKey, pageKey });

  if (renderKeys.filterKey !== filterKey) {
    setRenderKeys({ filterKey, pageKey });
    setMode("none");
    setIds(new Set());
    setModalOpen(false);
    setPreview(null);
    setPreviewError(null);
    setNotice(null);
    setDetailId(null);
    setReservationDetailId(null);
  } else if (renderKeys.pageKey !== pageKey) {
    setRenderKeys({ filterKey, pageKey });
    setMode((current) => {
      if (current === "filtered") {
        return current;
      }
      return "none";
    });
    setIds(new Set());
  }

  const pageSelected =
    pageIds.length > 0 && pageIds.every((id) => ids.has(id));
  const selectedCount = mode === "filtered" ? total : ids.size;
  const allPageChecked = mode === "filtered" || pageSelected;
  const somePageChecked =
    !allPageChecked && pageIds.some((id) => ids.has(id));

  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.indeterminate = somePageChecked;
    }
  }, [somePageChecked]);

  function isRowSelected(id: string) {
    return mode === "filtered" || ids.has(id);
  }

  function toggleId(id: string) {
    if (mode === "filtered") {
      const next = new Set(pageIds.filter((item) => item !== id));
      setIds(next);
      setMode(next.size ? "page" : "none");
      return;
    }
    const next = new Set(ids);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setIds(next);
    setMode(next.size ? "page" : "none");
  }

  function togglePage() {
    if (allPageChecked) {
      setMode("none");
      setIds(new Set());
      return;
    }
    setMode("page");
    setIds(new Set(pageIds));
  }

  function payload() {
    return {
      locale,
      mode: mode === "filtered" ? ("filtered" as const) : ("ids" as const),
      ids: mode === "filtered" ? [] : Array.from(ids),
      filters: {
        query: filters.query,
        status: filters.status,
        locale: filters.locale,
        conversion: filters.conversion,
        date: filters.date,
        from: filters.from,
        to: filters.to,
      },
    };
  }

  function openDeleteModal() {
    if (!canDelete || selectedCount === 0) {
      return;
    }
    setModalOpen(true);
    setPreview(null);
    setPreviewError(null);
    startTransition(async () => {
      const result = await previewProcessDeleteAction(payload());
      if (result.error === "forbidden") {
        setPreviewError(copy.forbidden);
        return;
      }
      if (result.error) {
        setPreviewError(copy.deleteNothing);
        return;
      }
      setPreview({
        selected: result.selected,
        deletable: result.deletable,
        protectedCount: result.protectedCount,
      });
    });
  }

  function confirmDelete() {
    if (!canDelete || !preview || preview.deletable === 0) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProcessesAction(payload());
      if (result.error === "forbidden") {
        setPreviewError(copy.forbidden);
        return;
      }
      if (result.error === "failed") {
        setPreviewError(copy.deleteFailed);
        return;
      }
      if (result.error) {
        setPreviewError(copy.deleteNothing);
        return;
      }
      setNotice(
        fillCopy(copy.deleteResult, {
          d: result.deleted,
        }),
      );
      setModalOpen(false);
      setPreview(null);
      setMode("none");
      setIds(new Set());
      router.refresh();
    });
  }

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, id: string) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, label")) {
      return;
    }
    toggleId(id);
  }

  return (
    <>
      {notice ? <p className="ops-form-ok">{notice}</p> : null}
      {selectedCount > 0 ? (
        <div className="ops-selection-bar" role="status">
          <p>
            {mode === "filtered"
              ? fillCopy(copy.allFilteredSelected, { n: total })
              : fillCopy(copy.selectedCount, { n: selectedCount })}
          </p>
          {mode === "page" && pageSelected ? (
            <p>{fillCopy(copy.pageSelected, { n: pageIds.length })}</p>
          ) : null}
          {mode === "page" && pageSelected && total > pageIds.length ? (
            <button
              type="button"
              className="ops-btn-secondary"
              onClick={() => {
                setMode("filtered");
                setIds(new Set());
              }}
            >
              {fillCopy(copy.selectAllFiltered, { n: total })}
            </button>
          ) : null}
          <button
            type="button"
            className="ops-btn-ghost"
            onClick={() => {
              setMode("none");
              setIds(new Set());
            }}
          >
            {copy.clearSelection}
          </button>
          {canDelete ? (
            <button type="button" className="ops-btn-danger" onClick={openDeleteModal}>
              {copy.deleteSelected}
            </button>
          ) : null}
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="ops-empty">{copy.emptyProcesses}</p>
      ) : (
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
                    checked={allPageChecked}
                    onChange={togglePage}
                    disabled={pageIds.length === 0}
                  />
                </label>
              </th>
              <th className="ops-row-num-col">{copy.driverRowIndex}</th>
              <th>{copy.transferAt}</th>
              <th>{copy.createdAt}</th>
              <th>{copy.updatedAt}</th>
              <th>{copy.status}</th>
              <th>{copy.stage}</th>
              <th>{copy.locale}</th>
              <th>{copy.serviceType}</th>
              <th>{copy.durationHours}</th>
              <th>{copy.pickup}</th>
              <th>{copy.dropoff}</th>
              <th className="ops-col-occupancy">{copy.passengerLuggageBaby}</th>
              <th>{copy.vehicleClass}</th>
              <th>{copy.flight}</th>
              <th>{copy.meetAndGreet}</th>
              <th>{copy.kilometre}</th>
              <th>{copy.total}</th>
              <th>{copy.currency}</th>
              <th>{copy.email}</th>
              <th>{copy.phone}</th>
              <th>{copy.paymentMethod}</th>
              <th>{copy.conversion}</th>
              <th>{copy.details}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, rowIndex) => {
              const selected = isRowSelected(item.id);
              const classes = [
                item.converted ? "is-converted" : "",
                selected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={item.id}
                  className={classes || undefined}
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
                  <td>{formatOpsDateTime(item.createdAt, locale)}</td>
                  <td>{formatOpsDateTime(item.updatedAt, locale)}</td>
                  <td>{item.status ?? "—"}</td>
                  <td>{item.currentStage ?? "—"}</td>
                  <td>{item.locale ?? "—"}</td>
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
                  <td className="ops-col-occupancy">
                    <OpsOccupancyCell
                      copy={copy}
                      passengerCount={item.passengerCount}
                      luggageCount={item.luggageCount}
                      babySeatCount={item.babySeatCount}
                    />
                  </td>
                  <td>{item.vehicleLabel ?? "—"}</td>
                  <td>{item.flightCode ?? "—"}</td>
                  <td>
                    {item.meetAndGreet === true
                      ? copy.yes
                      : item.meetAndGreet === false
                        ? copy.no
                        : "—"}
                  </td>
                  <td>{formatOpsDistance(item.distanceKm, locale) || "—"}</td>
                  <td className="ops-amount-cell">{formatOpsAmountOrDash(item.price, locale)}</td>
                  <td>{item.currency ?? "—"}</td>
                  <td>{item.email ?? "—"}</td>
                  <td>{item.phone ?? "—"}</td>
                  <td>{item.paymentMethod ?? "—"}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {item.converted && item.reservationCode && item.reservationId ? (
                      <button
                        type="button"
                        className="ops-reservation-code-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          setReservationDetailId(item.reservationId);
                        }}
                      >
                        {item.reservationCode}
                      </button>
                    ) : (
                      copy.notConverted
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ops-row-detail"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailId(item.id);
                      }}
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
      )}
      {modalOpen ? (
        <div
          className="ops-modal-backdrop"
          role="presentation"
          onClick={() => !pending && setModalOpen(false)}
        >
          <div
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="ops-delete-title">{copy.deleteModalTitle}</h2>
            {previewError ? <p className="ops-form-error">{previewError}</p> : null}
            {!preview && !previewError ? <p>{copy.deleting}</p> : null}
            {preview ? (
              <>
                {preview.deletable > 0 ? (
                  <p>{fillCopy(copy.deleteModalBody, { n: preview.deletable })}</p>
                ) : (
                  <p>{copy.deleteNothing}</p>
                )}
              </>
            ) : null}
            <div className="ops-modal-actions">
              <button
                type="button"
                className="ops-btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={pending}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                className="ops-btn-danger"
                onClick={confirmDelete}
                disabled={pending || !preview || preview.deletable === 0}
              >
                {pending ? copy.deleting : copy.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <RecordDetailModal
        locale={locale}
        copy={copy}
        kind="process"
        id={detailId}
        onClose={() => setDetailId(null)}
      />
      <RecordDetailModal
        locale={locale}
        copy={copy}
        kind="reservation"
        id={reservationDetailId}
        onClose={() => setReservationDetailId(null)}
      />
    </>
  );
}
