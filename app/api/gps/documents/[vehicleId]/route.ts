import { type NextRequest, NextResponse } from "next/server";
import { documentEditor } from "@/lib/gps/document-access";
import { listVehicleDocuments } from "@/lib/gps/document-store";
import { documentLocale } from "@/lib/gps/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VEHICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const { vehicleId } = await context.params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!VEHICLE_ID.test(vehicleId)) return NextResponse.json({ ok: false }, { status: 404, headers });
  const access = await documentEditor();
  if (!access) return NextResponse.json({ ok: false }, { status: 401, headers });
  const documents = await listVehicleDocuments({
    vehicleId,
    access,
    locale: documentLocale(request.nextUrl.searchParams.get("locale") ?? ""),
  });
  if (!documents) return NextResponse.json({ ok: false }, { status: 404, headers });
  return NextResponse.json({ documents, canEdit: true }, { headers });
}
