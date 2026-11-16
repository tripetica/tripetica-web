"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { OpsFleetFilter } from "@/components/gps/ops-fleet-filter";
import { applyConfiguratorAction, applyParameterAction, keywordDeviceAction, readDeviceAction, restartDeviceAction, saveConfiguratorAction, type ConfiguratorActionState } from "@/lib/gps/configurator-actions";
import { type ConfiguratorCopy } from "@/lib/gps/configurator-copy";
import { type GpsCopy } from "@/lib/gps/copy";
import { type ConfiguratorSnapshot } from "@/lib/gps/configurator-types";
import { type OpsFleetChoice } from "@/lib/gps/ops-fleet-filter";
import { configuratorSectionGroups, fmb920Parameters, parameterById, unsupportedConfiguratorSections, type FmbParameter } from "@/lib/teltonika/parameters";
import { configValuesEqual, deviceCatalogOutsideText, deviceParameterText, deviceReadLabel, importDeviceReadIntoDraft, parameterApplyCounts, parameterChoices, parameterControl, parameterValueApplicable, parameterValuesDiffer, savedChoiceObservations, type ConfigValues } from "@/lib/teltonika/config-plan";
import { type ConfiguratorParameterApply } from "@/lib/gps/configurator-types";

export function ConfiguratorPanel({
  gpsCopy,
  copy,
  choices,
  snapshot,
  canManage,
  unavailable,
  locale,
}: {
  gpsCopy: GpsCopy;
  copy: ConfiguratorCopy;
  choices: OpsFleetChoice[];
  snapshot: ConfiguratorSnapshot | null;
  canManage: boolean;
  unavailable: boolean;
  locale: string;
}) {
  const saved = snapshot?.latest?.values ?? {};
  const savedKey = JSON.stringify(saved);
  const [selected, setSelected] = useState(() => new Set(choices.map((choice) => choice.id)));
  const [draft, setDraft] = useState<ConfigValues>(saved);
  const [baseline, setBaseline] = useState(savedKey);
  const [group, setGroup] = useState<(typeof configuratorSectionGroups)[number]["id"]>("features");
  const [parameterQuery, setParameterQuery] = useState("");
  const [saveState, saveAction, savePending] = useActionState(saveConfiguratorAction, null);
  const [applyState, applyAction, applyPending] = useActionState(applyConfiguratorAction, null);
  const [restartState, restartAction, restartPending] = useActionState(restartDeviceAction, null);
  const [keywordState, keywordAction, keywordPending] = useActionState(keywordDeviceAction, null);
  const [keywordCurrent, setKeywordCurrent] = useState("");
  const [keywordNext, setKeywordNext] = useState("");
  const [keywordRepeat, setKeywordRepeat] = useState("");
  const keywordRef = useRef({ current: "", next: "", repeat: "", action: "set" });
  keywordRef.current = { current: keywordCurrent, next: keywordNext, repeat: keywordRepeat, action: keywordRef.current.action };
  useEffect(() => {
    if (!keywordState) return;
    setKeywordCurrent("");
    setKeywordNext("");
    setKeywordRepeat("");
  }, [keywordState]);
  const [readState, readAction, readPending] = useActionState(readDeviceAction, null);
  const [parameterState, parameterAction, parameterPending] = useActionState(applyParameterAction, null);
  const [importNote, setImportNote] = useState<{ transferred: number; unchanged: number } | null>(null);
  const singleId = selected.size === 1 ? [...selected][0] ?? null : null;
  const router = useRouter();
  const draftRef = useRef(draft);
  const selectedRef = useRef(selected);
  const baselineRef = useRef(baseline);
  draftRef.current = draft;
  selectedRef.current = selected;
  baselineRef.current = baseline;
  const savedMark = useRef("");
  useEffect(() => {
    if (!saveState?.ok || !saveState.values) return;
    const mark = String(saveState.version ?? "");
    if (!mark || savedMark.current === mark) return;
    savedMark.current = mark;
    const stored = JSON.stringify(saveState.values);
    setDraft(saveState.values);
    setBaseline(stored);
  }, [saveState]);
  const dirty = JSON.stringify(draft) !== baseline;
  const sections = new Set<string>(configuratorSectionGroups.find((item) => item.id === group)?.sections ?? []);
  const needle = parameterQuery.trim().toLocaleLowerCase("tr-TR");
  const rows = fmb920Parameters().filter((parameter) => {
    if (!sections.has(parameter.section)) return false;
    if (!needle) return true;
    return `${parameter.id} ${parameter.name} ${parameter.options.join(" ")}`.toLocaleLowerCase("tr-TR").includes(needle);
  });
  const selectedRead = singleId
    ? snapshot?.reads.find((read) => read.deviceId === singleId) ?? null
    : null;
  const completedRead = selectedRead && (selectedRead.status === "answered" || selectedRead.status === "partial")
    ? selectedRead
    : null;
  const importable = completedRead
    ? importDeviceReadIntoDraft({ draft: {}, deviceValues: completedRead.values, parameters: fmb920Parameters() })
    : null;
  useEffect(() => {
    setImportNote(null);
  }, [singleId]);
  const chosen = selected.size === 1 ? choices.find((item) => item.id === singleId) ?? null : null;
  const deviceTitle = chosen ? (chosen.plate?.trim() || chosen.deviceCode) : "";
  const deviceModel = chosen?.model?.trim() ? chosen.model.trim().toUpperCase() : "FMB920";
  const parameterBusy = (snapshot?.parameterApplies ?? []).some((item) => selected.has(item.deviceId) && parameterPhaseOpen(item.phase));
  useEffect(() => {
    if (selectedRead?.status !== "pending" && !parameterBusy) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [parameterBusy, router, selectedRead?.status]);
  useEffect(() => {
    if (!parameterState?.ok) return;
    router.refresh();
  }, [parameterState, router]);

  return (
    <section className="configurator-panel">
      <p>{copy.lead}</p>
      {unavailable ? <p className="form-error" role="status">{copy.unavailable}</p> : null}
      <OpsFleetFilter copy={gpsCopy} vehicles={choices} selected={selected} onChange={setSelected} />
      <div className="configurator-device-actions">
        {selected.size > 1 || deviceTitle ? (
          <p className="configurator-device-identity">
            {selected.size > 1 ? copy.multipleDevices : (
              <>
                <strong>{deviceTitle}</strong>
                <span>{deviceModel}</span>
              </>
            )}
          </p>
        ) : null}
        <div className="configurator-device-buttons">
          <form
            action={(formData) => {
              formData.set("device", singleId ?? "");
              return readAction(formData);
            }}
          >
            <button type="submit" className="configurator-device-read" disabled={!canManage || !snapshot?.readsOpen || readPending || selected.size !== 1 || selectedRead?.status === "pending"}>
              <RefreshIcon />
              {copy.readDevice}
            </button>
          </form>
          <form
            action={(formData) => {
              formData.set("device", singleId ?? "");
              return restartAction(formData);
            }}
          >
            <button type="submit" className="configurator-device-restart" disabled={!canManage || !snapshot?.restartOpen || restartPending || selected.size !== 1}>
              <RestartIcon />
              {copy.restart}
            </button>
          </form>
        </div>
        <ReadStatus copy={copy} deviceId={singleId} pending={readPending} state={readState} read={selectedRead} />
        <RestartStatus copy={copy} deviceId={singleId} state={restartState} row={snapshot?.restarts.find((item) => item.deviceId === singleId) ?? null} />
      </div>
      <button
        type="button"
        className="configurator-import"
        disabled={!canManage || !importable || importable.transferred < 1}
        onClick={() => {
          if (!completedRead) return;
          const result = importDeviceReadIntoDraft({
            draft: draftRef.current,
            deviceValues: completedRead.values,
            parameters: fmb920Parameters(),
          });
          if (result.transferred < 1) return;
          setDraft(result.values);
          setImportNote({ transferred: result.transferred, unchanged: result.unchanged });
        }}
      >
        {copy.importDevice}
      </button>
      {importNote ? <p className="configurator-import-note" role="status">{copy.importResult.replace("{transferred}", String(importNote.transferred)).replace("{unchanged}", String(importNote.unchanged))}</p> : null}
      <div className="configurator-summary">
        <p>
          <strong>{copy.profile}</strong>
          {snapshot?.latest ? ` · v${snapshot.latest.version}` : ` · ${copy.noProfile}`}
        </p>
        <p>{copy.firmware}: {snapshot?.firmware.map((item) => `${item.model.toUpperCase()} ${item.firmware}`).join(", ") || "FMB920"} · {copy.firmwareClosed}</p>
      </div>
      <div className="configurator-groups" role="tablist">
        {configuratorSectionGroups.map((item) => (
          <button key={item.id} type="button" aria-selected={group === item.id} onClick={() => setGroup(item.id)}>
            {copy.groups[item.id]}
          </button>
        ))}
      </div>
      {group === "obd" ? <p>{copy.obdAdapter}</p> : null}
      {group === "security" ? (
        <form
          action={(formData) => {
            formData.set("device", singleId ?? "");
            formData.set("current", keywordRef.current.current);
            formData.set("next", keywordRef.current.next);
            formData.set("repeat", keywordRef.current.repeat);
            formData.set("keywordAction", keywordRef.current.action);
            return keywordAction(formData);
          }}
          className="configurator-restart"
        >
          <p>{singleId && snapshot?.keywords.some((item) => item.deviceId === singleId && item.hasKeyword) ? copy.keywordStored : copy.keywordEmpty}</p>
          <label>{copy.keywordCurrent}<input type="password" autoComplete="off" value={keywordCurrent} onChange={(event) => setKeywordCurrent(event.target.value)} /></label>
          <label>{copy.keywordNext}<input type="password" autoComplete="off" value={keywordNext} onChange={(event) => setKeywordNext(event.target.value)} /></label>
          <label>{copy.keywordRepeat}<input type="password" autoComplete="off" value={keywordRepeat} onChange={(event) => setKeywordRepeat(event.target.value)} /></label>
          <button type="submit" disabled={!canManage || !snapshot?.writesOpen || keywordPending || selected.size !== 1} onClick={() => { keywordRef.current.action = "set"; }}>{copy.keywordChange}</button>
          <button type="submit" disabled={!canManage || !snapshot?.writesOpen || keywordPending || selected.size !== 1} onClick={() => { keywordRef.current.action = "remove"; }}>{copy.keywordRemove}</button>
          <KeywordStatus copy={copy} deviceId={singleId} state={keywordState} row={snapshot?.keywords.find((item) => item.deviceId === singleId) ?? null} />
        </form>
      ) : null}
      <ul className="configurator-unsupported">
        {unsupportedConfiguratorSections.map((item) => (
          <li key={item.id}>{item.id === "sms-events" ? copy.smsEvents : copy.obdNative}: {item.id === "obd-native" ? copy.obdNativeReason : copy.unsupported}</li>
        ))}
      </ul>
      {group === "security" ? null : <label className="configurator-search">
        {copy.searchParameters}
        <input value={parameterQuery} onChange={(event) => setParameterQuery(event.target.value)} />
      </label>}
      {group === "security" ? null : <p className="configurator-read">{readCaption(copy, locale, selected.size, selectedRead)}</p>}
      {group === "security" ? null : <div className="configurator-table-wrap">
        <table className="configurator-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{copy.parameter}</th>
              <th>{copy.range}</th>
              <th>{copy.factory}</th>
              <th>{copy.deviceRead}</th>
              <th>{copy.savedValue}</th>
              <th>{copy.applyColumn}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((parameter) => {
              const secret = /password|username|apn/i.test(parameter.name);
              const applies = latestParameterApplies(snapshot?.parameterApplies ?? [], parameter.id, selected);
              const overlay = singleId ? verifiedOverlay(applies[0], selectedRead?.readAt ?? null) : undefined;
              const readValue = selected.size === 1 ? overlay ?? selectedRead?.values[String(parameter.id)] : undefined;
              const fieldValue = draft[String(parameter.id)] ?? "";
              const differs = selected.size === 1 && parameterValuesDiffer(parameter, readValue, fieldValue);
              const outside = deviceCatalogOutsideText(parameter, readValue, copy.outsideCatalog);
              const readText = secret ? "••••" : outside ?? deviceParameterText(parameter, readValue);
              const observed = [...new Set([readValue, fieldValue].flatMap((item) => {
                const value = savedChoiceObservations(parameter, item);
                return value ? [value] : [];
              }))];
              return (
                <tr key={parameter.id}>
                  <td>{parameter.id}</td>
                  <td>
                    {parameter.name}
                    <small>{parameter.level === "critical" ? copy.levelCritical : parameter.level === "standard" ? copy.levelStandard : copy.levelOperational}</small>
                  </td>
                  <td>{parameter.min} – {parameter.max}</td>
                  <td>{secret ? "••••" : parameter.defaultValue}</td>
                  <td>{selected.size > 1 ? copy.multiSelect : selected.size === 1 ? (readText ? <span className="configurator-read-value">{readText}</span> : copy.noRead) : ""}</td>
                  <td>
                    <ParameterField
                      parameter={parameter}
                      value={fieldValue}
                      disabled={!canManage}
                      secret={secret}
                      differs={differs}
                      observed={observed}
                      undefinedLabel={copy.undefinedValue}
                      onChange={(value) => setDraft((current) => ({ ...current, [String(parameter.id)]: value }))}
                    />
                  </td>
                  <td className="configurator-apply-cell">
                    <ParameterApply
                      copy={copy}
                      parameterId={parameter.id}
                      value={fieldValue}
                      applicable={parameterValueApplicable(parameter, fieldValue) && parameter.section !== "RS232/RS485" && parameter.section !== "LVCAN"}
                      canManage={canManage}
                      pending={parameterPending}
                      selectedCount={selected.size}
                      modelBlocked={[...selected].some((id) => {
                        const model = choices.find((choice) => choice.id === id)?.model?.trim().toLowerCase();
                        return Boolean(model && model !== "fmb920" && model !== "fmc920");
                      })}
                      applies={applies}
                      onApply={() => {
                        const data = new FormData();
                        data.set("parameter", String(parameter.id));
                        data.set("value", draftRef.current[String(parameter.id)] ?? "");
                        data.set("devices", JSON.stringify([...selectedRef.current]));
                        parameterAction(data);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
      <form
        action={(formData) => {
          formData.set("values", JSON.stringify(draftRef.current));
          formData.set("devices", JSON.stringify([...selectedRef.current]));
          formData.set("scope", "standard");
          return saveAction(formData);
        }}
        className="configurator-actions"
      >
        <button type="submit" disabled={!canManage || !snapshot?.saveOpen || savePending || !dirty}>{copy.save}</button>
        <ActionMessage copy={copy} state={saveState} saved />
      </form>
      <form
        action={(formData) => {
          formData.set("devices", JSON.stringify([...selectedRef.current]));
          formData.set("dirty", JSON.stringify(draftRef.current) !== baselineRef.current ? "yes" : "no");
          return applyAction(formData);
        }}
        className="configurator-actions"
      >
        <button type="submit" disabled={!canManage || !snapshot?.writesOpen || applyPending || !snapshot?.latest || selected.size === 0}>{copy.apply}</button>
        {dirty ? <p role="status">{copy.unsaved}</p> : null}
        <ActionMessage copy={copy} state={applyState} saved={false} />
      </form>
      <h2>{copy.jobs}</h2>
      {snapshot && snapshot.jobs.length > 0 ? (
        <table className="configurator-table">
          <thead>
            <tr><th /><th /><th /><th>{copy.version}</th><th /><th /></tr>
          </thead>
          <tbody>
            {snapshot.jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.plate || job.imei}</td>
                <td>{job.partnerName || gpsCopy.stock}</td>
                <td>{job.model?.toUpperCase() ?? "FMB920"}</td>
                <td>v{job.version}</td>
                <td>{jobStatus(copy, job.phase)}</td>
                <td>{job.error === "vehicle_safety" ? copy.vehicleSafety : job.error === "critical_held" ? copy.criticalHeld : job.error === "unread" ? copy.unread : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p>{copy.jobsEmpty}</p>}
      <ParameterApplyNote copy={copy} state={parameterState} />
      <h2>{copy.applyHistory}</h2>
      {snapshot && snapshot.parameterApplies.length > 0 ? (
        <div className="configurator-table-wrap">
          <table className="configurator-table">
            <thead>
              <tr>
                <th>{copy.plate}</th>
                <th>{copy.imei}</th>
                <th>ID</th>
                <th>{copy.applyFrom}</th>
                <th>{copy.applyTo}</th>
                <th>{copy.applyVerifiedValue}</th>
                <th>{copy.applyWhen}</th>
                <th>{copy.applyUser}</th>
                <th>{copy.applyResult}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.parameterApplies.map((item) => (
                <tr key={item.id}>
                  <td>{item.plate || "—"}</td>
                  <td>{item.imei}</td>
                  <td>{item.parameterId}</td>
                  <td>{item.from || "—"}</td>
                  <td>{item.to || "—"}</td>
                  <td>{item.verified || "—"}</td>
                  <td>{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(item.createdAt))}</td>
                  <td>{item.actorName || "—"}</td>
                  <td>{parameterResultLabel(copy, item.phase, item.error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>{copy.applyHistoryEmpty}</p>}
    </section>
  );
}

function parameterPhaseOpen(phase: string) {
  return phase === "waiting" || phase === "waiting_link" || phase === "applying" || phase === "verifying" || phase === "reading";
}

function latestParameterApplies(applies: readonly ConfiguratorParameterApply[], parameterId: number, selected: ReadonlySet<string>) {
  const latest = new Map<string, ConfiguratorParameterApply>();
  for (const item of applies) {
    if (item.parameterId !== parameterId || !selected.has(item.deviceId) || latest.has(item.deviceId)) continue;
    latest.set(item.deviceId, item);
  }
  return [...latest.values()];
}

function verifiedOverlay(apply: ConfiguratorParameterApply | undefined, readAt: string | null) {
  if (!apply || apply.phase !== "verified" || !apply.verified) return undefined;
  const appliedAt = Date.parse(apply.finishedAt ?? "");
  const readTime = Date.parse(readAt ?? "");
  if (Number.isFinite(readTime) && (!Number.isFinite(appliedAt) || readTime > appliedAt)) return undefined;
  return apply.verified;
}

function parameterResultLabel(copy: ConfiguratorCopy, phase: string, error: string | null) {
  if (phase === "applying" || phase === "reading") return copy.applySending;
  if (phase === "verifying") return copy.applyVerifying;
  if (phase === "waiting" || phase === "waiting_link") return copy.applyWaiting;
  if (phase === "verified") return copy.applyVerified;
  if (phase === "no_change") return copy.applyNoChange;
  if (error === "rolled_back") return copy.applyRolledBack;
  if (phase === "failed" || phase === "unverified" || phase === "unsupported") return copy.applyFailed;
  return copy.applyRow;
}

function parameterCountText(copy: ConfiguratorCopy, phases: readonly string[]) {
  const counts = parameterApplyCounts(phases);
  return [
    counts.verified ? copy.applyCountVerified.replace("{count}", String(counts.verified)) : "",
    counts.waiting ? copy.applyCountWaiting.replace("{count}", String(counts.waiting)) : "",
    counts.failed ? copy.applyCountFailed.replace("{count}", String(counts.failed)) : "",
    counts.unchanged ? copy.applyCountUnchanged.replace("{count}", String(counts.unchanged)) : "",
  ].filter((part) => part.length > 0).join(" · ");
}

function ParameterApply({
  copy,
  parameterId,
  value,
  applicable,
  canManage,
  pending,
  selectedCount,
  modelBlocked,
  applies,
  onApply,
}: {
  copy: ConfiguratorCopy;
  parameterId: number;
  value: string;
  applicable: boolean;
  canManage: boolean;
  pending: boolean;
  selectedCount: number;
  modelBlocked: boolean;
  applies: readonly ConfiguratorParameterApply[];
  onApply: () => void;
}) {
  const open = applies.filter((item) => parameterPhaseOpen(item.phase));
  const blocked = !canManage || pending || selectedCount === 0 || !applicable || modelBlocked || (selectedCount > 0 && open.length === selectedCount);
  const active = open.length > 0 ? parameterResultLabel(copy, open.some((item) => item.phase === "applying" || item.phase === "reading") ? "applying" : open.some((item) => item.phase === "verifying") ? "verifying" : "waiting_link", null) : copy.applyRow;
  const summary = parameterCountText(copy, applies.map((item) => item.phase));
  return (
    <>
      <button type="button" className="configurator-row-apply" aria-label={`${copy.applyRow} ${parameterId}`} disabled={blocked || !value.trim()} onClick={onApply}>
        {active}
      </button>
      {selectedCount > 1 && summary ? (
        <details className="configurator-apply-status">
          <summary>{summary}</summary>
          <ul>
            {applies.map((item) => <li key={item.id}>{item.plate || item.imei}: {parameterResultLabel(copy, item.phase, item.error)}</li>)}
          </ul>
        </details>
      ) : null}
      {selectedCount === 1 && applies[0] ? <small className="configurator-apply-status">{parameterResultLabel(copy, applies[0].phase, applies[0].error)}</small> : null}
    </>
  );
}

function ParameterApplyNote({ copy, state }: { copy: ConfiguratorCopy; state: ConfiguratorActionState | null }) {
  if (!state) return null;
  if (state.ok && (state.queued ?? 0) > 0) return <p className="ops-form-success" role="status">{copy.applyQueued.replace("{count}", String(state.queued ?? 0))}</p>;
  if (state.ok && (state.unchanged ?? 0) > 0) return <p role="status">{copy.applyUnchanged}</p>;
  if (state.ok && (state.skipped ?? 0) > 0) return <p role="status">{copy.applySkipped}</p>;
  if (state.ok) return null;
  const text = state.error === "forbidden" ? copy.forbidden
    : state.error === "devices" ? copy.devices
      : state.error === "value" ? copy.applyValue
        : state.error === "unsupported" ? copy.applyUnsupported
          : copy.failed;
  return <p className="form-error" role="alert">{text}</p>;
}

function ParameterField({
  parameter,
  value,
  disabled,
  secret,
  differs,
  observed,
  undefinedLabel,
  onChange,
}: {
  parameter: FmbParameter;
  value: string;
  disabled: boolean;
  secret: boolean;
  differs: boolean;
  observed: readonly string[];
  undefinedLabel: string;
  onChange: (value: string) => void;
}) {
  const label = `${parameter.id} ${parameter.name}`;
  const diff = differs ? "true" : undefined;
  if (parameterControl(parameter) === "select") {
    const choices = parameterChoices(parameter);
    const selected = choices.find((choice) => configValuesEqual(choice.value, value))?.value
      ?? observed.find((item) => configValuesEqual(item, value))
      ?? value;
    return (
      <select aria-label={label} data-diff={diff} value={selected} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{"\u00a0"}</option>
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        {observed.map((item) => <option key={item} value={item}>{`${item} – ${undefinedLabel}`}</option>)}
      </select>
    );
  }
  if (parameterControl(parameter) === "text") {
    return (
      <input
        aria-label={label}
        data-diff={diff}
        type={secret ? "password" : "text"}
        value={value}
        disabled={disabled}
        maxLength={160}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      aria-label={label}
      data-diff={diff}
      type="number"
      inputMode="decimal"
      min={parameter.min}
      max={parameter.max}
      step="any"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function KeywordStatus({
  copy,
  deviceId,
  state,
  row,
}: {
  copy: ConfiguratorCopy;
  deviceId: string | null;
  state: ConfiguratorActionState | null;
  row: { phase: string | null; error: string | null } | null;
}) {
  if (!deviceId) return null;
  const current = state?.deviceId === deviceId ? state : null;
  const code = current?.error && current.error !== "no_link" ? current.error : row?.error;
  const phase = current?.phase ?? row?.phase ?? "";
  if (current?.error === "no_link" || phase === "no_link" || code === "no_link") {
    return <p className="form-error" role="status">{copy.keywordStatus.no_link}</p>;
  }
  const named = code ? copy.keywordStatus[code as keyof typeof copy.keywordStatus] : "";
  if (named && code !== "preparing" && code !== "sent") return <p role="status">{named}</p>;
  const label = phase === "armed" ? copy.keywordStatus.preparing : copy.keywordStatus[phase as keyof typeof copy.keywordStatus];
  return label ? <p role="status">{label}</p> : null;
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M13.2 8a5.2 5.2 0 1 1-1.4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.4 2.6v3.2H10.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M8 2.2v4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.1 5.1a5 5 0 1 0 1.1-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RestartStatus({
  copy,
  deviceId,
  state,
  row,
}: {
  copy: ConfiguratorCopy;
  deviceId: string | null;
  state: ConfiguratorActionState | null;
  row: { phase: string; error: string | null } | null;
}) {
  if (!deviceId) return null;
  const current = state?.deviceId === deviceId ? state : null;
  if (current?.error === "no_link" || current?.phase === "no_link") {
    return <p className="form-error" role="status">{copy.restartNoLink}</p>;
  }
  if (current?.phase) {
    const label = current.phase === "armed" ? copy.restartPhases.preparing : copy.restartPhases[current.phase as keyof typeof copy.restartPhases];
    return label ? <p role="status">{label}</p> : null;
  }
  if (!row) return null;
  if (row.phase === "no_link" || row.error === "no_link") return <p className="form-error" role="status">{copy.restartNoLink}</p>;
  if (row.error === "reconnect_observed") return <p role="status">{copy.restartReconnect}</p>;
  const label = row.phase === "armed" ? copy.restartPhases.preparing : copy.restartPhases[row.phase as keyof typeof copy.restartPhases];
  return label ? <p role="status">{label}</p> : null;
}

function readCount(copy: ConfiguratorCopy, read: { progress: { read: number; total: number; unsupported?: number; empty?: number; failed?: number; unresolved?: number } | null } | null) {
  const progress = read?.progress;
  if (!progress || progress.total < 1) return "";
  const parts = [`${progress.read}/${progress.total}`];
  if ((progress.unsupported ?? 0) > 0) parts.push(`${progress.unsupported} ${copy.readCounts.unsupported}`);
  if ((progress.empty ?? 0) > 0) parts.push(`${progress.empty} ${copy.readCounts.empty}`);
  if ((progress.failed ?? 0) > 0) parts.push(`${progress.failed} ${copy.readCounts.failed}`);
  if ((progress.unresolved ?? 0) > 0) parts.push(`${progress.unresolved} ${copy.readCounts.unresolved}`);
  return parts.join(" · ");
}

function readCaption(
  copy: ConfiguratorCopy,
  locale: string,
  selectedCount: number,
  read: { readAt: string | null; status: string; values: Record<string, string>; progress: { read: number; total: number; phase: string } | null } | null,
) {
  const label = deviceReadLabel({
    selectedCount,
    status: read?.status ?? null,
    readAt: read?.readAt ?? null,
    hasValues: Boolean(read && Object.keys(read.values).length > 0),
  });
  const date = read?.readAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(read.readAt))
    : "";
  const stale = date ? `${copy.staleRead} ${date}` : copy.staleRead;
  const count = readCount(copy, read);
  const withCount = (text: string) => count ? `${text} · ${count}` : text;
  if (label === "multiple") return copy.multiSelect;
  if (label === "hidden") return "";
  if (label === "waiting" || label === "waiting-stale") {
    const reading = read?.progress && (read.progress.phase === "reading" || read.progress.read > 0);
    return withCount(reading ? copy.readStatus.reading : copy.readStatus.waiting);
  }
  if (label === "partial") return withCount(date ? `${copy.readStatus.partial} · ${date}` : copy.readStatus.partial);
  if (label === "partial-stale") return `${withCount(copy.readStatus.partial)} · ${stale}`;
  if (label === "failed" || label === "failed-stale") return copy.readStatus.failed;
  if (label === "missing") return copy.noRead;
  if (label === "stale") return stale;
  return withCount(date ? `${copy.readStatus.done} · ${date}` : copy.readStatus.done);
}

function ReadStatus({
  copy,
  deviceId,
  pending,
  state,
  read,
}: {
  copy: ConfiguratorCopy;
  deviceId: string | null;
  pending: boolean;
  state: ConfiguratorActionState | null;
  read: { status: string; progress: { read: number; total: number; phase: string } | null } | null;
}) {
  if (!deviceId) return null;
  if (pending || (state?.deviceId === deviceId && state.phase === "starting" && read?.status !== "pending" && read?.status !== "answered" && read?.status !== "partial")) {
    return <p role="status">{copy.readStatus.starting}</p>;
  }
  if (state?.deviceId === deviceId && state.ok === false) {
    const text = state.error === "forbidden" ? copy.forbidden : state.error === "devices" ? copy.devices : copy.readStatus.failed;
    return <p className="form-error" role="alert">{text}</p>;
  }
  if (read?.status === "pending") {
    const count = readCount(copy, read);
    const reading = read.progress && (read.progress.phase === "reading" || read.progress.read > 0);
    const text = reading ? copy.readStatus.reading : copy.readStatus.waiting;
    return <p role="status">{count ? `${text} · ${count}` : text}</p>;
  }
  return null;
}

function jobStatus(copy: ConfiguratorCopy, phase: string) {
  if (phase === "reading" || phase === "applying" || phase === "verifying") return copy.phases.applying;
  if (phase === "replied") return copy.phases.unverified;
  if (phase === "waiting") return copy.phases.waiting_link;
  return copy.phases[phase as keyof typeof copy.phases] ?? phase;
}

function rejectionDetail(copy: ConfiguratorCopy, detail: string) {
  return detail.split("|").map((part) => {
    const [id, reason] = part.split(":");
    const why = copy.rejection[reason as keyof typeof copy.rejection] ?? reason;
    if (!id || id === "values") return why;
    const name = /^\d+$/.test(id) ? parameterById(Number(id))?.name : "";
    return `${id}${name ? ` ${name}` : ""}: ${why}`;
  }).join(" · ");
}

function ActionMessage({ copy, state, saved }: { copy: ConfiguratorCopy; state: ConfiguratorActionState | null; saved: boolean }) {
  if (!state) return null;
  if (state.ok) return <p className="ops-form-success" role="status">{saved ? copy.saved : copy.queued}</p>;
  const text = state.error === "forbidden" ? copy.forbidden
    : state.error === "invalid" ? `${copy.invalid} ${state.detail ? rejectionDetail(copy, state.detail) : ""}`.trim()
      : state.error === "dev_only" || state.error === "dispatch_closed" ? copy.devOnly
        : state.error === "unsaved" ? copy.unsaved
          : state.error === "devices" ? copy.devices
            : copy.failed;
  return <p className="form-error" role="alert">{text}</p>;
}
