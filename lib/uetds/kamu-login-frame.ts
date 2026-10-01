import { screenshotKamuLoginSession } from "@/lib/uetds/kamu-login-session";

/** Mobile browsers fail to decode a screenshot taller than a few thousand pixels. */
export const KAMU_FRAME_MAX_EDGE = 4096;
/** Tall captures are scaled to fit this box so the whole page stays in one decodable image. */
const OVERSIZED_FRAME_TTL_MS = 15000;

type FrameCache = {
  flights: Map<string, Promise<Buffer | null>>;
  fitted: Map<string, { at: number; bytes: Buffer }>;
};

function frameCache(): FrameCache {
  const globalStore = globalThis as typeof globalThis & { __tripeticaKamuLoginFrames?: FrameCache };
  if (!globalStore.__tripeticaKamuLoginFrames) {
    globalStore.__tripeticaKamuLoginFrames = { flights: new Map(), fitted: new Map() };
  }
  return globalStore.__tripeticaKamuLoginFrames;
}

export function kamuFrameUsesFullPage(scrollHeight: number) {
  return Number.isFinite(scrollHeight) && scrollHeight > 0 && scrollHeight <= KAMU_FRAME_MAX_EDGE;
}

export function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

export async function fitKamuFrameJpeg(image: Buffer): Promise<Buffer | null> {
  const size = jpegSize(image);
  if (!size || size.width < 1 || size.height < 1) return null;
  if (size.width <= KAMU_FRAME_MAX_EDGE && size.height <= KAMU_FRAME_MAX_EDGE) return image;
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(image, { limitInputPixels: false, sequentialRead: true })
      .resize({
        width: Math.min(size.width, KAMU_FRAME_MAX_EDGE),
        height: KAMU_FRAME_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 60 })
      .toBuffer();
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(`kamu_login_failed code=frame_too_large name=${name}`);
    return null;
  }
}

export async function loadKamuLoginFrame(sessionId: string, ownerKey: string) {
  const cache = frameCache();
  const saved = cache.fitted.get(sessionId);
  if (saved && Date.now() - saved.at < OVERSIZED_FRAME_TTL_MS) return saved.bytes;
  const pending = cache.flights.get(sessionId);
  if (pending) return pending;
  const job = (async () => {
    const raw = await screenshotKamuLoginSession(sessionId, ownerKey);
    if (!raw) return null;
    const fitted = await fitKamuFrameJpeg(raw);
    if (fitted && fitted !== raw) cache.fitted.set(sessionId, { at: Date.now(), bytes: fitted });
    return fitted;
  })().finally(() => {
    cache.flights.delete(sessionId);
  });
  cache.flights.set(sessionId, job);
  return job;
}
