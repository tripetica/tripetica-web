import { notFound } from "next/navigation";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { AccountShell } from "@/components/account/account-shell";
import { AccountCompanyForm } from "@/components/account/company-form";
import { requireAccountPage } from "@/lib/account/auth";
import { accountCopy } from "@/lib/account/copy";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function AccountCompanyNewPage({
  params,
}: PageProps<"/[locale]/account/companies/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireAccountPage(locale, { requireVerified: true });
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/companies/new"
      title={copy.addCompany}
    >
      <AccountShell locale={locale} active="companies">
        <AccountCompanyForm locale={locale} />
      </AccountShell>
    </AccountPageFrame>
  );
}
