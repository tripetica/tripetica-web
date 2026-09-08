"use client";

import { useActionState, useState } from "react";
import { PartnerJobAssignment } from "@/components/partner/job-assignment";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { formatOpsDateTime } from "@/lib/ops/format";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import {
  partnerAcceptJobAction,
  type PartnerJobFormState,
} from "@/lib/partner/job-actions";
import { type JobAssignmentView } from "@/lib/partner/job-assignment-view";
import { type PartnerJobPassenger, type PartnerJobRecord } from "@/lib/partner/job-types";
import {
  partnerJobDurationLabel,
  partnerJobGenderLabel,
  partnerJobServiceTypeLabel,
  partnerJobTourName,
  partnerPassengerIdentityDisplay,
} from "@/lib/partner/job-view";

type PartnerJobDetailProps = {
  locale: Locale;
  copy: PartnerCopy;
  job: PartnerJobRecord;
  isPrimaryPartner?: boolean;
  assignment?: JobAssignmentView | null;
  drivers?: PartnerDriverRecord[];
  vehicles?: PartnerVehicleRecord[];
};

function present(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function display(value: string | null | undefined) {
  return present(value) || "—";
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const shown = present(value);
  if (!shown) {
    return null;
  }
  return (
    <div className="partner-profile-row">
      <p className="partner-billing-label">{label}</p>
      <p className="partner-billing-value">{shown}</p>
    </div>
  );
}

function passengerIdentity(passenger: PartnerJobPassenger) {
  return present(passenger.nationalId) || present(passenger.passportNumber);
}

function passengerHasDetails(passenger: PartnerJobPassenger, copy: PartnerCopy) {
  return Boolean(
    present(passenger.firstName) ||
      present(passenger.lastName) ||
      partnerJobGenderLabel(passenger.gender, copy) ||
      present(passenger.countryName) ||
      passengerIdentity(passenger),
  );
}

export function PartnerJobDetail({
  locale,
  copy,
  job,
  isPrimaryPartner = false,
  assignment = null,
  drivers = [],
  vehicles = [],
}: PartnerJobDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, action, pending] = useActionState<PartnerJobFormState, FormData>(
    partnerAcceptJobAction,
    { error: null, ok: false },
  );
  const listHref = localizedPath(locale, job.accepted ? "/partner/accepted" : "/partner/jobs");
  const duration = partnerJobDurationLabel(job.serviceType, job.durationHours, locale);
  const serviceType = partnerJobServiceTypeLabel(job.serviceType, locale);
  const tourName = partnerJobTourName(job.tourCode, locale);
  const passengers =
    job.passengers?.filter((passenger) => passengerHasDetails(passenger, copy)) ?? [];

  return (
    <section className="partner-billing-card partner-profile-card" aria-labelledby="partner-job-title">
      <div className="partner-driver-detail-head">
        <h1 id="partner-job-title" className="partner-driver-title">
          {job.accepted ? job.reservationCode || copy.accepted : copy.jobs}
        </h1>
      </div>

      {state.error ? (
        <p className="ops-form-error" role="alert">
          {state.error === "already-taken"
            ? copy.jobAlreadyTaken
            : state.error === "not-visible"
              ? copy.jobNotVisible
              : copy.jobAcceptFailed}
        </p>
      ) : null}

      {job.accepted ? <Row label={copy.jobReservationCode} value={job.reservationCode} /> : null}
      <Row label={copy.jobDateTime} value={formatOpsDateTime(job.pickupAt, locale)} />
      <Row label={copy.jobServiceType} value={serviceType ?? job.serviceLabel} />
      <Row label={copy.jobTourName} value={tourName} />
      <Row label={copy.jobPickup} value={job.pickupName} />
      <Row label={copy.jobDropoff} value={job.dropoffName} />
      {duration !== "—" ? <Row label={copy.jobDuration} value={duration} /> : null}
      <Row
        label={copy.jobPassengers}
        value={job.passengerCount != null ? String(job.passengerCount) : null}
      />
      <Row
        label={copy.jobBags}
        value={job.luggageCount != null ? String(job.luggageCount) : null}
      />
      {(job.babySeatCount ?? 0) > 0 ? (
        <Row label={copy.jobBabySeats} value={String(job.babySeatCount)} />
      ) : null}
      {job.isAirportPickup ? (
        <>
          <Row label={copy.jobFlightCode} value={job.flightCode} />
          <Row
            label={copy.jobGreeter}
            value={job.meetAndGreet ? copy.jobGreeterYes : copy.jobGreeterNo}
          />
        </>
      ) : null}
      <Row label={copy.jobNote} value={job.notes} />
      <Row label={copy.jobPayoutFull} value={job.payoutLabel} />
      {job.accepted && job.collectLabel ? (
        <Row label={copy.jobCollectFromPassenger} value={job.collectLabel} />
      ) : null}
      {job.accepted && job.canSeePassengerContact ? (
        <>
          <Row label={copy.jobPassengerPhone} value={job.customerPhone} />
          <Row label={copy.jobPassengerEmail} value={job.customerEmail} />
        </>
      ) : null}

      {job.accepted && passengers.length > 0 ? (
        <div className="partner-job-section">
          <h2 className="partner-job-section-title">{copy.jobPassengerSection}</h2>
          <div className="partner-job-passenger-table-wrap">
            <table className="partner-job-passenger-table">
              <thead>
                <tr>
                  <th>{copy.jobPassengerCountry}</th>
                  <th>{copy.jobPassengerIdentity}</th>
                  <th>{copy.jobPassengerFirstName}</th>
                  <th>{copy.jobPassengerLastName}</th>
                  <th>{copy.jobPassengerGender}</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map((passenger) => (
                  <tr key={`${job.id}-${passenger.sequenceNo}`}>
                    <td data-label={copy.jobPassengerCountry}>{display(passenger.countryName)}</td>
                    <td data-label={copy.jobPassengerIdentity}>
                      {partnerPassengerIdentityDisplay(
                        passenger.nationalId,
                        passenger.passportNumber,
                      )}
                    </td>
                    <td data-label={copy.jobPassengerFirstName}>{display(passenger.firstName)}</td>
                    <td data-label={copy.jobPassengerLastName}>{display(passenger.lastName)}</td>
                    <td data-label={copy.jobPassengerGender}>
                      {display(partnerJobGenderLabel(passenger.gender, copy))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {job.accepted && assignment ? (
        <PartnerJobAssignment
          locale={locale}
          copy={copy}
          jobId={job.id}
          isPrimaryPartner={isPrimaryPartner}
          assignment={assignment}
          drivers={drivers}
          vehicles={vehicles}
        />
      ) : null}

      <div className="partner-profile-actions partner-driver-status-actions">
        {!job.accepted ? (
          <button type="button" className="ops-btn-primary" onClick={() => setConfirmOpen(true)}>
            {copy.jobAccept}
          </button>
        ) : null}
        <a className="ops-btn-secondary" href={listHref}>
          {copy.jobClose}
        </a>
      </div>

      <form action={action} id="partner-job-detail-accept" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={job.id} />
      </form>
      {confirmOpen ? (
        <OpsConfirmDialog
          title={copy.jobAcceptConfirm}
          pending={pending}
          cancelLabel={copy.jobClose}
          confirmLabel={pending ? copy.jobAccepting : copy.jobAcceptYes}
          confirmFormId="partner-job-detail-accept"
          confirmTone="positive"
          onClose={() => setConfirmOpen(false)}
        />
      ) : null}
    </section>
  );
}
