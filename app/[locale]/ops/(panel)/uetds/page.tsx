import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";

export const dynamic = "force-dynamic";

export default async function OpsUetdsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "uetds.view");
  redirect(localizedPath(locale, "/ops/uetds/companies"));
}
