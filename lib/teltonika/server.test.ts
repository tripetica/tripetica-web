import assert from "node:assert/strict";
import { connect, type AddressInfo, type Socket } from "node:net";
import test from "node:test";
import { teltonikaErrorCode } from "@/lib/teltonika/diagnostics";
import { encodeAvl, encodeImei, type TeltonikaRecord } from "@/lib/teltonika/codec";
import { encodeCodec12, parseCodec12 } from "@/lib/teltonika/codec12";
import { TELTONIKA_GREEN_GETPARAM } from "@/lib/teltonika/config-read";
import { configuratorWireCommandAllowed } from "@/lib/teltonika/config-plan";
import { classifyKeywordReply } from "@/lib/teltonika/keyword";
import { advanceDeviceRestart, devListenerCommandAllowed, productionListenerCommandAllowed, TELTONIKA_CPU_RESET } from "@/lib/teltonika/restart";
import {
  claimTeltonikaSession,
  releaseTeltonikaSession,
  startTeltonikaServer,
} from "@/lib/teltonika/server";

const IMEI = "358480086808070";

test("diagnostics allow only safe SQLSTATE, never error messages", () => {
  assert.equal(teltonikaErrorCode({ code: "23514", message: "private" }), "23514");
  assert.equal(teltonikaErrorCode({ code: "postgres://secret", message: "private" }), "processing_failed");
  assert.equal(teltonikaErrorCode(new Error("private")), "processing_failed");
});

test("failed store sends no ACK; reconnect and resend succeeds once", async () => {
  let fail = true;
  const saved = new Set<number>();
  const server = await startTeltonikaServer({ handlers: {
    authorize: async () => true,
    store: async (_imei, packet) => {
      if (fail) { fail = false; throw Object.assign(new Error("private"), { code: "23514" }); }
      for (const r of packet.records) saved.add(r.timestampMs);
      return { ack: packet.records.length };
    },
  } });
  const port = (server.address() as AddressInfo).port;
  const sockets: Socket[] = [];
  try {
    const first = connect(port, "127.0.0.1"); sockets.push(first); ignoreReset(first);
    const hello = readBytes(first, 1); first.write(encodeImei(IMEI)); await hello;
    let received = 0; first.on("data", (b) => { received += b.length; });
    const closed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("close_timeout")), 2000);
      first.once("close", () => { clearTimeout(timer); resolve(); });
    });
    const packet = encodeAvl({ codec: "codec8e", records: [sampleRecord()] });
    first.write(packet); await closed;
    assert.equal(received, 0);
    const second = connect(port, "127.0.0.1"); sockets.push(second);
    const retryHello = readBytes(second, 1); second.write(encodeImei(IMEI)); await retryHello;
    for (let i = 0; i < 2; i++) {
      const ack = readBytes(second, 4); second.write(packet);
      assert.equal((await ack).readUInt32BE(0), 1);
    }
    assert.equal(saved.size, 1);
  } finally { await stop(server, sockets); }
});

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

test("a late Codec 12 frame does not drop the session and the next AVL record is acknowledged", async () => {
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  ignoreReset(socket);
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  socket.write(encodeImei(IMEI));
  await waitFor(() => Buffer.concat(received).length >= 1);
  socket.write(encodeCodec12("Param ID:11000 Value:0", "response"));
  const ackAt = Buffer.concat(received).length;
  socket.write(encodeAvl({ codec: "codec8", records: [sampleRecord()] }));
  await waitFor(() => Buffer.concat(received).length >= ackAt + 4);
  const ack = Buffer.concat(received).subarray(ackAt, ackAt + 4);
  assert.deepEqual([...ack], [0, 0, 0, 1]);
  assert.equal(socket.destroyed, false);
  await stop(server, [socket]);
});

test("getparam is sent once, its reply is kept, and AVL continues", async () => {
  const replies: string[] = [];
  let pulls = 0;
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      pullCommand: async () => {
        pulls += 1;
        return pulls === 1 ? { id: "read-1", text: TELTONIKA_GREEN_GETPARAM } : null;
      },
      finishCommand: async (_id, text) => {
        replies.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  ignoreReset(socket);
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  socket.write(encodeImei(IMEI));
  await waitFor(() => Buffer.concat(received).length > 20);
  const outbound = Buffer.concat(received);
  assert.equal(outbound[0], 1);
  assert.match(outbound.subarray(1).toString("ascii"), /getparam 11000/);
  assert.doesNotMatch(outbound.toString("ascii"), /setparam|setdigout/);
  socket.write(encodeCodec12("Param ID:11000 Value:0 Param ID:11007 Value:1", "response"));
  await waitFor(() => replies.length === 1);
  const ackAt = Buffer.concat(received).length;
  socket.write(encodeAvl({ codec: "codec8", records: [sampleRecord()] }));
  await waitFor(() => Buffer.concat(received).length >= ackAt + 4);
  assert.deepEqual([...Buffer.concat(received).subarray(ackAt, ackAt + 4)], [0, 0, 0, 1]);
  assert.deepEqual(replies, ["Param ID:11000 Value:0 Param ID:11007 Value:1"]);
  await stop(server, [socket]);
});

test("setparam from the command hook is not written to the device", async () => {
  const replies: string[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      pullCommand: async () => ({ id: "blocked-1", text: "setparam 11000:1" }),
      finishCommand: async (_id, text) => {
        replies.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  ignoreReset(socket);
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  socket.write(encodeImei(IMEI));
  await waitFor(() => replies.length === 1);
  assert.equal(Buffer.concat(received).length, 1);
  assert.equal(Buffer.concat(received)[0], 1);
  assert.deepEqual(replies, ["blocked"]);
  const ackAt = Buffer.concat(received).length;
  socket.write(encodeAvl({ codec: "codec8", records: [sampleRecord()] }));
  await waitFor(() => Buffer.concat(received).length >= ackAt + 4);
  assert.equal(socket.destroyed, false);
  await stop(server, [socket]);
});

test("the DEV command checker can exchange one catalog read on a local socket", async () => {
  const replies: string[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: configuratorWireCommandAllowed,
      pullCommand: async () => ({ id: "dev-read", text: "getparam 2004;2005" }),
      finishCommand: async (_id, text) => {
        replies.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  ignoreReset(socket);
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  socket.write(encodeImei(IMEI));
  await waitFor(() => Buffer.concat(received).toString("ascii").includes("getparam 2004;2005"));
  assert.doesNotMatch(Buffer.concat(received).toString("ascii"), /setdigout|setparam/);
  socket.write(encodeCodec12("Param ID:2004 Value:cfg-test.invalid;2005:9", "response"));
  await waitFor(() => replies.length === 1);
  assert.deepEqual(replies, ["Param ID:2004 Value:cfg-test.invalid;2005:9"]);
  await stop(server, [socket]);
});

test("cpureset reaches only the addressed socket, and a missing reply is not success", async () => {
  const other = "350000000000001";
  const events: string[] = [];
  let phase = "preparing";
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: devListenerCommandAllowed,
      pullCommand: async (imei) => {
        if (imei !== IMEI || phase !== "preparing") return null;
        phase = "armed";
        return { id: "restart-1", text: TELTONIKA_CPU_RESET };
      },
      commandSent: async () => {
        phase = advanceDeviceRestart({ phase: "armed", event: "written" }).phase;
        events.push("written");
      },
      commandClosed: async () => {
        phase = advanceDeviceRestart({ phase: "sent", event: "closed" }).phase;
        events.push("closed");
      },
      finishCommand: async (_id, text) => {
        phase = advanceDeviceRestart({ phase: "sent", event: "reply", reply: text }).phase;
        events.push(`reply:${text}`);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const stranger = connect(port, "127.0.0.1");
  ignoreReset(stranger);
  const strangerBytes: Buffer[] = [];
  stranger.on("data", (chunk) => strangerBytes.push(chunk));
  stranger.write(encodeImei(other));
  await waitFor(() => Buffer.concat(strangerBytes).length >= 1);
  const target = connect(port, "127.0.0.1");
  ignoreReset(target);
  const targetBytes: Buffer[] = [];
  target.on("data", (chunk) => targetBytes.push(chunk));
  target.write(encodeImei(IMEI));
  await waitFor(() => events.includes("written"));
  const outbound = Buffer.concat(targetBytes);
  const parsed = parseCodec12(outbound.subarray(1));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.text, "cpureset");
  assert.doesNotMatch(Buffer.concat(strangerBytes).toString("ascii"), /cpureset/);
  target.destroy();
  await waitFor(() => events.includes("closed"));
  assert.equal(phase, "waiting_reconnect");
  const returned = advanceDeviceRestart({ phase: "waiting_reconnect", event: "reconnected" });
  assert.equal(returned.phase, "unverified");
  await stop(server, [stranger, target]);
});

test("production cpureset reaches only the addressed socket", async () => {
  const other = "350000000000001";
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: productionListenerCommandAllowed,
      pullCommand: async (imei) => imei === IMEI ? { id: "prod-reset", text: TELTONIKA_CPU_RESET } : { id: "prod-write", text: "setparam 11703:2" },
      finishCommand: async () => undefined,
    },
  });
  const port = (server.address() as AddressInfo).port;
  const stranger = connect(port, "127.0.0.1");
  ignoreReset(stranger);
  const strangerBytes: Buffer[] = [];
  stranger.on("data", (chunk) => strangerBytes.push(chunk));
  stranger.write(encodeImei(other));
  await waitFor(() => Buffer.concat(strangerBytes).length >= 1);
  const target = connect(port, "127.0.0.1");
  ignoreReset(target);
  const targetBytes: Buffer[] = [];
  target.on("data", (chunk) => targetBytes.push(chunk));
  target.write(encodeImei(IMEI));
  await waitFor(() => Buffer.concat(targetBytes).toString("ascii").includes("cpureset"));
  assert.doesNotMatch(Buffer.concat(strangerBytes).toString("ascii"), /cpureset|setparam|setkey|delkey/);
  const parsed = parseCodec12(Buffer.concat(targetBytes).subarray(1));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.text, "cpureset");
  await stop(server, [stranger, target]);
});

test("the production command checker does not write cpureset", async () => {
  const replies: string[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      pullCommand: async () => ({ id: "reset-blocked", text: TELTONIKA_CPU_RESET }),
      finishCommand: async (_id, text) => {
        replies.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  ignoreReset(socket);
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  socket.write(encodeImei(IMEI));
  await waitFor(() => replies.length === 1);
  assert.deepEqual(replies, ["blocked"]);
  assert.equal(Buffer.concat(received).length, 1);
  assert.doesNotMatch(Buffer.concat(received).toString("ascii"), /cpureset/);
  await stop(server, [socket]);
});

test("an error reply to cpureset is a failure, not a verified restart", async () => {
  const replies: string[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: devListenerCommandAllowed,
      pullCommand: async () => ({ id: "reset-error", text: TELTONIKA_CPU_RESET }),
      finishCommand: async (_id, text) => {
        replies.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const socket = connect(port, "127.0.0.1");
  ignoreReset(socket);
  const received: Buffer[] = [];
  socket.on("data", (chunk) => received.push(chunk));
  socket.write(encodeImei(IMEI));
  await waitFor(() => Buffer.concat(received).toString("ascii").includes("cpureset"));
  socket.write(encodeCodec12("ERR:Ignored", "response"));
  await waitFor(() => replies.length === 1);
  const outcome = advanceDeviceRestart({ phase: "sent", event: "reply", reply: replies[0] });
  assert.equal(outcome.phase, "failed");
  assert.equal(outcome.error, "rejected");
  await stop(server, [socket]);
});

test("setkey and delkey stay on the selected socket and their replies do not keep the keyword", async () => {
  const other = "350000000000001";
  const sample = "Kw12test";
  const replies: string[] = [];
  const commands = [`setkey  ${sample}`, `delkey ${sample}`];
  let index = 0;
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      commandAllowed: devListenerCommandAllowed,
      pullCommand: async (imei) => {
        if (imei !== IMEI || index >= commands.length) return null;
        const text = commands[index];
        index += 1;
        return { id: `keyword-${index}`, text: text ?? "" };
      },
      finishCommand: async (_id, text) => {
        replies.push(text);
      },
    },
  });
  const port = (server.address() as AddressInfo).port;
  const stranger = connect(port, "127.0.0.1");
  const target = connect(port, "127.0.0.1");
  try {
    ignoreReset(stranger);
    const strangerBytes: Buffer[] = [];
    stranger.on("data", (chunk) => strangerBytes.push(chunk));
    stranger.write(encodeImei(other));
    await waitFor(() => Buffer.concat(strangerBytes).length >= 1);
    ignoreReset(target);
    const targetBytes: Buffer[] = [];
    target.on("data", (chunk) => targetBytes.push(chunk));
    target.write(encodeImei(IMEI));
    await waitFor(() => Buffer.concat(targetBytes).toString("ascii").includes(`setkey  ${sample}`));
    assert.doesNotMatch(Buffer.concat(strangerBytes).toString("ascii"), /setkey|delkey/);
    target.write(encodeCodec12(`Keyword saved: ${sample}`, "response"));
    await waitFor(() => replies.length === 1);
    const saved = classifyKeywordReply(replies[0] ?? "");
    assert.equal(JSON.stringify(saved).includes(sample), false);
    assert.equal(saved.phase, "accepted");
    target.destroy();
    const removal = connect(port, "127.0.0.1");
    try {
      ignoreReset(removal);
      const removalBytes: Buffer[] = [];
      removal.on("data", (chunk) => removalBytes.push(chunk));
      removal.write(encodeImei(IMEI));
      await waitFor(() => Buffer.concat(removalBytes).toString("ascii").includes(`delkey ${sample}`));
      assert.doesNotMatch(Buffer.concat(strangerBytes).toString("ascii"), /delkey/);
      removal.write(encodeCodec12("Error:Wrong old keyword", "response"));
      await waitFor(() => replies.length === 2);
      assert.equal(classifyKeywordReply(replies[1] ?? "").error, "wrong_old");
      assert.equal(JSON.stringify(classifyKeywordReply(replies[1] ?? "")).includes(sample), false);
    } finally {
      removal.destroy();
    }
  } finally {
    await stop(server, [stranger, target]);
  }
  const blocked: string[] = [];
  const production = await startTeltonikaServer({
    handlers: {
      authorize: async () => true,
      store: async () => ({ ack: 1 }),
      pullCommand: async () => ({ id: "keyword-blocked", text: `setkey  ${sample}` }),
      finishCommand: async (_id, text) => {
        blocked.push(text);
      },
    },
  });
  const productionPort = (production.address() as AddressInfo).port;
  const productionSocket = connect(productionPort, "127.0.0.1");
  try {
    ignoreReset(productionSocket);
    const productionBytes: Buffer[] = [];
    productionSocket.on("data", (chunk) => productionBytes.push(chunk));
    productionSocket.write(encodeImei(IMEI));
    await waitFor(() => blocked.length === 1);
    assert.deepEqual(blocked, ["blocked"]);
    assert.doesNotMatch(Buffer.concat(productionBytes).toString("ascii"), /setkey|delkey/);
  } finally {
    await stop(production, [productionSocket]);
  }
});

function waitFor(ready: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("read_timeout"));
    }, 2000);
    const interval = setInterval(() => {
      if (!ready()) return;
      clearTimeout(timer);
      clearInterval(interval);
      resolve();
    }, 10);
  });
}
