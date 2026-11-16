import { configuratorWireCommandAllowed, parameterApplyCommandAllowed, productionConfiguratorGetparamAllowed } from "@/lib/teltonika/config-plan";
import { teltonikaWireCommandAllowed } from "@/lib/teltonika/config-read";
import { keywordCommandAllowed } from "@/lib/teltonika/keyword";

/** FMB920 GPRS restart. Codec 12 command, no documented response. */
export const TELTONIKA_CPU_RESET = "cpureset";

export type RestartPhase =
  | "no_link"
  | "preparing"
  | "armed"
  | "sent"
  | "waiting_reconnect"
  | "verified"
  | "unverified"
  | "failed";

/** DEV listener commands. Keyword and configurator writes stay on this listener. */
export function devListenerCommandAllowed(text: string) {
  return text === TELTONIKA_CPU_RESET || keywordCommandAllowed(text) || configuratorWireCommandAllowed(text);
}

/** Production may restart one device, read parameters, and send one explicit catalog parameter. Bulk writes, setkey, and delkey stay closed. */
export function productionListenerCommandAllowed(text: string) {
  return text === TELTONIKA_CPU_RESET || teltonikaWireCommandAllowed(text) || productionConfiguratorGetparamAllowed(text) || parameterApplyCommandAllowed(text);
}

export function deviceRestartAllowed(database: string) {
  return database === "tripetica" || database === "tripetica_dev";
}

/**
 * cpureset has no success reply. A later connection is recorded and is not treated as proof.
 * The verified phase is never produced by this command.
 */
export function advanceDeviceRestart(input: {
  phase: RestartPhase;
  event: "written" | "closed" | "reconnected" | "reply" | "timeout" | "blocked";
  reply?: string;
}): { phase: RestartPhase; error: string | null } {
  if (input.event === "blocked") return { phase: "failed", error: "blocked" };
  if (input.event === "written" && (input.phase === "preparing" || input.phase === "armed")) {
    return { phase: "sent", error: null };
  }
  if (input.event === "closed" && input.phase === "sent") {
    return { phase: "waiting_reconnect", error: null };
  }
  if (input.event === "reconnected" && (input.phase === "sent" || input.phase === "waiting_reconnect")) {
    return { phase: "unverified", error: "reconnect_observed" };
  }
  if (input.event === "timeout" && input.phase === "sent") {
    return { phase: "unverified", error: "no_reply" };
  }
  if (input.event === "reply" && (input.phase === "sent" || input.phase === "armed" || input.phase === "waiting_reconnect")) {
    const reply = input.reply?.trim() ?? "";
    if (/ERR:|Bad Syntax|ERROR|Invalid|ignored|not found|Unknown/i.test(reply)) {
      return { phase: "failed", error: "rejected" };
    }
    return { phase: "unverified", error: reply ? "unexpected_reply" : "empty_reply" };
  }
  return { phase: input.phase, error: null };
}
