import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DriverTaskScreen } from "@/components/driver-task/driver-task-screen";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { DRIVER_PORTAL_PATH } from "@/lib/driver-portal/constants";
import { loadAuthorizedDriverPortalTask } from "@/lib/driver-portal/jobs";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şoför Görevi | Tripetica",
  robots: noindexNofollowRobots,
};

export default async function DriverPortalTaskPage({
  params,
}: {
  params: Promise<{ locale: string; reservationId: string }>;
}) {
  const { locale, reservationId } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getDriverPortalActor();
  if (!actor) {
    redirect(localizedPath(locale, DRIVER_PORTAL_PATH));
  }
  const result = await loadAuthorizedDriverPortalTask(actor.driverId, reservationId);
  if (!result.valid) {
    notFound();
  }
  return (
    <main className="driver-task-page">
      <DriverPortalHeader locale={locale} title="ŞOFÖR GÖREVİ" action="back" />
      <DriverTaskScreen token={result.token} initial={result} embedded />
    </main>
  );
}
