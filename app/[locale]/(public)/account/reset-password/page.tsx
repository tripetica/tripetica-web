import { notFound } from "next/navigation";
import { AccountResetPasswordForm } from "@/components/account/auth-forms";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { accountCopy } from "@/lib/account/copy";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function AccountResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/reset-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/reset-password"
      title={copy.resetTitle}
    >
      {token ? (
        <AccountResetPasswordForm locale={locale} token={token} />
      ) : (
        <p className="account-form-error">{copy.verifyInvalid}</p>
      )}
    </AccountPageFrame>
  );
}
