import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import { formatFaultClock } from "@/lib/gps/ats-fault";
import { listFaults, listPanelAlerts, listRecentAttempts } from "@/lib/gps/ats-fault-store";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export async function AtsFaultLists({ locale, mode }: { locale: Locale; mode: "faults" | "history" }) {
  const copy = atsFaultCopy(locale);
  if (mode === "faults") {
    const [faults, alerts] = await Promise.all([
      listFaults({ limit: 50 }),
      listPanelAlerts(30),
    ]);
    const open = faults.filter((fault) => !fault.resolvedAt);
    return (
      <section className="gps-section">
        <h2>{copy.panelTitle}</h2>
        {alerts.length === 0 ? <p>{copy.empty}</p> : (
          <ul className="gps-drive-events">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <a href={alert.href ?? localizedPath(locale, "/ops/gps?tab=devices&devices=faults")}>{alert.title}</a>
                <div>{alert.plate} · {formatFaultClock(alert.created_at.getTime())}</div>
              </li>
            ))}
          </ul>
        )}
        <h2>{copy.faults}</h2>
        {open.length === 0 ? <p>{copy.empty}</p> : (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>{copy.plate}</th><th>{copy.kind}</th><th>{copy.startDate}</th><th>Bakanlık</th></tr></thead>
              <tbody>
                {open.map((fault) => (
                  <tr key={fault.id}>
                    <td>{fault.deviceId ? <a href={localizedPath(locale, `/ops/gps/${fault.deviceId}`)}>{fault.plate}</a> : fault.plate}</td>
                    <td>{copy.kinds[fault.kind]}</td>
                    <td>{formatFaultClock(Date.parse(fault.startedAt))}</td>
                    <td>{fault.ministryStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }
  const attempts = await listRecentAttempts(80);
  return (
    <section className="gps-section">
      <h2>{copy.history}</h2>
      {attempts.length === 0 ? <p>{copy.empty}</p> : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>{copy.plate}</th><th>{copy.startDate}</th><th>Sonuç</th><th>Bakanlık</th></tr></thead>
            <tbody>
              {attempts.map((row) => (
                <tr key={row.id}>
                  <td>{row.plate}</td>
                  <td>{formatFaultClock(row.attempted_at.getTime())}</td>
                  <td>{row.outcome}</td>
                  <td>{row.sonuc_kodu == null ? "—" : row.sonuc_kodu} {row.sonuc_mesaji ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
