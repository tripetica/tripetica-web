"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type PartnerRefreshButtonProps = {
  label: string;
  busyLabel?: string;
  className?: string;
};

export function PartnerRefreshButton({
  label,
  busyLabel,
  className,
}: PartnerRefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    if (pending) {
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={`ops-btn-secondary partner-refresh-btn${className ? ` ${className}` : ""}`}
      disabled={pending}
      aria-label={label}
      aria-busy={pending}
      onClick={refresh}
    >
      <span className={`partner-refresh-icon${pending ? " is-busy" : ""}`} aria-hidden>
        ↻
      </span>
      <span className="partner-refresh-label">{pending && busyLabel ? busyLabel : label}</span>
    </button>
  );
}
