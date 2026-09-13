export const DRIVER_PORTAL_PATH = "/driver";
export const DRIVER_PORTAL_LEGACY_PATH = "/sofor";
export const DRIVER_TASK_PATH = "/driver-task";
export const DRIVER_TASK_LEGACY_PATH = "/sofor-gorevi";

export function driverPortalPath(reservationId?: string) {
  if (!reservationId) {
    return DRIVER_PORTAL_PATH;
  }
  return `${DRIVER_PORTAL_PATH}/${encodeURIComponent(reservationId)}`;
}

export function driverTaskPath(token: string) {
  return `${DRIVER_TASK_PATH}/${encodeURIComponent(token)}`;
}

export function resolveLegacyDriverRedirect(pathname: string): string | null {
  const publicTask = pathname.match(/^\/(tr|en|ru)\/sofor-gorevi\/([^/]+)\/?$/);
  if (publicTask) {
    return `/${publicTask[1]}${driverTaskPath(decodeURIComponent(publicTask[2]))}`;
  }

  const portal = pathname.match(/^\/(tr|en|ru)\/sofor(?:\/(.*))?$/);
  if (!portal) {
    return null;
  }
  const locale = portal[1];
  const rest = (portal[2] ?? "").replace(/\/+$/, "");
  if (!rest || rest === "isler") {
    return `/${locale}${DRIVER_PORTAL_PATH}`;
  }
  const gorev = rest.match(/^gorev\/([^/]+)$/);
  if (gorev) {
    return `/${locale}${driverPortalPath(decodeURIComponent(gorev[1]))}`;
  }
  return `/${locale}${DRIVER_PORTAL_PATH}`;
}
