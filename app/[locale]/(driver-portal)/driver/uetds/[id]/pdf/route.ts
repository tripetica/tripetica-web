import { redirect } from "next/navigation";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { driverUetdsScope } from "@/lib/uetds/driver-access";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { loadAuthorizedUetdsMinistryPdf } from "@/lib/uetds/ministry-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale, id } = await context.params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const actor = await getDriverPortalActor();
  if (!actor?.permissions.uetdsList) redirect(localizedPath(locale, "/driver"));
  const owned = await getUetdsNotification({ id, ...await driverUetdsScope(actor.partnerId, actor.driverId) });
  if (!owned) return new Response(null, { status: 404 });
  const result = await loadAuthorizedUetdsMinistryPdf({
    notificationId: id,
    actor: { type: "partner", partnerId: actor.partnerId },
  });
  if (!result.ok) return new Response(null, { status: result.error === "forbidden" ? 403 : 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
