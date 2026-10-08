import { type NextRequest } from "next/server";
import { authenticateDevice } from "@/lib/gps/device-auth";
import { deviceJson } from "@/lib/gps/http";
import { pollDeviceCommands } from "@/lib/gps/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateDevice(request);
  if ("response" in auth) {
    return auth.response;
  }
  const commands = await pollDeviceCommands(auth.device.id);
  return deviceJson(200, { ok: true, commands });
}
