import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverPortalJobList } from "@/components/driver-portal/driver-portal-job-list";
import { DriverPortalLoginForm } from "@/components/driver-portal/driver-portal-login-form";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { driverPortalCopy } from "@/lib/driver-portal/copy";
import { listDriverPortalJobs } from "@/lib/driver-portal/jobs";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şoför Portalı | Tripetica",
  robots: noindexNofollowRobots,
};

export default async function DriverPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getDriverPortalActor();
  if (!actor) {
    return (
      <main className="driver-task-page">
        <header className="driver-task-brand">
          <p className="driver-task-logo">{driverPortalCopy.brand}</p>
          <h1>{driverPortalCopy.loginTitle}</h1>
        </header>
        <DriverPortalLoginForm locale={locale} />
      </main>
    );
  }
  const jobs = await listDriverPortalJobs(actor.driverId);
  return (
    <main className="driver-task-page">
      <DriverPortalHeader locale={locale} title={driverPortalCopy.jobsTitle} />
      <DriverPortalJobList locale={locale} jobs={jobs} />
    </main>
  );
}
