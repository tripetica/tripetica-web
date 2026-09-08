import { notFound } from "next/navigation";
import { AccountPageFrame } from "@/components/account/account-page-frame";
import { AccountShell } from "@/components/account/account-shell";
import { AccountReservationList } from "@/components/account/reservation-list";
import { requireAccountPage } from "@/lib/account/auth";
import { accountCopy } from "@/lib/account/copy";
import { listAccountReservations } from "@/lib/account/reservations";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function AccountReservationsPage({
  params,
}: PageProps<"/[locale]/account/reservations">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireAccountPage(locale, { requireVerified: true });
  const items = await listAccountReservations({
    userId: actor.id,
    locale,
  });
  const copy = accountCopy[locale];
  return (
    <AccountPageFrame
      locale={locale}
      pathWithoutLocale="/account/reservations"
      title={copy.accountTitle}
    >
      <AccountShell locale={locale} active="reservations">
        <AccountReservationList locale={locale} items={items} />
      </AccountShell>
    </AccountPageFrame>
  );
}
