import { assertExpectedDatabase } from "@/lib/db/database-target";

/** Production AVL listener. Output commands stay closed. */
export function assertProdTeltonikaListener(env: Record<string, string | undefined>) {
  if (env.NODE_ENV !== "production" || env.EXPECTED_DATABASE?.trim() !== "tripetica") {
    throw new Error("teltonika_listener_blocked");
  }
  if (env.TELTONIKA_LISTENER?.trim() !== "approved") {
    throw new Error("teltonika_listener_blocked");
  }
  if (env.TELTONIKA_DOUT_DISPATCH?.trim()) {
    throw new Error("teltonika_dout_dispatch_blocked");
  }
  assertExpectedDatabase(env.DATABASE_URL ?? "", "tripetica");
}
