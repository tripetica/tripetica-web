import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";

export const VEHICLE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const STORED_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9_]{1,40}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|heic)$/;
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export type SniffedDocument = {
  ext: "pdf" | "jpg" | "png" | "heic";
  mime: "application/pdf" | "image/jpeg" | "image/png" | "image/heic";
};

export function vehicleDocumentRoot() {
  const configured = process.env.VEHICLE_DOCUMENT_DIR?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return "/var/lib/tripetica-prod/vehicle-documents";
  return "/var/lib/tripetica-dev/vehicle-documents";
}

export function sniffVehicleDocument(bytes: Uint8Array): SniffedDocument | null {
  if (bytes.length < 12 || bytes.length > VEHICLE_DOCUMENT_MAX_BYTES) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { ext: "pdf", mime: "application/pdf" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  const box = Buffer.from(bytes.subarray(4, 12)).toString("latin1");
  if (box.startsWith("ftyp") && HEIC_BRANDS.has(box.slice(4, 8))) {
    return { ext: "heic", mime: "image/heic" };
  }
  return null;
}

export function vehicleDocumentStoredName(vehicleId: string, type: string, ext: SniffedDocument["ext"]) {
  return `${vehicleId}/${type}/${randomUUID()}.${ext}`;
}

export function resolveVehicleDocumentPath(stored: string) {
  if (!STORED_PATH.test(stored)) return null;
  const root = path.resolve(vehicleDocumentRoot());
  const full = path.resolve(root, stored);
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

export async function writeVehicleDocumentBytes(vehicleId: string, type: string, bytes: Uint8Array) {
  const sniffed = sniffVehicleDocument(bytes);
  if (!sniffed) return null;
  const stored = vehicleDocumentStoredName(vehicleId, type, sniffed.ext);
  const full = resolveVehicleDocumentPath(stored);
  if (!full) return null;
  await mkdir(path.dirname(full), { recursive: true, mode: 0o750 });
  const handle = await open(full, "wx", 0o640);
  try {
    await handle.writeFile(bytes);
  } catch (error) {
    await handle.close();
    await rm(full, { force: true });
    throw error;
  }
  await handle.close();
  return {
    stored,
    mime: sniffed.mime,
    name: `${type}.${sniffed.ext}`,
  };
}

export async function removeVehicleDocumentFile(stored: string) {
  const full = resolveVehicleDocumentPath(stored);
  if (!full) return;
  await rm(full, { force: true });
}
