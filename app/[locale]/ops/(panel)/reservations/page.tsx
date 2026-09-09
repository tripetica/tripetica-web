import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { parsePage } from "@/lib/ops/format";
import {
  parseReservationListFilters,
  reservationQueryRecord,
} from "@/lib/ops/reservation-filters";
import { listReservations, OPS_PAGE_SIZE } from "@/lib/ops/reservations";
import {
  listActiveOpsAssignmentPartners,
  loadOpsAssignmentFleets,
} from "@/lib/ops/reservation-assignment";
import { actorCan } from "@/lib/ops/session";
import { OpsPagination } from "@/components/ops/pagination";
import { ReservationFilters } from "@/components/ops/reservation-filters";
import { ReservationTable } from "@/components/ops/reservation-table";

export const dynamic = "force-dynamic";

export default async function OpsReservationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/reservations">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "reservations.view");
  const query = await searchParams;
  const filters = parseReservationListFilters(query);
  const page = parsePage(query.page);
  const copy = opsCopy[locale];
  const canAssign = actorCan(actor, "reservations.manage");
  const partners = await listActiveOpsAssignmentPartners();
  const fleets = await loadOpsAssignmentFleets(partners.map((partner) => partner.id));
  const { items, total, pageSize } = await listReservations({
    filters,
    page,
    pageSize: OPS_PAGE_SIZE,
  });

  return (
    <section className="ops-page">
      <h1>{copy.reservations}</h1>
      <ReservationFilters locale={locale} copy={copy} filters={filters} />
      {items.length === 0 ? (
        <p className="ops-empty">{copy.emptyReservations}</p>
      ) : (
        <ReservationTable
          locale={locale}
          copy={copy}
          items={items}
          filters={filters}
          partners={partners}
          fleets={fleets}
          canAssign={canAssign}
        />
      )}
      <OpsPagination
        locale={locale}
        copy={copy}
        pathWithoutLocale="/ops/reservations"
        page={page}
        total={total}
        pageSize={pageSize}
        query={reservationQueryRecord(filters)}
      />
    </section>
  );
}
