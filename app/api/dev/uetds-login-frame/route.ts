import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/ops/process-filters";
import { kamuLoginOwnerKey } from "@/lib/uetds/kamu-login-access";
import { loadKamuLoginFrame } from "@/lib/uetds/kamu-login-frame";
import { kamuLoginDevAllowed } from "@/lib/uetds/kamu-login-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!kamuLoginDevAllowed()) return new NextResponse(null, { status: 404 });
  const owner = await kamuLoginOwnerKey();
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  if (!owner || !isUuid(sessionId)) {
    return new NextResponse(null, { status: 404 });
  }
  let image: Buffer | null = null;
  try {
    image = await loadKamuLoginFrame(sessionId, owner);
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(`kamu_login_failed code=frame_failed name=${name}`);
    return new NextResponse(null, { status: 404 });
  }
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(image), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store",
    },
  });
}
