import { createServer, type Server, type Socket } from "node:net";
import {
  encodeAck,
  imeiResponse,
  parseAvlFrame,
  parseImeiFrame,
  type TeltonikaPacket,
} from "@/lib/teltonika/codec";
import { encodeCodec12, parseCodec12, TELTONIKA_CODEC12 } from "@/lib/teltonika/codec12";
import { IMMOBILIZER_COMMAND_TIMEOUT_MS } from "@/lib/teltonika/immobilizer";

export const TELTONIKA_DEFAULT_PORT = 5027;
export const TELTONIKA_MAX_CONNECTIONS = 32;
export const TELTONIKA_IDLE_MS = 120_000;
export const TELTONIKA_MAX_BUFFER = 32 * 1024;

export type TeltonikaStoreResult = {
  ack: number;
};

export type TeltonikaHandlers = {
  authorize(imei: string): Promise<boolean>;
  store(imei: string, packet: TeltonikaPacket): Promise<TeltonikaStoreResult>;
  pullCommand?(imei: string): Promise<{ id: string; text: string } | null>;
  finishCommand?(commandId: string, responseText: string): Promise<void>;
  timeoutCommand?(commandId: string): Promise<void>;
};

export function startTeltonikaServer(input: {
  host?: string;
  port?: number;
  maxConnections?: number;
  handlers: TeltonikaHandlers;
}) {
  const host = input.host ?? "127.0.0.1";
  const maxConnections = input.maxConnections ?? TELTONIKA_MAX_CONNECTIONS;
  const claimed = new Set<string>();
  let open = 0;
  const server = createServer((socket) => {
    if (open >= maxConnections) {
      socket.destroy();
      return;
    }
    open += 1;
    attachSocket(socket, input.handlers, claimed, () => {
      open = Math.max(0, open - 1);
    });
  });
  return new Promise<Server>((resolve) => {
    server.listen(input.port ?? 0, host, () => resolve(server));
  });
}

function attachSocket(
  socket: Socket,
  handlers: TeltonikaHandlers,
  claimed: Set<string>,
  onClose: () => void,
) {
  let buffer = Buffer.alloc(0);
  let phase: "imei" | "avl" = "imei";
  let imei = "";
  let reading = false;
  let awaiting: { id: string } | null = null;
  let commandTimer: ReturnType<typeof setTimeout> | null = null;
  const pending: Buffer[] = [];
  socket.setTimeout(TELTONIKA_IDLE_MS);
  const release = () => {
    if (imei) claimed.delete(imei);
    socket.removeListener("close", release);
  };
  socket.on("timeout", () => socket.destroy());
  socket.on("error", () => socket.destroy());
  socket.on("close", () => {
    release();
    onClose();
  });
  socket.on("data", (chunk) => {
    pending.push(chunk);
    if (reading) return;
    reading = true;
    void pump();
  });

  async function pump() {
    while (pending.length > 0 || buffer.length > 0) {
      if (pending.length > 0) {
        buffer = Buffer.concat([buffer, ...pending.splice(0)]);
      }
      if (buffer.length > TELTONIKA_MAX_BUFFER) {
        socket.destroy();
        return;
      }
      if (phase === "imei") {
        const frame = parseImeiFrame(buffer);
        if ("need" in frame) break;
        if (!frame.ok) {
          socket.destroy();
          return;
        }
        buffer = Buffer.from(frame.rest);
        let allowed = false;
        try {
          allowed = await handlers.authorize(frame.value);
        } catch {
          socket.destroy();
          return;
        }
        if (!allowed || claimed.has(frame.value)) {
          socket.write(imeiResponse(false));
          socket.end();
          return;
        }
        claimed.add(frame.value);
        imei = frame.value;
        phase = "avl";
        socket.write(imeiResponse(true));
        await offerCommand();
        continue;
      }
      if (
        awaiting
        && buffer.length >= 9
        && buffer.readUInt32BE(0) === 0
        && buffer[8] === TELTONIKA_CODEC12
      ) {
        const response = parseCodec12(buffer);
        if ("need" in response) break;
        if (!response.ok) {
          socket.destroy();
          return;
        }
        buffer = Buffer.from(response.rest);
        const commandId = awaiting.id;
        awaiting = null;
        clearCommandTimer();
        try {
          await handlers.finishCommand?.(commandId, response.value.text);
        } catch {
          socket.destroy();
          return;
        }
        continue;
      }
      const frame = parseAvlFrame(buffer);
      if ("need" in frame) break;
      if (!frame.ok) {
        if (frame.error === "crc" && frame.consumed) {
          buffer = Buffer.from(buffer.subarray(frame.consumed));
          socket.write(encodeAck(0));
          continue;
        }
        socket.destroy();
        return;
      }
      buffer = Buffer.from(frame.rest);
      let stored: TeltonikaStoreResult;
      try {
        stored = await handlers.store(imei, frame.value);
      } catch {
        socket.destroy();
        return;
      }
      socket.write(encodeAck(stored.ack));
      await offerCommand();
    }
    reading = false;
    if (pending.length > 0) {
      reading = true;
      void pump();
    }
  }

  function clearCommandTimer() {
    if (commandTimer) clearTimeout(commandTimer);
    commandTimer = null;
  }

  async function offerCommand() {
    if (awaiting || !imei || !handlers.pullCommand) return;
    let command: { id: string; text: string } | null = null;
    try {
      command = await handlers.pullCommand(imei);
    } catch {
      return;
    }
    if (!command) return;
    awaiting = { id: command.id };
    socket.write(encodeCodec12(command.text));
    commandTimer = setTimeout(() => {
      const commandId = awaiting?.id;
      awaiting = null;
      commandTimer = null;
      if (commandId) void handlers.timeoutCommand?.(commandId);
    }, IMMOBILIZER_COMMAND_TIMEOUT_MS);
  }
}
