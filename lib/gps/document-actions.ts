"use server";

import { documentEditor } from "@/lib/gps/document-access";
import { VEHICLE_DOCUMENT_MAX_BYTES } from "@/lib/gps/document-files";
import { deleteVehicleDocument, saveVehicleDocument, type DocumentSaveError } from "@/lib/gps/document-store";
import {
  cleanPolicyNumber,
  isVehicleDocumentType,
  parseDocumentDate,
  type DocumentWriteMode,
} from "@/lib/gps/documents";

const VEHICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function modeOf(value: string): DocumentWriteMode | null {
  if (value === "create" || value === "renew" || value === "edit") return value;
  return null;
}

export async function saveVehicleDocumentAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: DocumentSaveError }> {
  const access = await documentEditor();
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const documentType = String(formData.get("documentType") ?? "");
  const mode = modeOf(String(formData.get("mode") ?? ""));
  const expiresOn = parseDocumentDate(String(formData.get("expiresOn") ?? ""));
  if (!access || !VEHICLE_ID.test(vehicleId) || !isVehicleDocumentType(documentType) || !mode || !expiresOn) {
    return { ok: false, error: access ? "invalid" : "forbidden" };
  }
  const fileValue = formData.get("file");
  let file: Uint8Array | null = null;
  if (fileValue instanceof File && fileValue.size > 0) {
    if (fileValue.size > VEHICLE_DOCUMENT_MAX_BYTES) return { ok: false, error: "file" };
    file = new Uint8Array(await fileValue.arrayBuffer());
  }
  return saveVehicleDocument({
    vehicleId,
    access,
    mode,
    documentType,
    expiresOn,
    policyNumber: cleanPolicyNumber(String(formData.get("policyNumber") ?? "")),
    removeFile: String(formData.get("removeFile") ?? "") === "1",
    file,
  });
}

export async function deleteVehicleDocumentAction(
  vehicleId: string,
  documentType: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" | "missing" | "failed" }> {
  const access = await documentEditor();
  if (!access || !VEHICLE_ID.test(vehicleId) || !isVehicleDocumentType(documentType)) {
    return { ok: false, error: access ? "invalid" : "forbidden" };
  }
  return deleteVehicleDocument({ vehicleId, access, documentType });
}
