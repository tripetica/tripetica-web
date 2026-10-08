import { NextResponse } from "next/server";
import { DEVICE_API_VERSION } from "@/lib/gps/contract";

export function deviceJson(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Device-Api-Version": String(DEVICE_API_VERSION),
    },
  });
}
