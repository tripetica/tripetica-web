import { notFound } from "next/navigation";
import { GpsDeviceWorkspace } from "@/components/gps/device-workspace";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import { asPanelLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { actorCan } from "@/lib/ops/session";
import { gpsCopy } from "@/lib/gps/copy";
import { canDeleteGpsDevice } from "@/lib/gps/delete-access";
import { getGpsDevice, listGpsAssignments, listGpsCommands, listGpsPartners, listGpsRoute, listGpsVehicles } from "@/lib/gps/queries";
import { readGpsRange } from "@/lib/gps/range";

export const dynamic = "force-dynamic";

export default async function OpsGpsDevicePage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/gps/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "gps.view");
  const device = await getGpsDevice(id, null);
  if (!device) {
    notFound();
  }
  const query = await searchParams;
  const range = readGpsRange(one(query.from), one(query.to));
  const copy = gpsCopy[asPanelLocale(locale)];
  const error = range && "error" in range ? range.error : one(query.error);
  const route = "error" in range
    ? { total: 0, step: 1, points: [] }
    : await listGpsRoute({
        deviceId: device.id,
        partnerId: device.partnerId,
        vehicleId: device.vehicleId,
        from: range.from,
        to: range.to,
      });
  const [commands, vehicles, partners, assignments] = await Promise.all([
    device.partnerId ? listGpsCommands(device.id, device.partnerId) : Promise.resolve([]),
    listGpsVehicles(),
    listGpsPartners(),
    listGpsAssignments(device.id),
  ]);

  return (
    <GpsDeviceWorkspace
      locale={locale}
      copy={copy}
      surface="ops"
      device={device}
      vehicles={vehicles}
      partners={partners}
      assignments={assignments}
      route={route}
      commands={commands}
      fromLocal={"error" in range ? "" : range.fromLocal}
      toLocal={"error" in range ? "" : range.toLocal}
      fromIso={"error" in range ? "" : range.from.toISOString()}
      toIso={"error" in range ? "" : range.to.toISOString()}
      error={error}
      canManage={actorCan(actor, "gps.manage")}
      canDelete={canDeleteGpsDevice(actor.id)}
      faultNotice={faultNotice(locale, one(query.fault), one(query.need), one(query.rank))}
      showDeviceList
      viewerId={actor.id}
    />
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function faultNotice(locale: Locale, fault?: string, need?: string, rank?: string) {
  const copy = atsFaultCopy(locale === "en" || locale === "ru" ? locale : "tr");
  if (need === "second") return copy.secondBody;
  if (need === "unknown") return copy.unknownRetry;
  if (fault === "limited") return copy.blockedBody;
  if (fault === "resolved") return copy.resolve;
  if (rank === "second") return copy.secondBody;
  if (fault === "saved" || fault === "sent") return null;
  return null;
}
