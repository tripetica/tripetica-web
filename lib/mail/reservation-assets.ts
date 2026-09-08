/**
 * Exact filenames under /public (moved from repo root; not renamed).
 * Uses the on-disk Unicode form (s + combining cedilla).
 */
export const IST_MEET_PHOTO_FILENAME = "ist kars\u0327\u0131lama evet foto.png";
export const IST_MEET_VIDEO_FILENAME = "ist kars\u0327\u0131lama evet video.mp4";
export const SAW_MEET_PHOTO_FILENAME = "saw kars\u0327\u0131lama evet foto.jpeg";
export const SAW_MEET_VIDEO_FILENAME = "saw kars\u0327\u0131lama evet video.mp4";
export const SAW_NO_MEET_PHOTO_FILENAME =
  "Saw kars\u0327\u0131lama hay\u0131r foto.jpeg";
export const AYT_MEET_PHOTO_FILENAME =
  "ayt kars\u0327\u0131lama fotog\u0306raf.JPG";
export const AYT_MEET_VIDEO_FILENAME = "ayt kars\u0327\u0131lama video.MP4";
export const IST_NO_MEET_STEP_FILENAMES = [
  "ist kars\u0327\u0131lama hay\u0131r 1. ad\u0131m .png",
  "ist kars\u0327\u0131lama hay\u0131r 2. ad\u0131m .png",
  "ist kars\u0327\u0131lama hay\u0131r 3. ad\u0131m .png",
  "ist kars\u0327\u0131lama hay\u0131r 4. ad\u0131m .png",
] as const;

export function mailAppBaseUrl() {
  const raw = (process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return raw || "http://127.0.0.1:3000";
}

export function publicAssetUrl(filename: string) {
  return `${mailAppBaseUrl()}/${encodeURIComponent(filename)}`;
}

export function istMeetPhotoUrl() {
  return publicAssetUrl(IST_MEET_PHOTO_FILENAME);
}

export function istMeetVideoUrl() {
  return publicAssetUrl(IST_MEET_VIDEO_FILENAME);
}

export function sawMeetPhotoUrl() {
  return publicAssetUrl(SAW_MEET_PHOTO_FILENAME);
}

export function sawMeetVideoUrl() {
  return publicAssetUrl(SAW_MEET_VIDEO_FILENAME);
}

export function sawNoMeetPhotoUrl() {
  return publicAssetUrl(SAW_NO_MEET_PHOTO_FILENAME);
}

export function aytMeetPhotoUrl() {
  return publicAssetUrl(AYT_MEET_PHOTO_FILENAME);
}

export function aytMeetVideoUrl() {
  return publicAssetUrl(AYT_MEET_VIDEO_FILENAME);
}

export function istNoMeetStepUrls() {
  return IST_NO_MEET_STEP_FILENAMES.map(publicAssetUrl);
}
