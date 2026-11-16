import { createHash } from "node:crypto";

export function teltonikaDiagnostic(imei: string, stage: string, code: string, count?: number) {
  const device = createHash("sha256").update(imei).digest("hex").slice(0, 16);
  console.info(JSON.stringify({ event: "teltonika_ingest", device, stage, code, ...(count === undefined ? {} : { count }) }));
}

export function teltonikaErrorCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : "processing_failed";
}
