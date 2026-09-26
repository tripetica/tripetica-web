export const UETDS_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const UETDS_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const UETDS_MAX_IMAGE_COUNT = 6;
export const UETDS_IMAGE_OPTIMIZE_EDGE = 2000;
export const UETDS_IMAGE_OPTIMIZE_QUALITY = 0.84;

export function isOversizedUetdsFile(size: number) {
  return size > UETDS_MAX_FILE_BYTES;
}

export function isOversizedUetdsBatch(sizes: readonly number[]) {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return total > UETDS_MAX_TOTAL_BYTES;
}
