import { notFound, redirect } from "next/navigation";
import { getAccountActor } from "@/lib/account/session";
import { accountLoginPath } from "@/lib/account/return-url";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function AccountIndexPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getAccountActor();
  if (!actor) {
    redirect(accountLoginPath(locale, "/account"));
  }
  if (!actor.emailVerifiedAt) {
    redirect(localizedPath(locale, "/account/verify"));
  }
  redirect(localizedPath(locale, "/account/reservations"));
}
