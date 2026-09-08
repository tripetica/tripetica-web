export type CustomerReservationActor = {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
};

export type CustomerReservationOwnership = {
  customerUserId: string | null;
  customerEmail: string | null;
};

export function accountActorVerificationStatus(
  actor: Pick<CustomerReservationActor, "emailVerifiedAt"> | null,
): "unauthenticated" | "unverified" | "verified" {
  if (!actor) {
    return "unauthenticated";
  }
  return actor.emailVerifiedAt ? "verified" : "unverified";
}

export function customerCanAccessReservation(
  actor: CustomerReservationActor,
  reservation: CustomerReservationOwnership,
) {
  if (accountActorVerificationStatus(actor) !== "verified") {
    return false;
  }
  if (reservation.customerUserId) {
    return reservation.customerUserId === actor.id;
  }
  return (
    reservation.customerEmail?.trim().toLowerCase() ===
    actor.email.trim().toLowerCase()
  );
}

/**
 * Bind the verified customer ID as $1. The actor email is resolved from
 * customer_users, never accepted from a caller as authorization data.
 *
 * Reservation queries using this predicate must alias reservations as `r`.
 */
export const VERIFIED_CUSTOMER_RESERVATION_OWNERSHIP_SQL = `
  EXISTS (
    SELECT 1
    FROM customer_users customer_actor
    WHERE customer_actor.id = $1
      AND customer_actor.is_active = TRUE
      AND customer_actor.email_verified_at IS NOT NULL
      AND (
        r.customer_user_id = customer_actor.id
        OR (
          r.customer_user_id IS NULL
          AND r.customer_email IS NOT NULL
          AND lower(trim(r.customer_email)) = lower(trim(customer_actor.email))
        )
      )
  )
`;
