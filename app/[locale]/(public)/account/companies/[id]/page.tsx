import { notFound } from "next/navigation";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { AccountShell } from "@/components/account/account-shell";
import { AccountCompanyForm } from "@/components/account/company-form";
import { requireAccountPage } from "@/lib/account/auth";
import { getCompanyForUser } from "@/lib/account/companies";
import { accountCopy } from "@/lib/account/copy";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function AccountCompanyEditPage({
  params,
}: PageProps<"/[locale]/account/companies/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireAccountPage(locale, { requireVerified: true });
  const company = await getCompanyForUser(actor.id, id);
  if (!company) {
    notFound();
  }
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale={`/account/companies/${id}`}
      title={copy.editCompany}
    >
      <AccountShell locale={locale} active="companies">
        <AccountCompanyForm locale={locale} company={company} />
      </AccountShell>
    </AccountPageFrame>
  );
}
