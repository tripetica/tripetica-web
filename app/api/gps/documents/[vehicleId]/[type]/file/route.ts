import { NextResponse } from "next/server";
import { documentEditor } from "@/lib/gps/document-access";
import { readVehicleDocumentFile } from "@/lib/gps/document-store";
import { isVehicleDocumentType } from "@/lib/gps/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VEHICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ vehicleId: string; type: string }> },
) {
  const { vehicleId, type } = await context.params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!VEHICLE_ID.test(vehicleId) || !isVehicleDocumentType(type)) {
    return NextResponse.json({ ok: false }, { status: 404, headers });
  }
  const access = await documentEditor();
  if (!access) return NextResponse.json({ ok: false }, { status: 401, headers });
  const file = await readVehicleDocumentFile({ vehicleId, documentType: type, access });
  if (!file) return NextResponse.json({ ok: false }, { status: 404, headers });
  const name = file.name.replace(/[^a-z0-9._-]/gi, "") || "belge";
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
