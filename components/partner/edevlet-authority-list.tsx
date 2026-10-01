"use client";

import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type PartnerEdevletAuthoritySummary } from "@/lib/uetds/partner-authority-fields";

type EdevletAuthorityListProps = {
  locale: Locale;
  copy: PartnerCopy;
  authorities: PartnerEdevletAuthoritySummary[];
};

export function EdevletAuthorityList({ locale, copy, authorities }: EdevletAuthorityListProps) {
  const addHref = localizedPath(locale, "/partner/edevlet-authorities/new");
  return (
    <>
      <div className="ops-page-head partner-drivers-head">
        <h1>{copy.edevletAuthorities}</h1>
        <a className="ops-btn-primary partner-drivers-add" href={addHref}>
          {copy.edevletAuthorityNew}
        </a>
      </div>
      {authorities.length === 0 ? (
        <div className="partner-empty">
          <p className="partner-empty-lead">{copy.edevletAuthorityEmpty}</p>
          <a className="ops-btn-primary" href={addHref}>
            {copy.edevletAuthorityNew}
          </a>
        </div>
      ) : (
        <div className="ops-table-wrap partner-drivers-table">
          <table className="ops-table partner-drivers-data-table">
            <thead>
              <tr>
                <th>{copy.driverFullName}</th>
                <th>{copy.driverNationalId}</th>
                <th>{copy.driverStatus}</th>
                <th>{copy.edevletAuthorityCompanies}</th>
                <th>{copy.driverDetail}</th>
              </tr>
            </thead>
            <tbody>
              {authorities.map((authority) => (
                <tr key={authority.id}>
                  <td>{authority.fullName}</td>
                  <td>{authority.maskedIdentity}</td>
                  <td>
                    <span
                      className={`ops-status-badge ${
                        authority.status === "active" ? "is-active" : "is-inactive"
                      }`}
                    >
                      {authority.status === "active" ? copy.driverActive : copy.driverInactive}
                    </span>
                  </td>
                  <td>
                    {authority.companies.length > 0
                      ? authority.companies.map((company) => company.shortName).join(", ")
                      : copy.edevletAuthorityNoCompanies}
                  </td>
                  <td>
                    <a
                      className="ops-row-detail"
                      href={localizedPath(locale, `/partner/edevlet-authorities/${authority.id}`)}
                    >
                      {copy.driverDetail}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
