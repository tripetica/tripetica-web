"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UetdsCompanyDialog } from "@/components/ops/uetds-company-dialog";
import { UetdsCompanyTable } from "@/components/ops/uetds-company-table";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { loadUetdsCompanyEditorAction } from "@/lib/ops/uetds-company-actions";
import { type UetdsCompanyEditor, type UetdsCompanyListItem } from "@/lib/ops/uetds-company-fields";
import { type UetdsCompanyListFilters } from "@/lib/ops/uetds-company-filters";

type UetdsCompaniesScreenProps = {
  locale: Locale;
  copy: OpsCopy;
  items: UetdsCompanyListItem[];
  filters: UetdsCompanyListFilters;
  page: number;
  pageSize: number;
  canManage: boolean;
};

export function UetdsCompaniesScreen({
  locale,
  copy,
  items,
  filters,
  page,
  pageSize,
  canManage,
}: UetdsCompaniesScreenProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editor, setEditor] = useState<UetdsCompanyEditor | null>(null);
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditor(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    startTransition(async () => {
      const next = await loadUetdsCompanyEditorAction(id);
      if (!next) {
        return;
      }
      setEditor(next);
      setDialogOpen(true);
    });
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditor(null);
  }

  return (
    <>
      <div className="ops-uetds-toolbar">
        <form className="ops-filters" method="get">
          <input
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder={copy.uetdsCompanySearchPlaceholder}
          />
          <select name="status" defaultValue={filters.status}>
            <option value="">
              {copy.status}: {copy.all}
            </option>
            <option value="active">{copy.active}</option>
            <option value="inactive">{copy.inactive}</option>
          </select>
          <button type="submit" className="ops-btn-secondary">
            {copy.filter}
          </button>
        </form>
        {canManage ? (
          <button type="button" className="ops-btn-primary" onClick={openCreate}>
            {copy.uetdsNewCompany}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="ops-empty">
          {filters.query || filters.status ? copy.uetdsEmptyCompanySearch : copy.uetdsEmptyCompanies}
        </p>
      ) : (
        <UetdsCompanyTable
          locale={locale}
          copy={copy}
          items={items}
          page={page}
          pageSize={pageSize}
          canManage={canManage}
          onEdit={openEdit}
        />
      )}
      {dialogOpen ? (
        <UetdsCompanyDialog
          locale={locale}
          copy={copy}
          company={editor}
          onClose={closeDialog}
          onSaved={() => {
            closeDialog();
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
