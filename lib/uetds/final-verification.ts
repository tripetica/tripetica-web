import { foldUetdsSearchPlate } from "@/lib/uetds/edit-policy";
import type { UetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

export type UetdsVerificationExpected = {
  seferReference: string;
  plate: string;
  groupCount: number;
  personnelCount: number;
  passengerCount: number;
};

export type UetdsVerificationSummary = {
  sonucKodu: number | null;
  seferReference: string | null;
  seferStatusCode: number | null;
  seferStatus: string | null;
  aracPlaka: string | null;
  groupCount: number;
  activePersonnelCount: number;
  activeCount: number;
};

export type UetdsFinalVerification = {
  timestamp: string;
  environment: UetdsMinistryRuntime;
  seferReference: string;
  sonucKodu: number | null;
  seferStatus: "GEÇERLİ" | "İPTAL" | "UNKNOWN";
  expected: UetdsVerificationExpected;
  actual: {
    seferReference: string | null;
    plate: string | null;
    groupCount: number | null;
    personnelCount: number | null;
    passengerCount: number | null;
  };
  result: "verified" | "final-verification-failed";
  reasons: string[];
};

export function evaluateUetdsFinalVerification(
  expected: UetdsVerificationExpected,
  summary: UetdsVerificationSummary | null,
  environment: UetdsMinistryRuntime,
): UetdsFinalVerification {
  const plate = foldUetdsSearchPlate(expected.plate);
  const status = summary?.seferStatus?.trim().toLocaleUpperCase("tr-TR");
  const valid = summary?.seferStatusCode === 0 && status === "GEÇERLİ";
  const reference = summary?.seferReference?.trim() || null;
  const actualPlate = summary?.aracPlaka ? foldUetdsSearchPlate(summary.aracPlaka) : null;
  const reasons: string[] = [];
  if (!summary || summary.sonucKodu !== 0) reasons.push("summary-unavailable");
  if (summary?.seferStatusCode == null || !summary?.aracPlaka) reasons.push("trip-not-found");
  if (!valid) reasons.push("trip-not-valid");
  // bildirimOzeti may omit the reference; compare only a value returned by the service.
  if (reference && reference !== expected.seferReference) reasons.push("reference-mismatch");
  if (!plate || plate !== actualPlate) reasons.push("plate-mismatch");
  if (summary?.groupCount !== expected.groupCount) reasons.push("group-count-mismatch");
  if (summary?.activePersonnelCount !== expected.personnelCount) reasons.push("personnel-count-mismatch");
  if (summary?.activeCount !== expected.passengerCount) reasons.push("passenger-count-mismatch");
  return {
    timestamp: new Date().toISOString(), environment,
    seferReference: expected.seferReference,
    sonucKodu: summary?.sonucKodu ?? null,
    seferStatus: valid ? "GEÇERLİ" : status === "İPTAL" ? "İPTAL" : "UNKNOWN",
    expected: { ...expected, plate },
    actual: {
      seferReference: reference && /^\d{1,20}$/.test(reference) ? reference : null,
      plate: actualPlate && /^[A-Z0-9]{1,20}$/.test(actualPlate) ? actualPlate : null,
      groupCount: summary?.groupCount ?? null,
      personnelCount: summary?.activePersonnelCount ?? null,
      passengerCount: summary?.activeCount ?? null,
    },
    result: reasons.length === 0 ? "verified" : "final-verification-failed", reasons,
  };
}
