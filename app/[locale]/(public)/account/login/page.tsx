import { notFound, redirect } from "next/navigation";
import { AccountLoginForm } from "@/components/account/auth-forms";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { accountCopy } from "@/lib/account/copy";
import { getAccountActor } from "@/lib/account/session";
import { sanitizeReturnPath } from "@/lib/account/return-url";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function AccountLoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getAccountActor();
  if (actor?.emailVerifiedAt) {
    redirect(localizedPath(locale, "/account"));
  }
  if (actor && !actor.emailVerifiedAt) {
    redirect(localizedPath(locale, "/account/verify"));
  }
  const query = await searchParams;
  const nextPath = sanitizeReturnPath(
    typeof query.next === "string" ? query.next : null,
  );
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame locale={locale} pathWithoutLocale="/account/login" title={copy.loginTitle}>
      <AccountLoginForm locale={locale} nextPath={nextPath} />
    </AccountPageFrame>
  );
}
