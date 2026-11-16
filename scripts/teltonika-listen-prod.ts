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
  const { advanceTeltonikaConfigRead, claimTeltonikaConfigRead, finishTeltonikaConfigRead, timeoutTeltonikaConfigRead } = await import("@/lib/teltonika/config-read-store");
  const { teltonikaWireCommandAllowed } = await import("@/lib/teltonika/config-read");
  const { parameterApplyCommandAllowed, productionConfiguratorGetparamAllowed } = await import("@/lib/teltonika/config-plan");
  const { productionListenerCommandAllowed, TELTONIKA_CPU_RESET } = await import("@/lib/teltonika/restart");
  const {
    claimDeviceRestart,
    finishDeviceRestart,
    markDeviceRestartClosed,
    markDeviceRestartSent,
    noteDeviceSession,
    timeoutDeviceRestart,
  } = await import("@/lib/gps/device-restart");
  const {
    claimProductionConfiguratorRead,
    finishProductionConfiguratorRead,
    timeoutProductionConfiguratorRead,
  } = await import("@/lib/gps/production-config-read");
  const {
    claimParameterApply,
    finishParameterApply,
    timeoutParameterApply,
  } = await import("@/lib/gps/parameter-apply");
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
      commandAllowed: productionListenerCommandAllowed,
      pullCommand: async (imei) => {
        const claimed = await claimStarterCommand(imei);
        if (claimed) return { id: claimed.id, text: claimed.command_text };
        const read = await claimTeltonikaConfigRead(imei);
        if (read && teltonikaWireCommandAllowed(read.command_text)) return { id: read.id, text: read.command_text };
        const parameter = await claimParameterApply(imei);
        if (parameter && parameterApplyCommandAllowed(parameter.text)) return parameter;
        const configRead = await claimProductionConfiguratorRead(imei);
        if (configRead && productionConfiguratorGetparamAllowed(configRead.text)) return configRead;
        const restart = await claimDeviceRestart(imei);
        if (restart?.text === TELTONIKA_CPU_RESET) return restart;
        return null;
      },
      finishCommand: async (commandId, responseText) => {
        if (responseText === "blocked") {
          if (await finishDeviceRestart(commandId, "blocked")) return;
          await timeoutStarterCommand(commandId);
          await timeoutTeltonikaConfigRead(commandId);
          if (await finishParameterApply(commandId, "blocked")) return;
          await timeoutProductionConfiguratorRead(commandId);
          return;
        }
        if (await finishDeviceRestart(commandId, responseText)) return;
        await finishStarterCommand(commandId, responseText);
        await finishTeltonikaConfigRead(commandId, responseText);
        if (await finishParameterApply(commandId, responseText)) return;
        await finishProductionConfiguratorRead(commandId, responseText);
        try {
          await advanceTeltonikaConfigRead(commandId);
        } catch {
          return;
        }
      },
      timeoutCommand: async (commandId) => {
        if (await timeoutDeviceRestart(commandId)) return;
        await timeoutStarterCommand(commandId);
        await timeoutTeltonikaConfigRead(commandId);
        if (await timeoutParameterApply(commandId)) return;
        await timeoutProductionConfiguratorRead(commandId);
      },
      commandSent: async (commandId) => {
        await markDeviceRestartSent(commandId);
      },
      commandClosed: async (commandId) => {
        await markDeviceRestartClosed(commandId);
      },
      sessionOpened: async (imei) => {
        await noteDeviceSession(imei, "open");
      },
      sessionClosed: async (imei) => {
        await noteDeviceSession(imei, "close");
      },
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
