import { notFound, redirect } from "next/navigation";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import {
  accountResendVerificationFormAction,
  accountVerifyTokenFormAction,
} from "@/lib/account/actions";
import { accountCopy, accountErrorMessage } from "@/lib/account/copy";
import { getAccountActor } from "@/lib/account/session";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function AccountVerifyPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/verify">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const purpose = typeof query.purpose === "string" ? query.purpose : "";
  const result = typeof query.result === "string" ? query.result : "";
  const registered = query.registered === "1";
  const resent = query.resent === "1";
  const mailErrorCode =
    typeof query.mail_error === "string" ? query.mail_error : "";
  const copy = accountCopy[locale];
  const mailError = accountErrorMessage(copy, mailErrorCode || null);

  if (token) {
    return (
      <AccountPageFrame
        locale={locale}
        pathWithoutLocale="/account/verify"
        title={copy.verifyTitle}
      >
        <p className="account-lead">{copy.verifyPending}</p>
        <form action={accountVerifyTokenFormAction} className="account-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="purpose" value={purpose} />
          <button type="submit" className="account-btn-primary">
            {copy.submitVerify}
          </button>
        </form>
      </AccountPageFrame>
    );
  }

  const actor = await getAccountActor();
  if (actor?.emailVerifiedAt) {
    redirect(localizedPath(locale, "/account"));
  }

  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/verify"
      title={copy.verifyTitle}
    >
      <p className="account-lead">
        {registered ? copy.verifyRegistered : copy.verifyPending}
      </p>
      {result ? (
        <p className="account-form-error">
          {result === "expired" ? copy.verifyExpired : copy.verifyInvalid}
        </p>
      ) : null}
      {resent ? <p className="account-form-info">{copy.resent}</p> : null}
      {mailError ? <p className="account-form-error">{mailError}</p> : null}
      {actor ? (
        <form action={accountResendVerificationFormAction} className="account-form">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="account-btn-primary">
            {copy.submitResend}
          </button>
        </form>
      ) : (
        <p className="account-form-links">
          <a href={localizedPath(locale, "/account/login")}>{copy.backToLogin}</a>
        </p>
      )}
    </AccountPageFrame>
  );
}
