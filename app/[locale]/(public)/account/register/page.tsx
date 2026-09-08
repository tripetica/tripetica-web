import { notFound, redirect } from "next/navigation";
import { AccountRegisterForm } from "@/components/account/auth-forms";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { accountCopy } from "@/lib/account/copy";
import { getAccountActor } from "@/lib/account/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function AccountRegisterPage({
  params,
}: PageProps<"/[locale]/account/register">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getAccountActor();
  if (actor) {
    redirect(
      localizedPath(
        locale,
        actor.emailVerifiedAt ? "/account" : "/account/verify",
      ),
    );
  }
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/register"
      title={copy.registerTitle}
    >
      <AccountRegisterForm locale={locale} />
    </AccountPageFrame>
  );
}
