import assert from "node:assert/strict";
import { connect, type AddressInfo } from "node:net";
import test from "node:test";
import { encodeAvl, encodeImei, type TeltonikaRecord } from "@/lib/teltonika/codec";
import { encodeCodec12 } from "@/lib/teltonika/codec12";
import { productionListenerCommandAllowed } from "@/lib/teltonika/restart";
import { startTeltonikaServer } from "@/lib/teltonika/server";

const IMEI = "358480086808070";

test("a production socket sends one parameter and then reads it back", async () => {
  const sent: string[] = [];
  const commands = ["setparam 106:0", "getparam 106"];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: productionListenerCommandAllowed,
      pullCommand: async () => {
        const text = commands.shift();
        return text ? { id: `parameter-${sent.length}`, text } : null;
      },
      finishCommand: async (_id, text) => {
        sent.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  try {
    socket.write(encodeImei(IMEI));
    await waitFor(() => Buffer.concat(received).toString("ascii").includes("setparam 106:0"));
    assert.doesNotMatch(Buffer.concat(received).toString("ascii"), /11004|11703|setdigout|setkey|delkey/);
    socket.write(encodeCodec12("New value 106:0", "response"));
    await waitFor(() => sent.length === 1);
    socket.write(encodeAvl({ codec: "codec8", records: [sampleRecord()] }));
    await waitFor(() => Buffer.concat(received).toString("ascii").includes("getparam 106"));
    const wire = Buffer.concat(received).toString("ascii");
    assert.match(wire, /setparam 106:0/);
    assert.match(wire, /getparam 106/);
    assert.equal(wire.split("setparam").length - 1, 1);
    socket.write(encodeCodec12("Param ID:106 Value:0", "response"));
    await waitFor(() => sent.length === 2);
    assert.deepEqual(sent, ["New value 106:0", "Param ID:106 Value:0"]);
  } finally {
    socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("a production socket does not write a second parameter or an inapplicable value", async () => {
  const blocked: string[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: productionListenerCommandAllowed,
      pullCommand: async () => ({ id: "blocked-parameter", text: "setparam 106:0;11004:2.31" }),
      finishCommand: async (_id, text) => {
        blocked.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  try {
    socket.write(encodeImei(IMEI));
    await waitFor(() => blocked.length === 1);
    assert.deepEqual(blocked, ["blocked"]);
    assert.equal(Buffer.concat(received).length, 1);
    assert.doesNotMatch(Buffer.concat(received).toString("ascii"), /setparam|setdigout/);
  } finally {
    socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function sampleRecord(): TeltonikaRecord {
  return {
    timestampMs: Date.parse("2026-11-16T12:00:00.000Z"),
    priority: 0,
    longitude: 29.01,
    latitude: 41.01,
    altitudeM: 10,
    headingDeg: 90,
    satellites: 8,
    speedKmh: 0,
    eventId: 0,
    io: [],
  };
}

function waitFor(ready: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("parameter_apply_timeout"));
    }, 2000);
    const interval = setInterval(() => {
      if (!ready()) return;
      clearTimeout(timer);
      clearInterval(interval);
      resolve();
    }, 10);
  });
}
