import { loadDevelopmentEnv } from "./load-env";
import { getPool } from "@/lib/db/postgres";
import { authorizeTeltonikaImei, storeTeltonikaPacket } from "@/lib/teltonika/store";
import { startTeltonikaServer, TELTONIKA_DEFAULT_PORT } from "@/lib/teltonika/server";

loadDevelopmentEnv();

const expected = process.env.EXPECTED_DATABASE?.trim();
if (process.env.NODE_ENV === "production" || expected === "tripetica") {
  throw new Error("teltonika_listener_blocked");
}
if (expected !== "tripetica_dev") {
  throw new Error("teltonika_listener_blocked");
}

const host = process.env.TELTONIKA_BIND?.trim() || "127.0.0.1";
const port = Number(process.env.TELTONIKA_PORT ?? TELTONIKA_DEFAULT_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("teltonika_port_invalid");
}

async function main() {
  const identity = await getPool().query<{ database: string }>("SELECT current_database() AS database");
  if (identity.rows[0]?.database !== "tripetica_dev") {
    throw new Error("teltonika_listener_blocked");
  }
  const server = await startTeltonikaServer({
    host,
    port,
    handlers: {
      authorize: authorizeTeltonikaImei,
      store: (imei, packet) => storeTeltonikaPacket(imei, packet),
    },
  });
  const address = server.address();
  const bound = address && typeof address === "object" ? address.port : port;
  console.log(`Teltonika AVL listener ${host}:${bound} database=tripetica_dev`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "teltonika_listener_failed";
  console.error(message);
  process.exit(1);
});
