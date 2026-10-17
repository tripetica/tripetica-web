import { notFound } from "next/navigation";
import { PartnerUserAdmin } from "@/components/partner/user-admin";
import { isLocale } from "@/lib/i18n/config";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopyFor } from "@/lib/partner/copy";
import { listPartnerExtraUsers } from "@/lib/partner/user-store";

export const dynamic = "force-dynamic";

export default async function PartnerUsersPage({
  params,
}: PageProps<"/[locale]/partner/users">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requirePartnerPage(locale);
  const users = await listPartnerExtraUsers(actor.partnerId);
  return (
    <PartnerUserAdmin
      locale={locale}
      copy={partnerCopyFor(locale)}
      users={users}
    />
  );
}
