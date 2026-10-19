"use client";

import { type ReactNode } from "react";
import { listRowNumber } from "@/lib/ops/format";
import { useRowSelection } from "@/components/ops/use-row-selection";

type SelectableTableRow = {
  id: string;
  cells: ReactNode[];
};

export function OpsSelectableTable({
  headers,
  rows,
  page,
  pageSize,
  selectLabel,
  numberLabel = "NO",
  className = "",
}: {
  headers: ReactNode;
  rows: SelectableTableRow[];
  page: number;
  pageSize: number;
  selectLabel: string;
  numberLabel?: string;
  className?: string;
}) {
  const selection = useRowSelection(rows.map((row) => row.id));

  return (
    <div className="ops-table-wrap">
      <table className={`ops-table ops-table-selectable ops-entity-selectable ${className}`.trim()}>
        <thead>
          <tr>
            <th className="ops-row-num-col">{numberLabel}</th>
            <th className="ops-check-col">
              <label className="ops-check-only">
                <span className="ops-sr-only">{selectLabel}</span>
                <input
                  type="checkbox"
                  checked={selection.allSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </label>
            </th>
            {headers}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const selected = selection.selectedIds.has(row.id);
            return (
              <tr
                key={row.id}
                className={selected ? "is-selected" : undefined}
                aria-selected={selected}
                onClick={(event) => selection.onRowClick(event, row.id)}
              >
                <td className="ops-row-num-col">
                  {listRowNumber(page, pageSize, rowIndex)}
                </td>
                <td className="ops-check-col" onClick={(event) => event.stopPropagation()}>
                  <label className="ops-check-only">
                    <span className="ops-sr-only">{selectLabel}</span>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => selection.toggle(row.id)}
                    />
                  </label>
                </td>
                {row.cells.map((cell, index) => (
                  <td key={index}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
