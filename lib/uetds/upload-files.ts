import { UETDS_MAX_IMAGE_COUNT } from "@/lib/uetds/upload-limits";

/** Stable-enough File identity without reading bytes (name/size/mtime/type). */
export function isSameUetdsUploadFile(left: File, right: File) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified &&
    left.type === right.type
  );
}

/**
 * Append newly picked images onto the existing list.
 * Skips true duplicates and never exceeds UETDS_MAX_IMAGE_COUNT.
 */
export function appendUetdsImageFiles(
  current: readonly File[],
  incoming: readonly File[],
  maxCount = UETDS_MAX_IMAGE_COUNT,
): File[] {
  const next = [...current];
  for (const file of incoming) {
    if (next.length >= maxCount) {
      break;
    }
    if (next.some((existing) => isSameUetdsUploadFile(existing, file))) {
      continue;
    }
    next.push(file);
  }
  return next;
}
