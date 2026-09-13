import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverTaskScreen } from "@/components/driver-task/driver-task-screen";
import { isLocale } from "@/lib/i18n/config";
import { loadDriverTaskByToken } from "@/lib/ops/driver-task";
import { noindexNofollowRobots } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şoför Görevi | Tripetica",
  robots: noindexNofollowRobots,
};

export default async function DriverTaskPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const decoded = decodeURIComponent(token);
  const result = await loadDriverTaskByToken(decoded);
  if (!result.valid) {
    return (
      <main className="driver-task-page">
        <header className="driver-task-brand">
          <p className="driver-task-logo">TRIPETICA</p>
          <h1>ŞOFÖR GÖREVİ</h1>
        </header>
        <p className="driver-task-invalid">Bu görev bağlantısı artık geçerli değil.</p>
      </main>
    );
  }
  return <DriverTaskScreen token={decoded} initial={result} />;
}
