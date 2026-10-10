export const TELTONIKA_CODEC8 = 0x08;
export const TELTONIKA_CODEC8E = 0x8e;
export const TELTONIKA_MAX_IMEI_LENGTH = 16;
export const TELTONIKA_MAX_DATA_LENGTH = 16 * 1024;
export const TELTONIKA_MAX_RECORDS = 50;

export type TeltonikaIo = {
  id: number;
  value: number | null;
};

export type TeltonikaRecord = {
  timestampMs: number;
  priority: number;
  longitude: number;
  latitude: number;
  altitudeM: number;
  headingDeg: number;
  satellites: number;
  speedKmh: number;
  eventId: number;
  io: TeltonikaIo[];
};

export type TeltonikaPacket = {
  codec: "codec8" | "codec8e";
  records: TeltonikaRecord[];
};

export type TeltonikaFrame<T> =
  | { ok: true; value: T; rest: Buffer }
  | { ok: false; need: number }
  | { ok: false; error: "imei" | "preamble" | "size" | "codec" | "crc" | "count" | "truncated"; consumed?: number };

export function crc16Ibm(data: Uint8Array) {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

export function encodeImei(imei: string) {
  const body = Buffer.from(imei, "ascii");
  const frame = Buffer.alloc(2 + body.length);
  frame.writeUInt16BE(body.length, 0);
  body.copy(frame, 2);
  return frame;
}

export function imeiResponse(accept: boolean) {
  return Buffer.from([accept ? 0x01 : 0x00]);
}

export function encodeAck(count: number) {
  const frame = Buffer.alloc(4);
  frame.writeUInt32BE(count >>> 0, 0);
  return frame;
}

export function parseImeiFrame(buffer: Buffer): TeltonikaFrame<string> {
  if (buffer.length < 2) return { ok: false, need: 2 };
  const length = buffer.readUInt16BE(0);
  if (length < 14 || length > TELTONIKA_MAX_IMEI_LENGTH) return { ok: false, error: "imei" };
  if (buffer.length < 2 + length) return { ok: false, need: 2 + length };
  const imei = buffer.subarray(2, 2 + length).toString("ascii");
  if (!/^[0-9]{14,16}$/.test(imei)) return { ok: false, error: "imei" };
  return { ok: true, value: imei, rest: buffer.subarray(2 + length) };
}

export function parseAvlFrame(buffer: Buffer): TeltonikaFrame<TeltonikaPacket> {
  if (buffer.length < 8) return { ok: false, need: 8 };
  const preamble = buffer.readUInt32BE(0);
  if (preamble !== 0) return { ok: false, error: "preamble" };
  const dataLength = buffer.readUInt32BE(4);
  if (dataLength < 3 || dataLength > TELTONIKA_MAX_DATA_LENGTH) return { ok: false, error: "size" };
  const total = 8 + dataLength + 4;
  if (buffer.length < total) return { ok: false, need: total };
  const data = buffer.subarray(8, 8 + dataLength);
  const expected = crc16Ibm(data);
  const actual = buffer.readUInt32BE(8 + dataLength);
  if (actual !== expected) return { ok: false, error: "crc", consumed: total };
  try {
    const packet = decodeData(data);
    return { ok: true, value: packet, rest: buffer.subarray(total) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "codec" || reason === "count" || reason === "truncated") {
      return { ok: false, error: reason };
    }
    return { ok: false, error: "truncated" };
  }
}

export function encodeAvl(packet: TeltonikaPacket) {
  const data = encodeData(packet);
  const frame = Buffer.alloc(8 + data.length + 4);
  frame.writeUInt32BE(0, 0);
  frame.writeUInt32BE(data.length, 4);
  data.copy(frame, 8);
  frame.writeUInt32BE(crc16Ibm(data), 8 + data.length);
  return frame;
}

function decodeData(data: Buffer): TeltonikaPacket {
  if (data.length < 3) throw new Error("truncated");
  const codecId = data[0];
  const extended = codecId === TELTONIKA_CODEC8E;
  if (codecId !== TELTONIKA_CODEC8 && !extended) throw new Error("codec");
  const count = data[1] ?? 0;
  if (count < 1 || count > TELTONIKA_MAX_RECORDS) throw new Error("count");
  let offset = 2;
  const records: TeltonikaRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const decoded = decodeRecord(data, offset, extended);
    records.push(decoded.record);
    offset = decoded.offset;
  }
  if (offset >= data.length || data[offset] !== count) throw new Error("count");
  if (offset + 1 !== data.length) throw new Error("truncated");
  return { codec: extended ? "codec8e" : "codec8", records };
}

function decodeRecord(data: Buffer, offset: number, extended: boolean) {
  const timestampMs = readBig(data, offset);
  offset += 8;
  const priority = readByte(data, offset);
  offset += 1;
  const longitude = readInt(data, offset) / 10_000_000;
  offset += 4;
  const latitude = readInt(data, offset) / 10_000_000;
  offset += 4;
  const altitudeM = readShort(data, offset);
  offset += 2;
  const headingDeg = readUInt16(data, offset);
  offset += 2;
  const satellites = readByte(data, offset);
  offset += 1;
  const speedKmh = readUInt16(data, offset);
  offset += 2;
  const eventId = extended ? readUInt16(data, offset) : readByte(data, offset);
  offset += extended ? 2 : 1;
  const total = extended ? readUInt16(data, offset) : readByte(data, offset);
  offset += extended ? 2 : 1;
  const io: TeltonikaIo[] = [];
  offset = readFixedIo(data, offset, extended, 1, io);
  offset = readFixedIo(data, offset, extended, 2, io);
  offset = readFixedIo(data, offset, extended, 4, io);
  offset = readFixedIo(data, offset, extended, 8, io);
  if (extended) offset = readVariableIo(data, offset, io);
  if (io.length !== total) throw new Error("count");
  return {
    offset,
    record: {
      timestampMs,
      priority,
      longitude,
      latitude,
      altitudeM,
      headingDeg,
      satellites,
      speedKmh,
      eventId,
      io,
    },
  };
}

function readFixedIo(data: Buffer, offset: number, extended: boolean, width: 1 | 2 | 4 | 8, io: TeltonikaIo[]) {
  const count = extended ? readUInt16(data, offset) : readByte(data, offset);
  offset += extended ? 2 : 1;
  const idWidth = extended ? 2 : 1;
  for (let index = 0; index < count; index += 1) {
    const id = idWidth === 2 ? readUInt16(data, offset) : readByte(data, offset);
    offset += idWidth;
    io.push({ id, value: readWidth(data, offset, width) });
    offset += width;
  }
  return offset;
}

function readVariableIo(data: Buffer, offset: number, io: TeltonikaIo[]) {
  const count = readUInt16(data, offset);
  offset += 2;
  for (let index = 0; index < count; index += 1) {
    const id = readUInt16(data, offset);
    offset += 2;
    const length = readUInt16(data, offset);
    offset += 2;
    if (length > 64 || offset + length > data.length) throw new Error("truncated");
    io.push({ id, value: length > 0 && length <= 6 ? readWidth(data, offset, length) : null });
    offset += length;
  }
  return offset;
}

function encodeData(packet: TeltonikaPacket) {
  const extended = packet.codec === "codec8e";
  const parts: Buffer[] = [Buffer.from([extended ? TELTONIKA_CODEC8E : TELTONIKA_CODEC8, packet.records.length])];
  for (const record of packet.records) parts.push(encodeRecord(record, extended));
  parts.push(Buffer.from([packet.records.length]));
  return Buffer.concat(parts);
}

function encodeRecord(record: TeltonikaRecord, extended: boolean) {
  const grouped = new Map<number, TeltonikaIo[]>();
  const variable: Array<TeltonikaIo & { length: number }> = [];
  for (const item of record.io) {
    const width = ioWidth(item.value);
    if (width === null) {
      variable.push({ ...item, length: 0 });
      continue;
    }
    const list = grouped.get(width) ?? [];
    list.push(item);
    grouped.set(width, list);
  }
  const chunks: Buffer[] = [];
  const head = Buffer.alloc(8 + 1 + 4 + 4 + 2 + 2 + 1 + 2);
  let offset = 0;
  head.writeBigUInt64BE(BigInt(record.timestampMs), offset);
  offset += 8;
  head.writeUInt8(record.priority, offset);
  offset += 1;
  head.writeInt32BE(Math.round(record.longitude * 10_000_000), offset);
  offset += 4;
  head.writeInt32BE(Math.round(record.latitude * 10_000_000), offset);
  offset += 4;
  head.writeInt16BE(record.altitudeM, offset);
  offset += 2;
  head.writeUInt16BE(record.headingDeg, offset);
  offset += 2;
  head.writeUInt8(record.satellites, offset);
  offset += 1;
  head.writeUInt16BE(record.speedKmh, offset);
  chunks.push(head);
  chunks.push(writeCount(extended, record.eventId));
  chunks.push(writeCount(extended, record.io.length));
  for (const width of [1, 2, 4, 8] as const) {
    const items = grouped.get(width) ?? [];
    chunks.push(writeCount(extended, items.length));
    for (const item of items) {
      chunks.push(writeCount(extended, item.id));
      const value = Buffer.alloc(width);
      writeWidth(value, 0, width, item.value ?? 0);
      chunks.push(value);
    }
  }
  if (extended) {
    chunks.push(writeCount(true, variable.length));
    for (const item of variable) {
      chunks.push(writeCount(true, item.id));
      chunks.push(writeCount(true, 0));
    }
  }
  return Buffer.concat(chunks);
}

function ioWidth(value: number | null): 1 | 2 | 4 | 8 | null {
  if (value === null || !Number.isSafeInteger(value) || value < 0) return null;
  if (value <= 0xff) return 1;
  if (value <= 0xffff) return 2;
  if (value <= 0xffffffff) return 4;
  return 8;
}

function writeCount(extended: boolean, value: number) {
  const buffer = Buffer.alloc(extended ? 2 : 1);
  if (extended) buffer.writeUInt16BE(value, 0);
  else buffer.writeUInt8(value, 0);
  return buffer;
}

function readByte(data: Buffer, offset: number) {
  if (offset >= data.length) throw new Error("truncated");
  return data[offset] ?? 0;
}

function readUInt16(data: Buffer, offset: number) {
  if (offset + 2 > data.length) throw new Error("truncated");
  return data.readUInt16BE(offset);
}

function readShort(data: Buffer, offset: number) {
  if (offset + 2 > data.length) throw new Error("truncated");
  return data.readInt16BE(offset);
}

function readInt(data: Buffer, offset: number) {
  if (offset + 4 > data.length) throw new Error("truncated");
  return data.readInt32BE(offset);
}

function readBig(data: Buffer, offset: number) {
  if (offset + 8 > data.length) throw new Error("truncated");
  const value = data.readBigUInt64BE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("truncated");
  return Number(value);
}

function readWidth(data: Buffer, offset: number, width: number) {
  if (offset + width > data.length) throw new Error("truncated");
  if (width === 1) return data[offset] ?? 0;
  if (width === 2) return data.readUInt16BE(offset);
  if (width === 4) return data.readUInt32BE(offset);
  if (width === 8) {
    const value = data.readBigUInt64BE(offset);
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  }
  let numeric = 0;
  for (let index = 0; index < width; index += 1) {
    numeric = numeric * 256 + (data[offset + index] ?? 0);
  }
  return Number.isSafeInteger(numeric) ? numeric : null;
}

function writeWidth(buffer: Buffer, offset: number, width: number, value: number) {
  if (width === 1) buffer.writeUInt8(value, offset);
  else if (width === 2) buffer.writeUInt16BE(value, offset);
  else if (width === 4) buffer.writeUInt32BE(value, offset);
  else buffer.writeBigUInt64BE(BigInt(value), offset);
}
