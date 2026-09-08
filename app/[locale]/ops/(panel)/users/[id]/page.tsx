import { notFound } from "next/navigation";
import { OpsUserForm } from "@/components/ops/user-form";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { actorCan } from "@/lib/ops/session";
import { getOpsUser } from "@/lib/ops/users";
import { formatOpsDateTime } from "@/lib/ops/format";

export const dynamic = "force-dynamic";

export default async function OpsUserDetailPage({
  params,
}: PageProps<"/[locale]/ops/users/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale, "users.view");
  if (id === "new") {
    notFound();
  }
  const user = await getOpsUser(id);
  if (!user) {
    notFound();
  }
  const copy = opsCopy[locale];
  const canManage = actorCan(actor, "users.manage");

  return (
    <section className="ops-page">
      <p>
        <a href={localizedPath(locale, "/ops/users")}>{copy.back}</a>
      </p>
      <h1>
        {user.firstName} {user.lastName}
      </h1>
      <p>
        {copy.lastLogin}: {formatOpsDateTime(user.lastLoginAt, locale)}
      </p>
      {canManage ? (
        <OpsUserForm locale={locale} copy={copy} user={user} />
      ) : (
        <dl className="ops-dl">
          <div className="ops-kv">
            <dt>{copy.email}</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="ops-kv">
            <dt>{copy.role}</dt>
            <dd>{user.role === "owner" ? copy.owner : copy.employee}</dd>
          </div>
          <div className="ops-kv">
            <dt>{copy.status}</dt>
            <dd>{user.isActive ? copy.active : copy.inactive}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
