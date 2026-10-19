"use client";

import { useState, type MouseEvent } from "react";

const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, form, [role='button'], [contenteditable='true']";

export function useRowSelection(rowIds: string[]) {
  const [storedIds, setStoredIds] = useState<Set<string>>(new Set());
  const visibleIds = new Set(rowIds);
  const selectedIds = new Set(
    [...storedIds].filter((id) => visibleIds.has(id)),
  );

  const allSelected =
    rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
  function toggle(id: string) {
    setStoredIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setStoredIds(allSelected ? new Set() : new Set(rowIds));
  }

  function onRowClick(event: MouseEvent<HTMLTableRowElement>, id: string) {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) {
      return;
    }
    toggle(id);
  }

  return {
    selectedIds,
    allSelected,
    toggle,
    toggleAll,
    onRowClick,
  };
}
