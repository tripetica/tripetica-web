import { type NextRequest, NextResponse } from "next/server";
import { GPS_CAMERA_SESSION_ID_PATTERN, readCameraFrame } from "@/lib/gps/camera";
import { cameraSessionForViewer, cameraViewerScope } from "@/lib/gps/camera-access";
import { touchCameraSession } from "@/lib/gps/camera-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!GPS_CAMERA_SESSION_ID_PATTERN.test(id)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  const scope = await cameraViewerScope(request.nextUrl.searchParams.get("surface"));
  if (!scope) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const session = await cameraSessionForViewer(id, scope);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  const expiresAt = await touchCameraSession(session.id);
  if (!expiresAt) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  }
  const frame = readCameraFrame(session.id);
  if (!frame) {
    return new NextResponse(null, { status: 204, headers: noStore });
  }
  return new NextResponse(Buffer.from(frame.body), {
    status: 200,
    headers: {
      ...noStore,
      "Content-Type": "image/jpeg",
      "X-Frame-At": String(frame.at),
    },
  });
}
