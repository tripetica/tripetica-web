import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export function DriverUetdsTabs({
  locale,
  current,
  allowNew = true,
  allowList = true,
}: {
  locale: Locale;
  current: "new" | "list";
  allowNew?: boolean;
  allowList?: boolean;
}) {
  const copy = driverPortalCopyFor(locale);
  const items = [
    allowNew ? { key: "new" as const, href: "/driver/uetds/new", label: copy.newNotification } : null,
    allowList ? { key: "list" as const, href: "/driver/uetds", label: copy.myNotifications } : null,
  ].flatMap((item) => item ? [item] : []);
  if (items.length === 0) return null;
  return (
    <nav className="ops-partner-tabs" aria-label={copy.uetds}>
      {items.map((item) => {
        const selected = item.key === current;
        return (
          <a
            key={item.key}
            href={localizedPath(locale, item.href)}
            className={selected ? "is-current" : undefined}
            aria-current={selected ? "page" : undefined}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
