import "server-only";

import { type ClassifiedUetdsPassenger } from "@/lib/uetds/passenger-class";
import { type UetdsPassengerDraft } from "@/lib/uetds/draft";
import {
  updateExistingKamuPassenger,
  type KamuPortalClientError,
  type KamuPortalFetch,
} from "@/lib/uetds/kamu-portal/client";
import { type UetdsMutationResult } from "@/lib/uetds/ministry-mutate";
import { queryUetdsYolcuBildirim } from "@/lib/uetds/ministry-mutate";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

export const KAMU_YOLCU_GUNCELLE_OPERATION = "kamuYolcuGuncelle" as const;

export type KamuPassengerUpdateBatchError =
  | KamuPortalClientError
  | "kamu-ref-changed"
  | "kamu-verify-failed";

export async function updateEditedPassengersViaKamuPortal(input: {
  companyId: string;
  ministrySeferRef: string;
  firmaSeferNo?: string | null;
  plate?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  editedExisting: ClassifiedUetdsPassenger[];
  fetchImpl?: KamuPortalFetch;
  /**
   * SOAP same-ref verify. Default: only when ministry runtime is already live
   * (never opens LIVE SOAP from DEV create/test routing).
   */
  verifyWithSoap?: boolean;
}): Promise<
  | {
      ok: true;
      operations: UetdsMutationResult[];
      keptRefs: Map<number, string>;
      keptPassengers: Map<number, UetdsPassengerDraft>;
    }
  | { ok: false; error: KamuPassengerUpdateBatchError; operations: UetdsMutationResult[] }
> {
  const operations: UetdsMutationResult[] = [];
  const keptRefs = new Map<number, string>();
  const keptPassengers = new Map<number, UetdsPassengerDraft>();
  const shouldVerify =
    input.verifyWithSoap ?? resolveUetdsMinistryRuntime() === "live";

  for (const item of input.editedExisting) {
    const reference = item.ministryReference?.trim() || "";
    const passenger = item.edited;
    const original = item.original;
    if (!reference || !passenger || !original) {
      operations.push({
        operation: KAMU_YOLCU_GUNCELLE_OPERATION,
        sonucKodu: -1,
        sonucMesaji: "Eksik yolcu referansı",
        reference: reference || undefined,
      });
      return { ok: false, error: "kamu-yolcu-not-found", operations };
    }

    const result = await updateExistingKamuPassenger({
      firmaSeferNo: input.firmaSeferNo,
      ministrySeferRef: input.ministrySeferRef,
      plate: input.plate,
      startDate: input.startDate,
      startTime: input.startTime,
      matchIdentityNumber: original.identityNumber,
      matchFirstName: original.firstName,
      matchLastName: original.lastName,
      passenger,
      fetchImpl: input.fetchImpl,
    });

    if (!result.ok) {
      operations.push({
        operation: KAMU_YOLCU_GUNCELLE_OPERATION,
        sonucKodu: -1,
        sonucMesaji: result.error,
        reference,
      });
      return { ok: false, error: result.error, operations };
    }

    if (shouldVerify) {
      const credentials = await loadUetdsMinistryCredentials(input.companyId);
      if (credentials) {
        const query = await queryUetdsYolcuBildirim({
          username: credentials.username,
          password: credentials.password,
          seferReferansNo: input.ministrySeferRef,
          seferYolcuRefNo: reference,
        });
        const sameRef = (query.reference || "").trim() === reference;
        const firstOk =
          query.firstName.trim().toUpperCase() === passenger.firstName.trim().toUpperCase();
        const lastOk =
          query.lastName.trim().toUpperCase() === passenger.lastName.trim().toUpperCase();
        if (!sameRef) {
          operations.push({
            operation: KAMU_YOLCU_GUNCELLE_OPERATION,
            sonucKodu: -1,
            sonucMesaji: "Portal güncellemesi sonrası yolcu ref değişti",
            reference,
          });
          return { ok: false, error: "kamu-ref-changed", operations };
        }
        if (query.sonucKodu !== 0 || !firstOk || !lastOk) {
          operations.push({
            operation: KAMU_YOLCU_GUNCELLE_OPERATION,
            sonucKodu: -1,
            sonucMesaji: "Portal güncellemesi SOAP ile doğrulanamadı",
            reference,
          });
          return { ok: false, error: "kamu-verify-failed", operations };
        }
      }
    }

    operations.push({
      operation: KAMU_YOLCU_GUNCELLE_OPERATION,
      sonucKodu: 0,
      sonucMesaji: "Yolcu Güncellenmiştir.",
      reference,
    });
    keptRefs.set(item.index, reference);
    keptPassengers.set(item.index, { ...passenger, ministryReference: reference });
  }

  return { ok: true, operations, keptRefs, keptPassengers };
}
