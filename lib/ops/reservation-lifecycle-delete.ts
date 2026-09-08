import "server-only";

import { type PoolClient } from "pg";

/**
 * Shared reservation/process delete lifecycle helpers.
 * Child rows for a targeted reservation/search must not orphan.
 * Never run global cleanup — always scope by explicit IDs.
 */

/** Explicitly remove search-draft passengers for the given process IDs. */
export async function deleteSearchPassengersForIds(
  client: PoolClient,
  searchIds: string[],
) {
  if (searchIds.length === 0) {
    return 0;
  }
  const result = await client.query(
    `DELETE FROM reservation_searches_passengers
     WHERE reservation_search_id = ANY($1::uuid[])`,
    [searchIds],
  );
  return result.rowCount ?? 0;
}

/** Explicitly remove passengers for the given real reservation IDs. */
export async function deleteReservationPassengersForIds(
  client: PoolClient,
  reservationIds: string[],
) {
  if (reservationIds.length === 0) {
    return 0;
  }
  const result = await client.query(
    `DELETE FROM reservations_passengers
     WHERE reservation_id = ANY($1::uuid[])`,
    [reservationIds],
  );
  return result.rowCount ?? 0;
}

/**
 * Remove payment/refund/edit-settlement children for targeted reservations only.
 * Order respects RESTRICT FKs (allocations → batches → settlements → payments).
 */
export async function cleanupReservationFinancialChildrenForIds(
  client: PoolClient,
  reservationIds: string[],
) {
  if (reservationIds.length === 0) {
    return {
      refundAllocations: 0,
      refundBatches: 0,
      editSettlements: 0,
      paymentTransactions: 0,
    };
  }

  const alloc = await client.query(
    `DELETE FROM reservation_refund_allocations
     WHERE reservation_id = ANY($1::uuid[])`,
    [reservationIds],
  );
  const batches = await client.query(
    `DELETE FROM reservation_refund_batches
     WHERE reservation_id = ANY($1::uuid[])`,
    [reservationIds],
  );
  const settlements = await client.query(
    `DELETE FROM reservation_edit_settlements
     WHERE reservation_id = ANY($1::uuid[])`,
    [reservationIds],
  );
  const payments = await client.query(
    `DELETE FROM reservation_payment_transactions
     WHERE reservation_id = ANY($1::uuid[])`,
    [reservationIds],
  );

  return {
    refundAllocations: alloc.rowCount ?? 0,
    refundBatches: batches.rowCount ?? 0,
    editSettlements: settlements.rowCount ?? 0,
    paymentTransactions: payments.rowCount ?? 0,
  };
}

/**
 * Full child cleanup for admin reservation delete (scoped IDs only).
 * Passengers + payment/refund/settlement rows for those reservations.
 */
export async function cleanupReservationChildrenForIds(
  client: PoolClient,
  reservationIds: string[],
) {
  const financial = await cleanupReservationFinancialChildrenForIds(
    client,
    reservationIds,
  );
  const passengers = await deleteReservationPassengersForIds(
    client,
    reservationIds,
  );
  return { ...financial, passengers };
}

/**
 * Temporary process child cleanup before deleting reservation_searches.
 * Order: passengers → edit settlements (RESTRICT) → caller deletes parents.
 */
export async function cleanupProcessChildrenBeforeSearchDelete(
  client: PoolClient,
  searchIds: string[],
) {
  if (searchIds.length === 0) {
    return;
  }
  await deleteSearchPassengersForIds(client, searchIds);
  await client.query(
    `DELETE FROM reservation_edit_settlements
     WHERE edit_draft_id = ANY($1::uuid[])`,
    [searchIds],
  );
}

/** Post-delete orphan checks for targeted IDs (same transaction, before COMMIT). */
export async function assertNoReservationChildOrphans(
  client: PoolClient,
  scope: {
    searchIds?: string[];
    reservationIds?: string[];
  },
) {
  if (scope.searchIds && scope.searchIds.length > 0) {
    const left = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM reservation_searches_passengers
       WHERE reservation_search_id = ANY($1::uuid[])`,
      [scope.searchIds],
    );
    if (Number(left.rows[0]?.n ?? 0) > 0) {
      throw new Error("orphan reservation_searches_passengers remain after delete");
    }
  }
  if (scope.reservationIds && scope.reservationIds.length > 0) {
    const passengers = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM reservations_passengers
       WHERE reservation_id = ANY($1::uuid[])`,
      [scope.reservationIds],
    );
    if (Number(passengers.rows[0]?.n ?? 0) > 0) {
      throw new Error("orphan reservations_passengers remain after delete");
    }
    const payments = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM reservation_payment_transactions
       WHERE reservation_id = ANY($1::uuid[])`,
      [scope.reservationIds],
    );
    if (Number(payments.rows[0]?.n ?? 0) > 0) {
      throw new Error(
        "orphan reservation_payment_transactions remain after delete",
      );
    }
  }
}

/** @deprecated use assertNoReservationChildOrphans */
export async function assertNoPassengerOrphans(
  client: PoolClient,
  scope: {
    searchIds?: string[];
    reservationIds?: string[];
  },
) {
  return assertNoReservationChildOrphans(client, scope);
}
