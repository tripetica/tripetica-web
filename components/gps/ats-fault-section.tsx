import { AtsFaultForm } from "@/components/gps/ats-fault-form";
import { resolveGpsAtsFaultAction, sendGpsAtsFaultAction } from "@/lib/gps/ats-fault-actions";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import {
  elapsedMs,
  faultDeadlines,
  faultReportingWindow,
  formatElapsedTr,
  formatFaultClock,
  formatRemainingTr,
  nextFaultReport,
} from "@/lib/gps/ats-fault";
import {
  lastSuccessfulAtsAt,
  listAcceptedStamps,
  listAttempts,
  listFaults,
  loadFaultContext,
} from "@/lib/gps/ats-fault-store";
import { type Locale } from "@/lib/i18n/config";

export async function AtsFaultSection({
  locale,
  deviceId,
  canManage,
  notice,
}: {
  locale: Locale;
  deviceId: string;
  canManage: boolean;
  notice?: string | null;
}) {
  const copy = atsFaultCopy(locale);
  const context = await loadFaultContext(deviceId);
  if (!context?.vehicleId || !context.plate) return null;
  const now = Date.now();
  const plateKey = context.plate.replace(/\s+/g, "").toUpperCase();
  const window = faultReportingWindow(await listAcceptedStamps(context.vehicleId, plateKey), now);
  const next = nextFaultReport(window);
  const faults = await listFaults({ vehicleId: context.vehicleId, limit: 20 });
  const attemptsByFault = new Map(await Promise.all(faults.map(async (fault) => [fault.id, await listAttempts(fault.id)] as const)));
  const lastAts = await lastSuccessfulAtsAt(context.vehicleId);
  return (
    <section className="gps-section" id="ats-fault">
      <h2>{copy.faults}</h2>
      {notice ? <p className="gps-inline-note">{notice}</p> : null}
      {window.open && window.count >= 2 && window.firstAcceptedAtMs && window.periodEndMs ? (
        <div className="gps-fault-warn">
          <strong>{copy.secondTitle}</strong>
          <p>{copy.count}: {window.count}/2</p>
          <p>{copy.firstAt}: {formatFaultClock(window.firstAcceptedAtMs)}</p>
          <p>{copy.periodEnd}: {formatFaultClock(window.periodEndMs)}</p>
          <p>{copy.remaining}: {formatRemainingTr(now, window.periodEndMs)}</p>
        </div>
      ) : null}
      {canManage ? (
        <AtsFaultForm
          locale={locale}
          deviceId={deviceId}
          plate={context.plate}
          deviceCode={context.deviceCode}
          imei={context.imei}
          company={context.companyName}
          driver={context.driverName}
          phone={context.driverPhone}
          next={next}
          windowEndMs={window.periodEndMs}
          firstAcceptedAtMs={window.firstAcceptedAtMs}
          count={window.count}
        />
      ) : null}
      {faults.length === 0 ? <p>{copy.empty}</p> : faults.map((fault) => {
        const attempts = attemptsByFault.get(fault.id) ?? [];
        const started = Date.parse(fault.startedAt);
        const deadlines = faultDeadlines(started);
        const overdue = !fault.resolvedAt && now >= deadlines.repairDeadlineMs;
        return (
          <article key={fault.id} className="gps-stack">
            <h3>{fault.plate} · {copy.kinds[fault.kind]}</h3>
            <dl className="gps-facts">
              <div><dt>{copy.startDate}</dt><dd>{formatFaultClock(started)}</dd></div>
              <div><dt>{copy.description}</dt><dd>{fault.description}</dd></div>
              <div><dt>{copy.imei}</dt><dd>{fault.imei ?? copy.missing}</dd></div>
              <div><dt>{copy.driver}</dt><dd>{fault.driverName ?? copy.missing}</dd></div>
              <div><dt>{copy.driverPhone}</dt><dd>{fault.driverPhone ?? copy.missing}</dd></div>
              <div><dt>{copy.notifyDeadline}</dt><dd>{formatFaultClock(deadlines.notifyDeadlineMs)}</dd></div>
              <div><dt>{copy.repairDeadline}</dt><dd>{formatFaultClock(deadlines.repairDeadlineMs)}</dd></div>
              <div><dt>Bakanlık</dt><dd>{fault.ministryStatus}{fault.ministryAcceptedAt ? ` · ${formatFaultClock(Date.parse(fault.ministryAcceptedAt))}` : ""}{fault.ministryReference ? ` · ${fault.ministryReference}` : ""}</dd></div>
              <div><dt>{copy.lastLink}</dt><dd>{context.lastSeenAt ? formatFaultClock(Date.parse(context.lastSeenAt)) : copy.missing}</dd></div>
              <div><dt>{copy.lastGnss}</dt><dd>{context.lastGnssAt ? formatFaultClock(Date.parse(context.lastGnssAt)) : copy.missing}</dd></div>
              <div><dt>{copy.lastAts}</dt><dd>{lastAts ? formatFaultClock(Date.parse(lastAts)) : copy.missing}</dd></div>
              <div><dt>{copy.elapsed}</dt><dd>{formatElapsedTr(elapsedMs(started, fault.resolvedAt ? Date.parse(fault.resolvedAt) : now))}</dd></div>
              <div><dt>{copy.repairState}</dt><dd>{overdue ? copy.repairOver : fault.resolvedAt ? formatFaultClock(Date.parse(fault.resolvedAt)) : copy.repairOpen}</dd></div>
            </dl>
            {attempts.length > 0 ? (
              <ul className="gps-drive-events">
                {attempts.map((attempt) => (
                  <li key={attempt.id}>{formatFaultClock(Date.parse(attempt.attemptedAt))} · {attempt.outcome}{attempt.sonucKodu == null ? "" : ` · ${attempt.sonucKodu}`} · {attempt.sonucMesaji}</li>
                ))}
              </ul>
            ) : null}
            {canManage && !fault.resolvedAt ? (
              <>
                <p className="gps-inline-note">{copy.noClearMethod}</p>
                {attempts.some((attempt) => attempt.outcome === "unknown") ? <p className="gps-fault-warn">{copy.unknownRetry}</p> : null}
                {fault.ministryStatus !== "accepted" && next !== "blocked" ? (
                  <form action={sendGpsAtsFaultAction} className="gps-inline">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="deviceId" value={deviceId} />
                    <input type="hidden" name="faultId" value={fault.id} />
                    {next === "second" ? <label><input type="checkbox" name="confirmSecond" value="yes" /> {copy.confirmSecond}</label> : null}
                    {attempts.some((attempt) => attempt.outcome === "unknown") ? <label><input type="checkbox" name="confirmUnknown" value="yes" /> {copy.confirmUnknown}</label> : null}
                    <button type="submit" className="ops-btn">{copy.submitMinistry}</button>
                  </form>
                ) : null}
                <form action={resolveGpsAtsFaultAction} className="gps-inline">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="deviceId" value={deviceId} />
                  <input type="hidden" name="faultId" value={fault.id} />
                  <label><span>{copy.resolvedAt}</span><input type="date" name="resolvedDate" required /></label>
                  <label><span>{copy.startTime}</span><input type="time" name="resolvedTime" required /></label>
                  <button type="submit" className="ops-btn">{copy.resolve}</button>
                </form>
              </>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
