import assert from "node:assert/strict";
import { connect, type AddressInfo, type Socket } from "node:net";
import test from "node:test";
import { encodeAvl, encodeImei, type TeltonikaRecord } from "@/lib/teltonika/codec";
import {
  claimTeltonikaSession,
  releaseTeltonikaSession,
  startTeltonikaServer,
} from "@/lib/teltonika/server";

const IMEI = "358480086808070";

function sampleRecord(): TeltonikaRecord {
  return {
    timestampMs: Date.parse("2026-11-08T16:20:00.000Z"),
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

function readBytes(socket: Socket, bytes: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("read_timeout")), 2000);
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length >= bytes) {
        cleanup();
        resolve(Buffer.concat(chunks));
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function ignoreReset(socket: Socket) {
  socket.on("error", () => {});
}

async function stop(server: { close: (callback: () => void) => void }, sockets: Socket[]) {
  for (const socket of sockets) {
    ignoreReset(socket);
    socket.destroy();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("a closed socket cannot claim an IMEI and release is idempotent", () => {
  const sessions = new Map<string, { destroyed: boolean }>();
  const closed = { destroyed: true };
  assert.deepEqual(claimTeltonikaSession(sessions, IMEI, closed), { status: "closed", previous: null });
  assert.equal(sessions.size, 0);
  releaseTeltonikaSession(sessions, IMEI, closed);
  releaseTeltonikaSession(sessions, "", closed);
  assert.equal(sessions.size, 0);
});

test("a new socket replaces a ghost session and the old close does not remove it", () => {
  const sessions = new Map<string, { destroyed: boolean }>();
  const older = { destroyed: false };
  const newer = { destroyed: false };
  assert.deepEqual(claimTeltonikaSession(sessions, IMEI, older), { status: "claimed", previous: null });
  const replaced = claimTeltonikaSession(sessions, IMEI, newer);
  assert.deepEqual(replaced, { status: "claimed", previous: older });
  assert.equal(sessions.get(IMEI), newer);
  releaseTeltonikaSession(sessions, IMEI, older);
  releaseTeltonikaSession(sessions, IMEI, older);
  assert.equal(sessions.get(IMEI), newer);
  releaseTeltonikaSession(sessions, IMEI, newer);
  assert.equal(sessions.has(IMEI), false);
  releaseTeltonikaSession(sessions, IMEI, newer);
  assert.equal(sessions.has(IMEI), false);
});

test("a socket that closes during IMEI authorization does not keep the lock", async () => {
  let releaseAuth = () => {};
  let markStarted = () => {};
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    releaseAuth = resolve;
  });
  const stored: number[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => {
        markStarted();
        await gate;
        return true;
      },
      store: async (_imei, packet) => {
        stored.push(packet.records.length);
        return { ack: packet.records.length };
      },
    },
  });
  const address = server.address() as AddressInfo;
  const first = connect(address.port, "127.0.0.1");
  ignoreReset(first);
  first.write(encodeImei(IMEI));
  await started;
  first.destroy();
  await new Promise((resolve) => setTimeout(resolve, 40));
  releaseAuth();
  await new Promise((resolve) => setTimeout(resolve, 40));
  const second = connect(address.port, "127.0.0.1");
  const greeting = readBytes(second, 1);
  second.write(encodeImei(IMEI));
  const accepted = await greeting;
  assert.equal(accepted[0], 1);
  const packet = encodeAvl({ codec: "codec8", records: [sampleRecord()] });
  const ackPromise = readBytes(second, 4);
  second.write(packet);
  const ack = await ackPromise;
  assert.deepEqual([...ack], [0, 0, 0, 1]);
  assert.deepEqual(stored, [1]);
  ignoreReset(second);
  const third = connect(address.port, "127.0.0.1");
  const deniedPromise = readBytes(third, 1);
  third.write(encodeImei(IMEI));
  const replaced = await deniedPromise;
  assert.equal(replaced[0], 1);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("replaced_socket_open")), 2000);
    if (second.closed) {
      clearTimeout(timer);
      resolve();
      return;
    }
    second.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  await stop(server, [first, second, third]);
});

test("timeout and connection errors release the IMEI for the next device", async () => {
  const server = await startTeltonikaServer({
    idleMs: 40,
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
    },
  });
  const address = server.address() as AddressInfo;
  const timed = connect(address.port, "127.0.0.1");
  ignoreReset(timed);
  const firstByte = readBytes(timed, 1);
  timed.write(encodeImei(IMEI));
  assert.equal((await firstByte)[0], 1);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout_close")), 2000);
    timed.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const afterTimeout = connect(address.port, "127.0.0.1");
  ignoreReset(afterTimeout);
  const timeoutRetry = readBytes(afterTimeout, 1);
  afterTimeout.write(encodeImei(IMEI));
  assert.equal((await timeoutRetry)[0], 1);
  afterTimeout.destroy();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const afterError = connect(address.port, "127.0.0.1");
  const errorRetry = readBytes(afterError, 1);
  afterError.write(encodeImei(IMEI));
  assert.equal((await errorRetry)[0], 1);
  await stop(server, [timed, afterTimeout, afterError]);
});

test("a second live socket for the same IMEI replaces the first", async () => {
  let entered = 0;
  let releaseBoth = () => {};
  const bothWaiting = new Promise<void>((resolve) => {
    releaseBoth = resolve;
  });
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => {
        entered += 1;
        if (entered === 2) releaseBoth();
        await bothWaiting;
        return true;
      },
      store: async () => ({ ack: 0 }),
    },
  });
  const address = server.address() as AddressInfo;
  const first = connect(address.port, "127.0.0.1");
  const second = connect(address.port, "127.0.0.1");
  ignoreReset(first);
  ignoreReset(second);
  const firstReply = readBytes(first, 1);
  const secondReply = readBytes(second, 1);
  first.write(encodeImei(IMEI));
  second.write(encodeImei(IMEI));
  await bothWaiting;
  assert.equal((await firstReply)[0], 1);
  assert.equal((await secondReply)[0], 1);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("first_socket_open")), 2000);
    if (first.closed) {
      clearTimeout(timer);
      resolve();
      return;
    }
    first.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const third = connect(address.port, "127.0.0.1");
  const thirdReply = readBytes(third, 1);
  third.write(encodeImei(IMEI));
  assert.equal((await thirdReply)[0], 1);
  await stop(server, [first, second, third]);
});
