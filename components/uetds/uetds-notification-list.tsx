"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { deleteCancelledUetdsNotificationsAction } from "@/lib/uetds/notification-actions";
import { type UetdsFormCopy, uetdsStatusLabel } from "@/lib/uetds/copy";
import { type UetdsListFilters } from "@/lib/uetds/list-policy";
import { type UetdsNotificationListItem } from "@/lib/uetds/notification-view";

type Props = {
  items: UetdsNotificationListItem[]; emptyLabel: string; copy: UetdsFormCopy;
  detailBaseHref: string; search: string; searchAction: string;
  actor: "ops" | "partner"; locale: string; filters: UetdsListFilters;
  notificationDeleted?: boolean;
};
export function UetdsNotificationList({ items, emptyLabel, copy, detailBaseHref, search, searchAction, actor, locale, filters, notificationDeleted }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [result, deleteAction, pending] = useActionState(deleteCancelledUetdsNotificationsAction, { results: [], attempted: false });
  const form = useRef<HTMLFormElement>(null);
  const all = useRef<HTMLInputElement>(null);
  const removed = result.results.filter(r => r.reason === "deleted");
  const failures = result.results.filter(r => r.reason !== "deleted");
  const visible = items.filter(item => !removed.some(r => r.id === item.id));
  const picked = visible.filter(item => selected.includes(item.id));
  const canSelect = filters.status === "cancelled";
  useEffect(() => { if (all.current) all.current.indeterminate = picked.length > 0 && picked.length < visible.length; }, [picked.length, visible.length]);
  useEffect(() => { if (result.attempted) { setConfirm(false); setSelected([]); } }, [result]);
  const sortQuery = new URLSearchParams({ q: search, date: filters.date, status: filters.status, sort: filters.sort === "asc" ? "desc" : "asc" });
  return <div className="uetds-manage">
    {notificationDeleted ? <p className="uetds-form-info" role="status">{copy.notificationDeleted}</p> : null}
    <form className="uetds-list-filters" action={searchAction} method="get">
      <label>{copy.listSearch}<input type="search" name="q" defaultValue={search} placeholder={copy.listSearch} /></label>
      <label>{copy.filterDate}<select name="date" defaultValue={filters.date}>
        {([['all',copy.filterAll],['today',copy.filterToday],['tomorrow',copy.filterTomorrow],['yesterday',copy.filterYesterday],['past',copy.filterPast],['future',copy.filterFuture]] as const).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
      <label>{copy.filterStatus}<select name="status" defaultValue={filters.status}>
        {([['active',copy.listActive],['completed',copy.listCompleted],['cancelled',copy.statusCancelled],['archive',copy.listArchive],['all',copy.filterAll]] as const).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
      <input type="hidden" name="sort" value={filters.sort} />
      <button className="ops-btn-secondary">{copy.filterApply}</button>
    </form>
    {result.attempted ? <div className="uetds-form-info" role="status">
      <p>{copy.deleteSummary.replace("{deleted}", String(removed.length)).replace("{failed}", String(failures.length))}</p>
      {failures.length > 0 ? <ul>{failures.map(r => <li key={r.id}>{items.find(item => item.id === r.id)?.ministryReference || r.id}: {r.reason === "still-valid" ? copy.deleteStillValid : copy.deleteUnverified}</li>)}</ul> : null}
    </div> : null}
    <form action={deleteAction} ref={form}>
      <input type="hidden" name="actor" value={actor} /><input type="hidden" name="locale" value={locale} />
      {canSelect && picked.length > 0 ? <button type="button" disabled={pending} className="ops-btn-secondary" onClick={() => setConfirm(true)}>{copy.deleteSelected} ({picked.length})</button> : null}
      {!visible.length ? <p className="ops-empty">{emptyLabel}</p> : <div className="ops-table-wrap uetds-list-scroll" tabIndex={0} role="region" aria-label={copy.listSearch}><table className="ops-table uetds-list-table"><thead><tr>
        {canSelect ? <th><input ref={all} type="checkbox" aria-label={copy.selectAll} checked={picked.length === visible.length && visible.length > 0} disabled={pending} onChange={e => setSelected(e.target.checked ? visible.map(item => item.id) : [])} /></th> : null}
        <th>{copy.listNo}</th>
        <th aria-sort={filters.sort === "asc" ? "ascending" : "descending"}><a href={`${searchAction}?${sortQuery}`}>{copy.listStart} {filters.sort === "asc" ? "↑" : "↓"}</a></th>
        <th>{copy.listEnd}</th><th className="uetds-route-col">{copy.confirmRoute}</th><th>{copy.listPlate}</th><th>{copy.driver}</th><th>{copy.listStatus}</th><th>{copy.listDetail}</th>
      </tr></thead><tbody>{visible.map((item,index) => <tr key={item.id}>
        {canSelect ? <td><input type="checkbox" name="ids" value={item.id} aria-label={`${copy.listNo} ${index+1}`} checked={selected.includes(item.id)} disabled={pending} onChange={e => setSelected(prev => e.target.checked ? [...prev,item.id] : prev.filter(id => id !== item.id))} /></td> : null}
        <td>{index+1}</td><td>{item.startLabel}</td><td>{item.endLabel}</td><td className="uetds-route-col">{item.routeLabel}</td><td>{item.plate}</td><td>{item.driverName}</td>
        <td><span className={`uetds-status-badge is-${item.listClassification ?? 'other'}`}>{item.listClassification === "completed" ? copy.listCompleted : item.finalVerificationResult === "verified" ? copy.verifiedByMinistry : item.finalVerificationResult === "final-verification-failed" ? copy.verificationPending : uetdsStatusLabel(item.status, copy)}</span></td>
        <td><a className="ops-btn-secondary" href={`${detailBaseHref}/${item.id}`}>{copy.listDetail}</a></td>
      </tr>)}</tbody></table></div>}
    </form>
    {confirm ? <OpsConfirmDialog title={copy.deleteSelected} pending={pending} confirmTone="danger" confirmLabel={copy.deletePermanently} cancelLabel={copy.confirmNo} onClose={() => setConfirm(false)} onConfirm={() => form.current?.requestSubmit()}><p>{copy.deleteConfirm}</p></OpsConfirmDialog> : null}
  </div>;
}
