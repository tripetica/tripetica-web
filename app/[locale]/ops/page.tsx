import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { firstOpsHome } from "@/lib/ops/auth";
import { getOpsActor } from "@/lib/ops/session";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function OpsIndexPage({
  params,
}: PageProps<"/[locale]/ops">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getOpsActor();
  if (!actor) {
    redirect(localizedPath(locale, "/ops/login"));
  }
  redirect(firstOpsHome(locale, actor));
}
