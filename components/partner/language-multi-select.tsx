"use client";

import { useMemo, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import {
  partnerDriverLanguageOptions,
  partnerDriverLanguageSearchHaystack,
  type PartnerDriverLanguageCode,
} from "@/lib/partner/driver-languages";

type LanguageMultiSelectProps = {
  locale: Locale;
  value: string[];
  searchLabel: string;
  emptyLabel: string;
  selectedLabel: string;
  includeFormField?: boolean;
  onChange: (codes: string[]) => void;
};

export function LanguageMultiSelect({
  locale,
  value,
  searchLabel,
  emptyLabel,
  selectedLabel,
  includeFormField = true,
  onChange,
}: LanguageMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => partnerDriverLanguageOptions(locale), [locale]);
  const selected = options.filter((item) => value.includes(item.code));
  const available = options.filter((item) => {
    if (value.includes(item.code)) {
      return false;
    }
    const haystack = partnerDriverLanguageSearchHaystack(item.code as PartnerDriverLanguageCode);
    return haystack.includes(query.trim().toLocaleLowerCase("tr"));
  });

  function add(code: string) {
    if (value.includes(code)) {
      return;
    }
    onChange([...value, code]);
    setQuery("");
  }

  function remove(code: string) {
    onChange(value.filter((item) => item !== code));
  }

  return (
    <div className="partner-language-select">
      {includeFormField ? <input type="hidden" name="languages" value={value.join(",")} /> : null}
      {selected.length > 0 ? (
        <div className="partner-language-chips" aria-label={selectedLabel}>
          {selected.map((item) => (
            <button
              key={item.code}
              type="button"
              className="partner-language-chip"
              onClick={() => remove(item.code)}
            >
              {item.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
      <input
        className="partner-language-search"
        value={query}
        placeholder={searchLabel}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open ? (
        <ul className="partner-language-menu" role="listbox">
          {available.length === 0 ? (
            <li className="partner-language-empty">{emptyLabel}</li>
          ) : (
            available.map((item) => (
              <li key={item.code}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(item.code)}>
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
