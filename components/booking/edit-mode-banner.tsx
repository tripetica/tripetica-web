"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { accountAbandonReservationEditAction } from "@/lib/account/actions";
import { accountCopy } from "@/lib/account/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export function EditModeBanner({
  locale,
  reservationCode,
  reservationId = null,
  opsEditMode = false,
  opsEditWithinSixHours = false,
}: {
  locale: Locale;
  reservationCode: string;
  reservationId?: string | null;
  opsEditMode?: boolean;
  opsEditWithinSixHours?: boolean;
}) {
  const copy = accountCopy[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const title = (opsEditMode ? copy.opsEditModeBanner : copy.editModeBanner).replace(
    "{code}",
    reservationCode,
  );

  return (
    <div className="booking-edit-mode-banner" role="status">
      <p>{title}</p>
      {opsEditMode && opsEditWithinSixHours ? (
        <p className="booking-edit-mode-banner-warning">
          {copy.opsEditWithinSixHoursWarning}
        </p>
      ) : null}
      <button
        type="button"
        className="account-btn-ghost"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await accountAbandonReservationEditAction(locale);
            if (!result.ok) {
              return;
            }
            if (result.opsEdit && result.reservationId) {
              router.push(
                localizedPath(
                  locale,
                  `/ops/reservations/${result.reservationId}`,
                ),
              );
            } else {
              router.push(localizedPath(locale, "/"));
            }
            router.refresh();
          });
        }}
      >
        {copy.editModeAbandon}
      </button>
    </div>
  );
}
