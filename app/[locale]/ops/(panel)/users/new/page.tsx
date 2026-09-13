import { notFound } from "next/navigation";
import { OpsUserForm } from "@/components/ops/user-form";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";

export const dynamic = "force-dynamic";

export default async function OpsNewUserPage({
  params,
}: PageProps<"/[locale]/ops/users/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "users.manage");
  const copy = opsCopy[asPanelLocale(locale)];

  return (
    <section className="ops-page">
      <p>
        <a href={localizedPath(locale, "/ops/users")}>{copy.back}</a>
      </p>
      <h1>{copy.newUser}</h1>
      <OpsUserForm locale={locale} copy={copy} />
    </section>
  );
}
