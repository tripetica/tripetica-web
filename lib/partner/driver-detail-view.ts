export type PartnerDriverDetailMode = "view" | "edit" | "edit-dirty";

export function partnerDriverDetailMode(
  isEditing: boolean,
  dirty: boolean,
): PartnerDriverDetailMode {
  if (dirty) {
    return "edit-dirty";
  }
  if (isEditing) {
    return "edit";
  }
  return "view";
}
