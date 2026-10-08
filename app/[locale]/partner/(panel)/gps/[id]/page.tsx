import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";

export const dynamic = "force-dynamic";

export default async function PartnerGpsDevicePage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/gps/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requirePartnerPage(locale);
  const query = await searchParams;
  const extra = new URLSearchParams();
  extra.set("vehicle", id);
  const from = one(query.from);
  const to = one(query.to);
  if (from) extra.set("from", from);
  if (to) extra.set("to", to);
  redirect(`${localizedPath(locale, "/partner/gps")}?${extra.toString()}`);
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
