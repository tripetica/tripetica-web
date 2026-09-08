"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type OpsRefreshButtonProps = {
  label: string;
  busyLabel?: string;
  className?: string;
};

export function OpsRefreshButton({ label, busyLabel, className }: OpsRefreshButtonProps) {
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
      className={`ops-btn-secondary ops-refresh-btn${className ? ` ${className}` : ""}`}
      disabled={pending}
      aria-label={label}
      aria-busy={pending}
      onClick={refresh}
    >
      <span className={`ops-refresh-icon${pending ? " is-busy" : ""}`} aria-hidden>
        ↻
      </span>
      <span className="ops-refresh-label">{pending && busyLabel ? busyLabel : label}</span>
    </button>
  );
}
