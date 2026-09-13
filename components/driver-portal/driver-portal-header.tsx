import { DriverPortalNav } from "@/components/driver-portal/driver-portal-nav";
import { driverPortalCopy } from "@/lib/driver-portal/copy";
import { type Locale } from "@/lib/i18n/config";

export function DriverPortalHeader({
  locale,
  title,
  action = "logout",
}: {
  locale: Locale;
  title: string;
  action?: "logout" | "back";
}) {
  return (
    <div className="driver-portal-header">
      <DriverPortalNav locale={locale} action={action} />
      <header className="driver-task-brand">
        <p className="driver-task-logo">{driverPortalCopy.brand}</p>
        <h1>{title}</h1>
      </header>
    </div>
  );
}
