import "server-only";

import { after } from "next/server";
import { pollDueFlightTracking } from "@/lib/ops/flight-tracking-poll";

export function scheduleFlightTrackingCheck(reservationId: string) {
  try {
    after(async () => {
      try {
        await pollDueFlightTracking({ reservationId });
      } catch (error) {
        console.error("[flight-tracking] check failed", {
          reservationId,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : error,
        });
      }
    });
  } catch {
    // after() is only valid during a Next.js request.
  }
}
