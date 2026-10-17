import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverPortalJobList } from "@/components/driver-portal/driver-portal-job-list";
import { MobileGpsShare } from "@/components/gps/mobile-share";
import { PanelLanguageSwitcher } from "@/components/language-switcher";
import { DriverPortalLoginForm } from "@/components/driver-portal/driver-portal-login-form";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { listDriverPortalJobs } from "@/lib/driver-portal/jobs";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { loadMobileShare } from "@/lib/gps/mobile-store";
import { isLocale } from "@/lib/i18n/config";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = driverPortalCopyFor(isLocale(locale) ? locale : "tr");
  return {
    title: copy.panelName,
    robots: noindexNofollowRobots,
  };
}

export default async function DriverPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const copy = driverPortalCopyFor(locale);
  const actor = await getDriverPortalActor();
  if (!actor) {
    return (
      <main className="driver-task-page">
        <header className="driver-task-brand">
          <p className="driver-task-logo">{copy.brand}</p>
          <h1>{copy.loginTitle}</h1>
        </header>
        <DriverPortalLoginForm locale={locale} />
        <div className="driver-portal-login-lang">
          <PanelLanguageSwitcher locale={locale} label={copy.language} fallbackPath="/driver" />
        </div>
      </main>
    );
  }
  const jobs = await listDriverPortalJobs(actor.driverId);
  const share = await loadMobileShare({ surface: "driver", partnerId: actor.partnerId, driverId: actor.driverId });
  return (
    <main className="driver-task-page">
      <DriverPortalHeader locale={locale} />
      {share ? <MobileGpsShare locale={locale} title={copy.shareHeading} initial={{
        driverName: share.driverName,
        plate: share.plate,
        sessionId: share.sessionId,
        sharing: share.sharing,
        tokenMatches: share.tokenMatches,
        lastFixAt: share.lastFixAt,
        lastStreamAt: share.lastStreamAt,
        accuracyM: share.accuracyM,
        fresh: share.fresh,
      }} /> : null}
      <DriverPortalJobList locale={locale} jobs={jobs} />
    </main>
  );
}
