import { notFound } from "next/navigation";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { AccountShell } from "@/components/account/account-shell";
import { AccountProfileForm } from "@/components/account/profile-form";
import { requireAccountPage } from "@/lib/account/auth";
import { accountCopy } from "@/lib/account/copy";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage({
  params,
}: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireAccountPage(locale, { requireVerified: true });
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/profile"
      title={copy.accountTitle}
    >
      <AccountShell locale={locale} active="profile">
        <AccountProfileForm
          locale={locale}
          firstName={actor.firstName}
          lastName={actor.lastName}
          email={actor.email}
          pendingEmail={actor.pendingEmail}
          phone={actor.phone}
          phoneCountryCode={actor.phoneCountryCode}
          nationalityCode={actor.nationalityCode}
        />
      </AccountShell>
    </AccountPageFrame>
  );
}
