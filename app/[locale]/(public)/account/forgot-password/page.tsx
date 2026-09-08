import { notFound } from "next/navigation";
import { AccountForgotPasswordForm } from "@/components/account/auth-forms";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { accountCopy } from "@/lib/account/copy";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function AccountForgotPasswordPage({
  params,
}: PageProps<"/[locale]/account/forgot-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/forgot-password"
      title={copy.forgotTitle}
    >
      <AccountForgotPasswordForm locale={locale} />
    </AccountPageFrame>
  );
}
