import { AtsFaultForm } from "@/components/gps/ats-fault-form";
import { resolveGpsAtsFaultAction } from "@/lib/gps/ats-fault-actions";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import {
  deviceSignalState,
  faultDeadlines,
  faultFormFields,
  faultReportingWindow,
  formatFaultClock,
  nextFaultReport,
  panelMinistryView,
} from "@/lib/gps/ats-fault";
import {
  listAcceptedStamps,
  listAttempts,
  listFaults,
  loadFaultContext,
} from "@/lib/gps/ats-fault-store";
import { type Locale } from "@/lib/i18n/config";
import { atsFaultSocketOpen } from "@/lib/uetds/ats-post";

function historyTitle(startedAt: string) {
  return formatFaultClock(Date.parse(startedAt));
}

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
  // Server-rendered operational status is intentionally calculated at request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const plateKey = context.plate.replace(/\s+/g, "").toUpperCase();
  const window = faultReportingWindow(await listAcceptedStamps(context.vehicleId, plateKey), now);
  const next = nextFaultReport(window);
  const faults = await listFaults({ vehicleId: context.vehicleId, limit: 20 });
  const attemptsByFault = new Map(await Promise.all(faults.map(async (fault) => [fault.id, await listAttempts(fault.id)] as const)));
  const socketOpen = atsFaultSocketOpen();
  const linkMs = context.lastSeenAt ? Date.parse(context.lastSeenAt) : context.lastHeartbeatAt ? Date.parse(context.lastHeartbeatAt) : null;
  const gnssMs = context.lastGnssAt ? Date.parse(context.lastGnssAt) : null;
  const signal = deviceSignalState({ lastLinkMs: linkMs, lastGnssMs: gnssMs, nowMs: now });
  const open = faults.filter((fault) => !fault.resolvedAt);
  const accepted = open.find((fault) => fault.ministryStatus === "accepted") ?? null;
  const ranked = open.flatMap((fault) => (attemptsByFault.get(fault.id) ?? []).map((attempt) => ({ fault, attempt })));
  ranked.sort((left, right) => Date.parse(right.attempt.attemptedAt) - Date.parse(left.attempt.attemptedAt));
  const primary = accepted ?? ranked[0]?.fault ?? open[0] ?? null;
  const primaryAttempts = primary ? attemptsByFault.get(primary.id) ?? [] : [];
  const ministry = panelMinistryView({
    status: accepted?.ministryStatus ?? primary?.ministryStatus ?? "local",
    attempts: accepted ? attemptsByFault.get(accepted.id) ?? [] : primaryAttempts,
  });
  const started = primary ? Date.parse(primary.startedAt) : null;
  const deadlines = started == null ? null : faultDeadlines(started);
  const clearanceLabel = primary ? copy.clearanceOpen : copy.empty;
  const prefill = primary && started != null ? faultFormFields(started) : { date: "", time: "" };
  const failure = ministry.state === "rejected"
    ? (ministry.code === 159 ? copy.date159 : ministry.detail || copy.ministryRejected)
    : null;
  const deviceLabel = signal === "offline" ? copy.deviceOffline : copy.deviceRestored;
  const ministryLabel = ministry.state === "accepted"
    ? copy.ministryAccepted
    : ministry.state === "sending"
      ? copy.ministrySending
      : ministry.state === "rejected"
        ? copy.ministryRejected
        : ministry.state === "unknown"
          ? copy.ministryUnknown
          : copy.ministryNotSent;
  const previous = faults.filter((fault) => fault.id !== primary?.id);
  return (
    <section className="gps-section gps-fault-panel" id="ats-fault">
      <header className="gps-fault-head">
        <h2>{context.plate}</h2>
        <p>{context.driverName ?? copy.missing}</p>
      </header>
      {notice ? <p className="gps-inline-note">{notice}</p> : null}

      {canManage && !primary ? (
        <section className="gps-fault-compose">
          <h3>{copy.newReportTitle}</h3>
          <AtsFaultForm
            key="new-fault"
            locale={locale}
            deviceId={deviceId}
            faultId={null}
            initialDate={prefill.date}
            initialTime={prefill.time}
            initialKind=""
            initialDescription=""
            next={next}
            unknown={false}
            socketOpen={socketOpen}
          />
        </section>
      ) : null}

      {primary ? (
        <section className="gps-fault-current">
          <div className="gps-fault-current-head">
            <h3>{copy.openReportTitle}</h3>
          </div>
          {canManage ? (
            <AtsFaultForm
              key={primary.id}
              locale={locale}
              deviceId={deviceId}
              faultId={primary.id}
              initialDate={prefill.date}
              initialTime={prefill.time}
              initialKind={primary.kind}
              initialDescription={primary.description}
              next={next}
              unknown={ministry.state === "unknown"}
              socketOpen={socketOpen}
              accepted={primary.ministryStatus === "accepted"}
            />
          ) : null}
          <div className="gps-fault-states">
            <section className={`gps-fault-state ${signal === "offline" ? "is-bad" : "is-ok"}`}>
              <h4>{copy.deviceState}</h4>
              <strong>{deviceLabel}</strong>
              <p>{copy.lastLink}: {linkMs == null ? copy.missing : formatFaultClock(linkMs)}</p>
              <p>{copy.lastGnss}: {gnssMs == null ? copy.missing : formatFaultClock(gnssMs)}</p>
              {signal === "no_gnss" ? <p>{copy.gnssStale}</p> : null}
            </section>
            <section className={`gps-fault-state ${ministry.state === "accepted" ? "is-ok" : ministry.state === "rejected" ? "is-bad" : "is-wait"}`}>
              <h4>{copy.ministryState}</h4>
              <strong>{ministryLabel}</strong>
              {failure ? <p>{failure}</p> : null}
              {ministry.state === "unknown" ? <p>{ministry.detail || copy.duplicateRisk}</p> : null}
              {ministry.state === "accepted" && accepted?.ministryAcceptedAt ? <p>{copy.ministryAcceptedAt}: {formatFaultClock(Date.parse(accepted.ministryAcceptedAt))}</p> : null}
              {ministry.state === "accepted" ? <p>{copy.ministryCode}: {ministry.code ?? copy.ministryNoCode}</p> : null}
            </section>
            <section className="gps-fault-state is-wait">
              <h4>{copy.clearanceState}</h4>
              <strong>{clearanceLabel}</strong>
              {deadlines ? <p>{copy.notifyDeadline}: {formatFaultClock(deadlines.notifyDeadlineMs)}</p> : null}
              {deadlines ? <p>{copy.repairDeadline}: {formatFaultClock(deadlines.repairDeadlineMs)}</p> : null}
            </section>
          </div>

          {canManage ? (
          <form action={resolveGpsAtsFaultAction} className="gps-fault-resolve">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deviceId" value={deviceId} />
            <input type="hidden" name="faultId" value={primary.id} />
            <div className="gps-fault-resolve-label">
              <span>{copy.resolvedAt}</span>
              <details className="gps-fault-info">
                <summary aria-label={copy.clearanceInfo}>ⓘ</summary>
                <p>{copy.noClearMethod}</p>
              </details>
            </div>
            <label className="gps-fault-date gps-fault-resolve-control">
              <input aria-label={copy.resolvedDate} type="date" name="resolvedDate" required />
            </label>
            <label className="gps-fault-time gps-fault-resolve-control">
              <input aria-label={copy.resolvedTime} type="time" name="resolvedTime" required />
            </label>
            <button type="submit" className="ops-btn-primary">{copy.resolve}</button>
          </form>
          ) : null}
        </section>
      ) : null}

      <details className="gps-fault-fold gps-fault-history">
        <summary>{copy.historyTitle}</summary>
        {previous.length === 0 ? <p>{copy.empty}</p> : (
          <div className="gps-fault-history-list">
            {previous.map((fault) => {
              const attempts = attemptsByFault.get(fault.id) ?? [];
              const historyMinistry = panelMinistryView({ status: fault.ministryStatus, attempts });
              const historyMinistryLabel = historyMinistry.state === "accepted"
                ? copy.ministryAccepted
                : historyMinistry.state === "rejected"
                  ? copy.ministryRejected
                  : historyMinistry.state === "unknown"
                    ? copy.ministryUnknown
                    : historyMinistry.state === "sending"
                      ? copy.ministrySending
                      : copy.ministryNotSent;
              return (
                <details key={fault.id} className="gps-fault-history-item">
                  <summary>{historyTitle(fault.startedAt)}</summary>
                  <div>
                    <p>{copy.faultStartedAt}: {formatFaultClock(Date.parse(fault.startedAt))}</p>
                    <p>{copy.kind}: {copy.kinds[fault.kind]}</p>
                    <p>{copy.description}: {fault.description}</p>
                    <p>{copy.ministryState}: {historyMinistryLabel}</p>
                    {fault.ministryAcceptedAt ? <p>{copy.ministryAcceptedAt}: {formatFaultClock(Date.parse(fault.ministryAcceptedAt))}</p> : null}
                    {historyMinistry.state === "accepted" ? <p>{copy.ministryCode}: {historyMinistry.code ?? copy.ministryNoCode}</p> : null}
                    <p>{copy.clearanceState}: {fault.resolvedAt ? `${copy.clearanceClosed} · ${formatFaultClock(Date.parse(fault.resolvedAt))}` : copy.clearanceOpen}</p>
                    <h4>{copy.attempts}</h4>
                    {attempts.length === 0 ? <p>{copy.noAttempts}</p> : (
                      <ul>
                        {[...attempts].reverse().map((attempt) => (
                          <li key={attempt.id}>
                            <span>{formatFaultClock(Date.parse(attempt.attemptedAt))}</span>
                            <span>{copy.outcomes[attempt.outcome as keyof typeof copy.outcomes] ?? copy.ministryUnknown}</span>
                            {attempt.sonucKodu != null ? <span>{copy.ministryCode}: {attempt.sonucKodu}</span> : null}
                            {attempt.sonucMesaji ? <span>{attempt.sonucKodu === 159 ? copy.date159 : attempt.sonucMesaji}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </details>
    </section>
  );
}
