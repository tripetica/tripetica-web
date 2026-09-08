import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { getOpsCustomer } from "@/lib/ops/customers";
import {
  formatOpsDateTime,
  formatOpsMoney,
} from "@/lib/ops/format";
import { reservationStatusLabel } from "@/lib/ops/record-detail";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function OpsCustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requireOpsPage(locale, "customers.view");
  const customer = await getOpsCustomer(id);
  if (!customer) {
    notFound();
  }
  const copy = opsCopy[locale];

  return (
    <section className="ops-page">
      <p>
        <a href={localizedPath(locale, "/ops/customers")}>{copy.back}</a>
      </p>
      <h1>
        {customer.firstName} {customer.lastName}
      </h1>

      <h2>{copy.contactInfo}</h2>
      <dl className="ops-dl">
        <div className="ops-kv">
          <dt>{copy.email}</dt>
          <dd>{customer.email}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.phone}</dt>
          <dd>{customer.phone ?? "—"}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.nationality}</dt>
          <dd>{customer.nationalityCode ?? "—"}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.status}</dt>
          <dd>{customer.isActive ? copy.active : copy.inactive}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.verification}</dt>
          <dd>{customer.isVerified ? copy.verified : copy.unverified}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.createdAt}</dt>
          <dd>{formatOpsDateTime(customer.createdAt, locale)}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.updatedAt}</dt>
          <dd>{formatOpsDateTime(customer.updatedAt, locale)}</dd>
        </div>
        <div className="ops-kv">
          <dt>{copy.lastLogin}</dt>
          <dd>{formatOpsDateTime(customer.lastLoginAt, locale)}</dd>
        </div>
      </dl>

      <h2>{copy.reservationHistory}</h2>
      {customer.reservations.length === 0 ? (
        <p className="ops-empty">{copy.emptyCustomerReservations}</p>
      ) : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.reservationCode}</th>
                <th>{copy.transferAt}</th>
                <th>{copy.serviceType}</th>
                <th>{copy.status}</th>
                <th>{copy.total}</th>
                <th>{copy.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {customer.reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <a href={localizedPath(locale, `/ops/reservations/${reservation.id}`)}>
                      {reservation.reservationCode}
                    </a>
                  </td>
                  <td>{formatOpsDateTime(reservation.pickupAt, locale)}</td>
                  <td>{reservation.serviceType ?? "—"}</td>
                  <td>{reservationStatusLabel(reservation.status, copy)}</td>
                  <td>{formatOpsMoney(reservation.totalPrice, reservation.currency)}</td>
                  <td>{formatOpsDateTime(reservation.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
