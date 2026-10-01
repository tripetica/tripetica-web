import { notFound, redirect } from "next/navigation";
import { UetdsNotificationForm } from "@/components/uetds/uetds-notification-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { createEmptyDraft, type UetdsDraft } from "@/lib/uetds/draft";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { loadUetdsFormDraft } from "@/lib/uetds/form-drafts";
import {
  listUetdsDriverOptions,
  listUetdsVehicleOptions,
  withSelectedUetdsOptions,
} from "@/lib/uetds/fleet-scope";
import { mergeSavedReservationDraft } from "@/lib/uetds/prefill";
import { loadUetdsReservationContext } from "@/lib/uetds/reservation-context";
import { findActiveUetdsNotificationForReservation } from "@/lib/uetds/reservation-notification";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { defaultUetdsEndFromStart } from "@/lib/uetds/trip-time";
import { listAssignableEdevletAuthorities } from "@/lib/partner/fleet-pairing";

export const dynamic = "force-dynamic";

function reservationParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function fillEmptyEnd(draft: UetdsDraft) {
  if (draft.startDate && draft.startTime && (!draft.endDate || !draft.endTime)) {
    const end = defaultUetdsEndFromStart(draft.startDate, draft.startTime);
    return { ...draft, endDate: end.date, endTime: end.time, endManual: false };
  }
  return draft;
}

export default async function OpsUetdsNewNotificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "uetds.view");
  const query = await searchParams;
  const reservationId = reservationParam(query.reservation);
  const context = reservationId ? await loadUetdsReservationContext(reservationId) : null;
  if (reservationId && !context) {
    notFound();
  }
  if (reservationId) {
    const existing = await findActiveUetdsNotificationForReservation({ reservationId });
    if (existing) {
      redirect(localizedPath(locale, `/ops/uetds/notifications/${existing.id}?editMethod=1`));
    }
  }
  const saved = await loadUetdsFormDraft({
    actor: { type: "ops", userId: actor.id, partnerId: null },
    reservationId: context?.draft.reservationId ?? null,
  });
  const fresh = context ? fillEmptyEnd(context.draft) : null;
  const draft = fresh
    ? saved && saved.reservationId === fresh.reservationId
      ? mergeSavedReservationDraft(saved, fresh)
      : fresh
    : (saved ?? createEmptyDraft("manual"));
  const [listedDrivers, listedVehicles, authorities] = await Promise.all([
    listUetdsDriverOptions({ scope: "ops" }),
    listUetdsVehicleOptions({ scope: "ops" }),
    listAssignableEdevletAuthorities({ partnerId: null }),
  ]);
  const { drivers, vehicles } = await withSelectedUetdsOptions({
    scope: "ops",
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    drivers: listedDrivers,
    vehicles: listedVehicles,
  });
  return (
    <UetdsNotificationForm
      locale={asPanelLocale(locale)}
      copy={uetdsFormCopyFor(locale)}
      actor="ops"
      ministryEnv={resolveUetdsMinistryRuntime()}
      initialDraft={draft}
      drivers={drivers}
      vehicles={vehicles}
      authorities={authorities}
      listHref={localizedPath(locale, "/ops/uetds/notifications")}
    />
  );
}
