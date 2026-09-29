export type UetdsEditMethodId = "ai" | "form" | "edevlet";

/**
 * Server-side switch for “Tripetica AI ile düzenle”.
 * Partners, drivers, and U-ETDS companies have no Gold membership field or helper.
 * This stays false so Standard sessions do not see the option. The client modal
 * only receives the boolean; it does not decide membership.
 */
export function showUetdsAiEditMethod(): boolean {
  return false;
}

export function uetdsEditMethodOptionIds(showAiEdit: boolean): UetdsEditMethodId[] {
  return showAiEdit ? ["ai", "form", "edevlet"] : ["form", "edevlet"];
}

/**
 * Sefer No shown on every edit-method option.
 * Prefers the ministry U-ETDS sefer reference already shown on the detail page,
 * then the SOAP firma sefer number (reservation id / TRP-…) used by the e-Devlet hint.
 * Plate is not a sefer number and is never used.
 */
export function uetdsEditMethodSeferNo(input: {
  ministryReference?: string | null;
  firmaSeferNo?: string | null;
}): string | null {
  const ministry = input.ministryReference?.trim() ?? "";
  if (ministry) {
    return ministry;
  }
  const firma = input.firmaSeferNo?.trim() ?? "";
  return firma || null;
}
