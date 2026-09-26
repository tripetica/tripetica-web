"use client";

import { useRef, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { listRowNumber } from "@/lib/ops/format";
import {
  formatUetdsAuthorityDocument,
  type UetdsCompanyListItem,
  type UetdsIntegrationStatus,
} from "@/lib/ops/uetds-company-fields";

type UetdsCompanyTableProps = {
  locale: Locale;
  copy: OpsCopy;
  items: UetdsCompanyListItem[];
  page: number;
  pageSize: number;
  canManage: boolean;
  onEdit: (id: string) => void;
};

function integrationLabel(status: UetdsIntegrationStatus, copy: OpsCopy) {
  if (status === "ready") {
    return copy.uetdsIntegrationReady;
  }
  if (status === "error") {
    return copy.uetdsIntegrationError;
  }
  return copy.uetdsIntegrationIncomplete;
}

function integrationClass(status: UetdsIntegrationStatus) {
  if (status === "ready") {
    return "is-config-ready";
  }
  if (status === "error") {
    return "is-inactive";
  }
  return "is-pending";
}

export function UetdsCompanyTable({
  copy,
  items,
  page,
  pageSize,
  canManage,
  onEdit,
}: UetdsCompanyTableProps) {
  const headerRef = useRef<HTMLInputElement>(null);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const pageIds = items.map((item) => item.id);
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => ids.has(id));

  function togglePage() {
    setIds((current) => {
      const next = new Set(current);
      if (pageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleId(id: string) {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (headerRef.current) {
    headerRef.current.indeterminate = ids.size > 0 && !pageSelected;
  }

  return (
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
            <th>{copy.uetdsCompany}</th>
            <th>{copy.uetdsAuthorityDocument}</th>
            <th>{copy.uetdsIntegration}</th>
            <th>{copy.status}</th>
            {canManage ? <th>{copy.edit}</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => {
            const selected = ids.has(item.id);
            return (
              <tr key={item.id} className={selected ? "is-selected" : undefined}>
                <td className="ops-check-col">
                  <label className="ops-check-only">
                    <span className="ops-sr-only">{copy.selectColumn}</span>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleId(item.id)}
                    />
                  </label>
                </td>
                <td className="ops-row-num-col">{listRowNumber(page, pageSize, rowIndex)}</td>
                <td>
                  <span className="ops-cell-stack">
                    <span>{item.shortName}</span>
                    {item.legalName !== item.shortName ? (
                      <span className="ops-cell-sub">{item.legalName}</span>
                    ) : null}
                  </span>
                </td>
                <td>
                  {formatUetdsAuthorityDocument(
                    item.authorityDocumentType,
                    item.authorityDocumentNumber,
                  )}
                </td>
                <td>
                  <span
                    className={`ops-status-badge ${integrationClass(item.integrationStatus)}`}
                    title={
                      item.integrationStatus === "ready"
                        ? copy.uetdsIntegrationReadyHint
                        : undefined
                    }
                  >
                    {integrationLabel(item.integrationStatus, copy)}
                  </span>
                </td>
                <td>
                  <span
                    className={`ops-status-badge ${item.status === "active" ? "is-active" : "is-inactive"}`}
                  >
                    {item.status === "active" ? copy.active : copy.inactive}
                  </span>
                </td>
                {canManage ? (
                  <td>
                    <button
                      type="button"
                      className="ops-row-detail"
                      onClick={() => onEdit(item.id)}
                    >
                      {copy.edit}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
