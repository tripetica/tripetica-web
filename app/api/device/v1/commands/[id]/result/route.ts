import { type NextRequest } from "next/server";
import { GPS_MAX_BODY_BYTES, parseCommandResultBody } from "@/lib/gps/contract";
import { authenticateDevice } from "@/lib/gps/device-auth";
import { deviceJson } from "@/lib/gps/http";
import { ackDeviceCommand } from "@/lib/gps/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > GPS_MAX_BODY_BYTES) {
    return deviceJson(413, { ok: false, error: "payload_too_large" });
  }
  const auth = await authenticateDevice(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return deviceJson(404, { ok: false, error: "not_found" });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  const result = parseCommandResultBody(body);
  if (!result) {
    return deviceJson(400, { ok: false, error: "invalid_body" });
  }
  const acked = await ackDeviceCommand(auth.device.id, id, result);
  if (acked.http !== 200) {
    return deviceJson(acked.http, { ok: false, error: acked.error });
  }
  return deviceJson(200, { ok: true });
}
