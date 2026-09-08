import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getProcess } from "@/lib/ops/processes";
import { toProcessRecordDetail } from "@/lib/ops/record-detail";
import { RecordDetail } from "@/components/ops/record-detail";

export const dynamic = "force-dynamic";

export default async function OpsProcessDetailPage({
  params,
}: PageProps<"/[locale]/ops/processes/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "processes.view");
  const item = await getProcess(id);
  if (!item) {
    notFound();
  }
  const copy = opsCopy[locale];
  return (
    <section className="ops-page">
      <p>
        <a href={localizedPath(locale, "/ops/processes")}>{copy.back}</a>
      </p>
      <RecordDetail locale={locale} copy={copy} detail={toProcessRecordDetail(item, locale, copy)} />
    </section>
  );
}
