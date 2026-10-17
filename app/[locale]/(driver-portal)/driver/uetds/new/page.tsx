import { notFound, redirect } from "next/navigation";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { DriverUetdsTabs } from "@/components/driver-portal/driver-uetds-tabs";
import { UetdsNotificationForm } from "@/components/uetds/uetds-notification-form";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { createEmptyDraft } from "@/lib/uetds/draft";
import { loadDriverUetdsFleet } from "@/lib/uetds/driver-access";
import { loadUetdsFormDraft } from "@/lib/uetds/form-drafts";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

export const dynamic = "force-dynamic";

export default async function DriverUetdsNewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await getDriverPortalActor();
  if (!actor?.permissions.uetdsNew) redirect(localizedPath(locale, "/driver"));
  const fleet = await loadDriverUetdsFleet(actor.partnerId, actor.driverId);
  const saved = await loadUetdsFormDraft({
    actor: { type: "partner", userId: actor.driverId, partnerId: actor.partnerId },
    reservationId: null,
  });
  const base = saved ?? createEmptyDraft("manual");
  const vehicleId = fleet.vehicles.some((vehicle) => vehicle.id === base.vehicleId)
    ? base.vehicleId
    : fleet.vehicles.length === 1
      ? fleet.vehicles[0].id
      : "";
  const copy = driverPortalCopyFor(locale);
  return (
    <section className="driver-portal ops-app">
      <DriverPortalHeader locale={locale} title={copy.newNotification} />
      <DriverUetdsTabs locale={locale} current="new" allowNew allowList={actor.permissions.uetdsList} />
      <UetdsNotificationForm
        locale={locale}
        copy={uetdsFormCopyFor(locale)}
        actor="driver"
        lockDriver
        ministryEnv={resolveUetdsMinistryRuntime()}
        initialDraft={{ ...base, driverId: actor.driverId, vehicleId, reservationId: null }}
        drivers={fleet.drivers}
        vehicles={fleet.vehicles}
        authorities={fleet.authorities}
        listHref={localizedPath(locale, "/driver/uetds")}
      />
    </section>
  );
}
