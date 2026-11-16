import "server-only";

import { type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import { getPool, query } from "@/lib/db/postgres";
import {
  VEHICLE_DOCUMENT_TYPES,
  documentDaysLeft,
  documentStatus,
  documentTypeName,
  istanbulDocumentDate,
  nextDocumentRecord,
  type DocumentLocale,
  type DocumentRecordState,
  type DocumentWriteMode,
  type VehicleDocumentType,
} from "@/lib/gps/documents";
import {
  removeVehicleDocumentFile,
  resolveVehicleDocumentPath,
  writeVehicleDocumentBytes,
} from "@/lib/gps/document-files";

export type DocumentAccess =
  | { kind: "ops"; userId: string }
  | { kind: "partner"; partnerId: string; userId: string }
  | { kind: "driver"; partnerId: string; vehicleIds: readonly string[] };

export type VehicleDocumentView = {
  type: VehicleDocumentType;
  officialName: string;
  expiresOn: string | null;
  daysLeft: number | null;
  status: "empty" | "valid" | "approaching" | "expired";
  policyNumber: string | null;
  hasFile: boolean;
  fileMime: string | null;
};

export type DocumentSaveError = "forbidden" | "invalid" | "file" | "exists" | "missing" | "failed";

type DocumentRow = {
  id: string;
  document_type: VehicleDocumentType;
  expires_on: string;
  policy_number: string | null;
  file_path: string | null;
  file_mime: string | null;
  file_name: string | null;
};

function pgCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

async function vehicleVisible(vehicleId: string, access: DocumentAccess) {
  if (access.kind === "driver" && !access.vehicleIds.includes(vehicleId)) return false;
  if (access.kind === "partner") {
    const result = await query<{ id: string }>(
      `SELECT id
         FROM partner_vehicles
        WHERE id = $1
          AND deleted_at IS NULL
          AND partner_can_access_vehicle($2, id)`,
      [vehicleId, access.partnerId],
    );
    return result.rows.length > 0;
  }
  if (access.kind === "driver") {
    const result = await query<{ id: string }>(
      `SELECT id
         FROM partner_vehicles
        WHERE id = $1
          AND deleted_at IS NULL
          AND partner_can_access_vehicle($2, id)`,
      [vehicleId, access.partnerId],
    );
    return result.rows.length > 0;
  }
  const result = await query<{ id: string }>(
    `SELECT id FROM partner_vehicles WHERE id = $1 AND deleted_at IS NULL`,
    [vehicleId],
  );
  return result.rows.length > 0;
}

export async function listVehicleDocuments(input: {
  vehicleId: string;
  access: DocumentAccess;
  locale: DocumentLocale;
  today?: string;
}): Promise<VehicleDocumentView[] | null> {
  if (!(await vehicleVisible(input.vehicleId, input.access))) return null;
  const today = input.today ?? istanbulDocumentDate();
  const result = await query<DocumentRow>(
    `SELECT id, document_type, expires_on::text AS expires_on, policy_number, file_path, file_mime, file_name
       FROM vehicle_documents
      WHERE vehicle_id = $1`,
    [input.vehicleId],
  );
  const byType = new Map(result.rows.map((row) => [row.document_type, row]));
  return VEHICLE_DOCUMENT_TYPES.map((type) => {
    const row = byType.get(type);
    const expiresOn = row?.expires_on ?? null;
    return {
      type,
      officialName: documentTypeName(type, input.locale),
      expiresOn,
      daysLeft: expiresOn ? documentDaysLeft(expiresOn, today) : null,
      status: documentStatus(expiresOn, today),
      policyNumber: row?.policy_number ?? null,
      hasFile: Boolean(row?.file_path),
      fileMime: row?.file_mime ?? null,
    };
  });
}

async function lockVehicle(client: PoolClient, vehicleId: string, access: Exclude<DocumentAccess, { kind: "driver" }>) {
  if (access.kind === "partner") {
    const result = await client.query<{ id: string }>(
      `SELECT id
         FROM partner_vehicles
        WHERE id = $1
          AND deleted_at IS NULL
          AND partner_can_access_vehicle($2, id)
        FOR UPDATE`,
      [vehicleId, access.partnerId],
    );
    return result.rows[0] ?? null;
  }
  const result = await client.query<{ id: string }>(
    `SELECT id FROM partner_vehicles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [vehicleId],
  );
  return result.rows[0] ?? null;
}

async function loadLockedDocument(client: PoolClient, vehicleId: string, type: VehicleDocumentType) {
  const result = await client.query<DocumentRow>(
    `SELECT id, document_type, expires_on::text AS expires_on, policy_number, file_path, file_mime, file_name
       FROM vehicle_documents
      WHERE vehicle_id = $1
        AND document_type = $2
      FOR UPDATE`,
    [vehicleId, type],
  );
  return result.rows[0] ?? null;
}

function existingState(row: DocumentRow | null): DocumentRecordState | null {
  if (!row) return null;
  return {
    expiresOn: row.expires_on,
    policyNumber: row.policy_number,
    filePath: row.file_path,
    fileMime: row.file_mime,
    fileName: row.file_name,
  };
}

export async function removeUnreferencedDocumentFile(stored: string, exceptId: string) {
  try {
    const used = await query<{ id: string }>(
      `SELECT id FROM vehicle_documents WHERE file_path = $1 AND id <> $2 LIMIT 1`,
      [stored, exceptId],
    );
    if (used.rows.length > 0) return;
    await removeVehicleDocumentFile(stored);
  } catch (error) {
    console.error("[vehicle-documents] old file cleanup failed", error instanceof Error ? error.name : "cleanup");
  }
}

export async function saveVehicleDocument(input: {
  vehicleId: string;
  access: Exclude<DocumentAccess, { kind: "driver" }>;
  mode: DocumentWriteMode;
  documentType: VehicleDocumentType;
  expiresOn: string;
  policyNumber: string | null;
  removeFile: boolean;
  file: Uint8Array | null;
}): Promise<{ ok: true } | { ok: false; error: DocumentSaveError }> {
  const uploaded = input.file ? await writeVehicleDocumentBytes(input.vehicleId, input.documentType, input.file) : null;
  if (input.file && !uploaded) return { ok: false, error: "file" };
  const client = await getPool().connect();
  let committed = false;
  let previousPath: string | null = null;
  let documentId = "";
  try {
    await client.query("BEGIN");
    const vehicle = await lockVehicle(client, input.vehicleId, input.access);
    if (!vehicle) {
      await client.query("ROLLBACK");
      if (uploaded) await removeVehicleDocumentFile(uploaded.stored);
      return { ok: false, error: "forbidden" };
    }
    const existing = await loadLockedDocument(client, input.vehicleId, input.documentType);
    const next = nextDocumentRecord({
      mode: input.mode,
      existing: existingState(existing),
      expiresOn: input.expiresOn,
      policyNumber: input.policyNumber,
      upload: uploaded ? { path: uploaded.stored, mime: uploaded.mime, name: uploaded.name } : null,
      removeFile: input.removeFile,
    });
    if (!next.ok) {
      await client.query("ROLLBACK");
      if (uploaded) await removeVehicleDocumentFile(uploaded.stored);
      return next;
    }
    const actorKind = input.access.kind;
    const actorId = input.access.userId;
    if (existing) {
      const updated = await client.query<{ id: string }>(
        `UPDATE vehicle_documents
            SET expires_on = $3,
                policy_number = $4,
                file_path = $5,
                file_mime = $6,
                file_name = $7,
                updated_at = NOW(),
                updated_by = $8,
                actor_kind = $9
          WHERE id = $10
            AND vehicle_id = $1
            AND document_type = $2
        RETURNING id`,
        [
          input.vehicleId,
          input.documentType,
          next.expiresOn,
          next.policyNumber,
          next.filePath,
          next.fileMime,
          next.fileName,
          actorId,
          actorKind,
          existing.id,
        ],
      );
      documentId = updated.rows[0]?.id ?? "";
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO vehicle_documents (
           vehicle_id, document_type, expires_on, policy_number, file_path, file_mime, file_name, updated_by, actor_kind
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          input.vehicleId,
          input.documentType,
          next.expiresOn,
          next.policyNumber,
          next.filePath,
          next.fileMime,
          next.fileName,
          actorId,
          actorKind,
        ],
      );
      documentId = inserted.rows[0]?.id ?? "";
    }
    if (!documentId) {
      await client.query("ROLLBACK");
      if (uploaded) await removeVehicleDocumentFile(uploaded.stored);
      return { ok: false, error: "failed" };
    }
    await client.query("COMMIT");
    committed = true;
    previousPath = next.previousPath;
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction is already closed.
      }
      if (uploaded) await removeVehicleDocumentFile(uploaded.stored);
    }
    if (pgCode(error) === "23505") return { ok: false, error: "exists" };
    console.error("[vehicle-documents] save failed", error instanceof Error ? error.name : "save");
    return { ok: false, error: "failed" };
  } finally {
    client.release();
  }
  if (previousPath) await removeUnreferencedDocumentFile(previousPath, documentId);
  return { ok: true };
}

export async function deleteVehicleDocument(input: {
  vehicleId: string;
  access: Exclude<DocumentAccess, { kind: "driver" }>;
  documentType: VehicleDocumentType;
}): Promise<{ ok: true } | { ok: false; error: "forbidden" | "missing" | "failed" }> {
  const client = await getPool().connect();
  let committed = false;
  let stored: string | null = null;
  let documentId = "";
  try {
    await client.query("BEGIN");
    const vehicle = await lockVehicle(client, input.vehicleId, input.access);
    if (!vehicle) {
      await client.query("ROLLBACK");
      return { ok: false, error: "forbidden" };
    }
    const existing = await loadLockedDocument(client, input.vehicleId, input.documentType);
    if (!existing) {
      await client.query("ROLLBACK");
      return { ok: false, error: "missing" };
    }
    const removed = await client.query(
      `DELETE FROM vehicle_documents
        WHERE id = $1
          AND vehicle_id = $2
          AND document_type = $3`,
      [existing.id, input.vehicleId, input.documentType],
    );
    if ((removed.rowCount ?? 0) !== 1) {
      await client.query("ROLLBACK");
      return { ok: false, error: "failed" };
    }
    await client.query("COMMIT");
    committed = true;
    stored = existing.file_path;
    documentId = existing.id;
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction is already closed.
      }
    }
    console.error("[vehicle-documents] delete failed", error instanceof Error ? error.name : "delete");
    return { ok: false, error: "failed" };
  } finally {
    client.release();
  }
  if (stored) await removeUnreferencedDocumentFile(stored, documentId);
  return { ok: true };
}

export async function readVehicleDocumentFile(input: {
  vehicleId: string;
  documentType: VehicleDocumentType;
  access: DocumentAccess;
}) {
  if (!(await vehicleVisible(input.vehicleId, input.access))) return null;
  const result = await query<{ file_path: string; file_mime: string; file_name: string }>(
    `SELECT file_path, file_mime, file_name
       FROM vehicle_documents
      WHERE vehicle_id = $1
        AND document_type = $2
        AND file_path IS NOT NULL`,
    [input.vehicleId, input.documentType],
  );
  const row = result.rows[0];
  if (!row) return null;
  const full = resolveVehicleDocumentPath(row.file_path);
  if (!full) return null;
  try {
    const bytes = await readFile(full);
    return { bytes, mime: row.file_mime, name: row.file_name };
  } catch {
    return null;
  }
}
