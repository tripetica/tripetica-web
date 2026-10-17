import { assertProdTeltonikaListener } from "@/lib/teltonika/listener-guard";
import { TELTONIKA_DEFAULT_PORT } from "@/lib/teltonika/server";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
assertProdTeltonikaListener(process.env);

const host = process.env.TELTONIKA_BIND?.trim() || "0.0.0.0";
const port = Number(process.env.TELTONIKA_PORT ?? TELTONIKA_DEFAULT_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("teltonika_port_invalid");
}

async function main() {
  const { getPool } = await import("@/lib/db/postgres");
  const { authorizeTeltonikaImei, storeTeltonikaPacket } = await import("@/lib/teltonika/store");
  const { claimStarterCommand, finishStarterCommand, timeoutStarterCommand } = await import("@/lib/teltonika/immobilizer-store");
  const { startTeltonikaServer } = await import("@/lib/teltonika/server");
  const identity = await getPool().query<{ database: string }>("SELECT current_database() AS database");
  if (identity.rows[0]?.database !== "tripetica") {
    throw new Error("teltonika_listener_blocked");
  }
  const server = await startTeltonikaServer({
    host,
    port,
    handlers: {
      authorize: authorizeTeltonikaImei,
      store: (imei, packet) => storeTeltonikaPacket(imei, packet),
      pullCommand: async (imei) => {
        const claimed = await claimStarterCommand(imei);
        return claimed ? { id: claimed.id, text: claimed.command_text } : null;
      },
      finishCommand: finishStarterCommand,
      timeoutCommand: timeoutStarterCommand,
    },
  });
  const address = server.address();
  const bound = address && typeof address === "object" ? address.port : port;
  console.log(`Teltonika AVL listener ${host}:${bound} database=tripetica dout=closed`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "teltonika_listener_failed";
  console.error(message);
  process.exit(1);
});
