import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { AccountShell } from "@/components/account/account-shell";
import { AccountCompanyDeleteButton } from "@/components/account/company-form";
import { requireAccountPage } from "@/lib/account/auth";
import { listCompaniesForUser } from "@/lib/account/companies";
import { accountCopy } from "@/lib/account/copy";
import { countryName } from "@/lib/geo/countries";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function AccountCompaniesPage({
  params,
}: PageProps<"/[locale]/account/companies">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireAccountPage(locale, { requireVerified: true });
  const companies = await listCompaniesForUser(actor.id);
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/companies"
      title={copy.accountTitle}
    >
      <AccountShell locale={locale} active="companies">
        <div className="account-section-actions">
          <Link
            href={localizedPath(locale, "/account/companies/new")}
            className="account-btn-primary"
          >
            {copy.addCompany}
          </Link>
        </div>
        {companies.length === 0 ? (
          <p className="account-empty">{copy.emptyCompanies}</p>
        ) : (
          <ul className="account-company-list">
            {companies.map((company) => (
              <li key={company.id} className="account-company-card">
                <div className="account-company-card-top">
                  <strong>{company.companyName}</strong>
                  {company.isDefault ? <span className="account-pill">{copy.isDefault}</span> : null}
                </div>
                <p>{countryName(company.countryCode, locale)}</p>
                <p>
                  {company.city} · {company.invoiceEmail}
                </p>
                <div className="account-company-card-actions">
                  <Link href={localizedPath(locale, `/account/companies/${company.id}`)}>
                    {copy.editCompany}
                  </Link>
                  <AccountCompanyDeleteButton locale={locale} companyId={company.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AccountShell>
    </AccountPageFrame>
  );
}
