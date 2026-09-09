import { notFound } from "next/navigation";
import { OpsAccountForm } from "@/components/ops/account-form";
import { isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";

export const dynamic = "force-dynamic";

export default async function OpsAccountPage({
  params,
}: PageProps<"/[locale]/ops/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale);
  const copy = opsCopy[locale];

  return (
    <section className="ops-page">
      <div className="ops-page-head">
        <h1 id="ops-account-title">{copy.myAccount}</h1>
      </div>
      <OpsAccountForm
        locale={locale}
        copy={copy}
        firstName={actor.firstName}
        lastName={actor.lastName}
        email={actor.email}
      />
    </section>
  );
}
