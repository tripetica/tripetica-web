import { crc16Ibm } from "@/lib/teltonika/codec";

export const TELTONIKA_CODEC12 = 0x0c;
export const TELTONIKA_CODEC12_COMMAND = 0x05;
export const TELTONIKA_CODEC12_RESPONSE = 0x06;
export const TELTONIKA_DOUT1_AVL_ID = 179;

export type Codec12Message = {
  kind: "command" | "response";
  text: string;
};

export function encodeCodec12(text: string, kind: "command" | "response" = "command") {
  const payload = Buffer.from(text, "ascii");
  if (payload.length < 1 || payload.length > 512) {
    throw new Error("codec12_size");
  }
  const data = Buffer.alloc(1 + 1 + 1 + 4 + payload.length + 1);
  let offset = 0;
  data[offset] = TELTONIKA_CODEC12;
  offset += 1;
  data[offset] = 1;
  offset += 1;
  data[offset] = kind === "response" ? TELTONIKA_CODEC12_RESPONSE : TELTONIKA_CODEC12_COMMAND;
  offset += 1;
  data.writeUInt32BE(payload.length, offset);
  offset += 4;
  payload.copy(data, offset);
  offset += payload.length;
  data[offset] = 1;
  const frame = Buffer.alloc(8 + data.length + 4);
  frame.writeUInt32BE(0, 0);
  frame.writeUInt32BE(data.length, 4);
  data.copy(frame, 8);
  frame.writeUInt32BE(crc16Ibm(data), 8 + data.length);
  return frame;
}

export function parseCodec12(buffer: Buffer):
  | { ok: true; value: Codec12Message; rest: Buffer }
  | { ok: false; need: number }
  | { ok: false; error: "preamble" | "size" | "codec" | "crc" | "type" | "count"; consumed?: number } {
  if (buffer.length < 8) return { ok: false, need: 8 };
  if (buffer.readUInt32BE(0) !== 0) return { ok: false, error: "preamble" };
  const dataLength = buffer.readUInt32BE(4);
  if (dataLength < 8 || dataLength > 1024) return { ok: false, error: "size" };
  const total = 8 + dataLength + 4;
  if (buffer.length < total) return { ok: false, need: total };
  const data = buffer.subarray(8, 8 + dataLength);
  if (buffer.readUInt32BE(8 + dataLength) !== crc16Ibm(data)) {
    return { ok: false, error: "crc", consumed: total };
  }
  if (data[0] !== TELTONIKA_CODEC12) return { ok: false, error: "codec", consumed: total };
  const type = data[2];
  if (type !== TELTONIKA_CODEC12_COMMAND && type !== TELTONIKA_CODEC12_RESPONSE) {
    return { ok: false, error: "type", consumed: total };
  }
  const size = data.readUInt32BE(3);
  if (8 + size !== data.length) return { ok: false, error: "count", consumed: total };
  if (data[1] !== data[7 + size]) return { ok: false, error: "count", consumed: total };
  return {
    ok: true,
    value: {
      kind: type === TELTONIKA_CODEC12_RESPONSE ? "response" : "command",
      text: data.subarray(7, 7 + size).toString("ascii"),
    },
    rest: buffer.subarray(total),
  };
}

export function parseGetio(text: string) {
  const match = text.match(/(?:^|\s)DO1:([01])(?=\s|$)/);
  if (!match) return { dout1: null as "on" | "off" | null };
  return { dout1: match[1] === "1" ? "on" as const : "off" as const };
}

export function parseSetdigoutReply(text: string) {
  if (/DOUT1:IGNORED|does not exist|disabled from CFG|not available|Bad Syntax|ERR:/i.test(text)) {
    return { accepted: false, dout1: null as "on" | "off" | null, queued: false };
  }
  const queued = /QUEUED/i.test(text);
  const on = /DOUT1:(?:ON|1)\b/i.test(text);
  const off = /DOUT1:(?:OFF|0)\b/i.test(text) || /Already set to 0/i.test(text);
  const alreadyOn = /Already set to 1/i.test(text);
  return {
    accepted: (on || off || alreadyOn) && !queued,
    dout1: on || alreadyOn ? "on" as const : off ? "off" as const : null,
    queued,
  };
}
