import { type NextRequest, NextResponse } from "next/server";
import { GPS_CAMERA_SESSION_ID_PATTERN } from "@/lib/gps/camera";
import { cameraSessionForViewer, cameraViewerScope } from "@/lib/gps/camera-access";
import { stopCameraSession } from "@/lib/gps/camera-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!GPS_CAMERA_SESSION_ID_PATTERN.test(id)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  const surface = request.nextUrl.searchParams.get("surface");
  const scope = await cameraViewerScope(surface);
  if (!scope) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const session = await cameraSessionForViewer(id, scope);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  await stopCameraSession(session.id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
