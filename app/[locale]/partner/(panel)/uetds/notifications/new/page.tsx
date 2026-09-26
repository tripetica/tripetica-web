import { notFound, redirect } from "next/navigation";
import { UetdsNotificationForm } from "@/components/uetds/uetds-notification-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
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

export default async function PartnerUetdsNewNotificationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/uetds/notifications/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const query = await searchParams;
  const reservationId = reservationParam(query.reservation);
  const context = reservationId ? await loadUetdsReservationContext(reservationId) : null;
  if (reservationId && (!context || context.partnerId !== actor.partnerId)) {
    notFound();
  }
  if (reservationId) {
    const existing = await findActiveUetdsNotificationForReservation({
      reservationId,
      partnerId: actor.partnerId,
    });
    if (existing) {
      redirect(localizedPath(locale, `/partner/uetds/notifications/${existing.id}?editMethod=1`));
    }
  }
  const saved = await loadUetdsFormDraft({
    actor: { type: "partner", userId: actor.userId, partnerId: actor.partnerId },
    reservationId: context?.draft.reservationId ?? null,
  });
  const fresh = context ? fillEmptyEnd(context.draft) : null;
  const draft = fresh
    ? saved && saved.reservationId === fresh.reservationId
      ? mergeSavedReservationDraft(saved, fresh)
      : fresh
    : (saved ?? createEmptyDraft("manual"));
  const [listedDrivers, listedVehicles] = await Promise.all([
    listUetdsDriverOptions({ scope: "partner", partnerId: actor.partnerId }),
    listUetdsVehicleOptions({ scope: "partner", partnerId: actor.partnerId }),
  ]);
  const { drivers, vehicles } = await withSelectedUetdsOptions({
    scope: "partner",
    partnerId: actor.partnerId,
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    drivers: listedDrivers,
    vehicles: listedVehicles,
  });
  return (
    <UetdsNotificationForm
      locale={asPanelLocale(locale)}
      copy={uetdsFormCopyFor(locale)}
      actor="partner"
      ministryEnv={resolveUetdsMinistryRuntime()}
      initialDraft={draft}
      drivers={drivers}
      vehicles={vehicles}
      listHref={localizedPath(locale, "/partner/uetds/notifications")}
    />
  );
}
