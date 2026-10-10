"use client";

import { useActionState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { type PartnerCopy } from "@/lib/partner/copy";
import { PARTNER_TABS } from "@/lib/partner/access";
import { type PartnerExtraUser } from "@/lib/partner/user-store";
import {
  createPartnerUserAction,
  deletePartnerUserAction,
  setPartnerUserStatusAction,
  updatePartnerUserTabsAction,
} from "@/lib/partner/user-actions";

const TAB_LABEL: Record<(typeof PARTNER_TABS)[number], keyof PartnerCopy> = {
  jobs: "jobs",
  accepted: "accepted",
  drivers: "drivers",
  vehicles: "vehicles",
  gps: "gps",
  uetds: "uetds",
  edevlet: "edevletAuthorities",
  profile: "profile",
  billing: "employerBilling",
  users: "users",
};

export function PartnerUserAdmin({
  locale,
  copy,
  users,
}: {
  locale: Locale;
  copy: PartnerCopy;
  users: PartnerExtraUser[];
}) {
  const [state, action, pending] = useActionState(createPartnerUserAction, { error: null, ok: false });
  const error = state.error === "duplicate"
    ? copy.usersDuplicate
    : state.error === "mismatch"
      ? copy.usersPasswordMismatch
      : state.error
        ? copy.usersInvalid
        : null;
  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <h1>{copy.users}</h1>
      </header>
      <p>{copy.usersLead}</p>
      <form action={action} className="ops-form">
        <input type="hidden" name="locale" value={locale} />
        <label>
          <span>{copy.usersEmail}</span>
          <input name="email" type="email" autoComplete="off" required />
        </label>
        <label>
          <span>{copy.usersPassword}</span>
          <input name="password" type="password" autoComplete="new-password" required />
        </label>
        <label>
          <span>{copy.usersPasswordAgain}</span>
          <input name="passwordAgain" type="password" autoComplete="new-password" required />
        </label>
        <fieldset>
          <legend>{copy.usersTabs}</legend>
          {PARTNER_TABS.map((tab) => (
            <label key={tab}>
              <input type="checkbox" name="tab" value={tab} /> {copy[TAB_LABEL[tab]]}
            </label>
          ))}
        </fieldset>
        {error ? <p className="ops-form-error">{error}</p> : null}
        {state.ok ? <p className="ops-form-ok">{copy.usersSaved}</p> : null}
        <button type="submit" className="ops-btn-primary" disabled={pending}>{copy.usersCreate}</button>
      </form>
      {users.length === 0 ? <p>{copy.usersEmpty}</p> : users.map((user) => (
        <section key={user.id} className="gps-section">
          <h2>{user.email}</h2>
          <p>{user.status === "active" ? copy.driverActive : copy.driverInactive}</p>
          <form action={updatePartnerUserTabsAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="userId" value={user.id} />
            {PARTNER_TABS.map((tab) => (
              <label key={`${user.id}:${tab}`}>
                <input type="checkbox" name="tab" value={tab} defaultChecked={user.tabs.includes(tab)} /> {copy[TAB_LABEL[tab]]}
              </label>
            ))}
            <button type="submit" className="ops-btn">{copy.saveProfile}</button>
          </form>
          <form action={setPartnerUserStatusAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="status" value={user.status === "active" ? "inactive" : "active"} />
            <button type="submit" className="ops-btn-ghost">{user.status === "active" ? copy.usersDeactivate : copy.usersActivate}</button>
          </form>
          <form action={deletePartnerUserAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="userId" value={user.id} />
            <button type="submit" className="ops-btn-ghost">{copy.usersDelete}</button>
          </form>
        </section>
      ))}
    </div>
  );
}
