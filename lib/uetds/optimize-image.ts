import {
  UETDS_IMAGE_OPTIMIZE_EDGE,
  UETDS_IMAGE_OPTIMIZE_QUALITY,
} from "@/lib/uetds/upload-limits";

function isOptimizableImage(file: File) {
  if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export async function optimizeUetdsImageFile(file: File): Promise<File> {
  if (!isOptimizableImage(file) || typeof createImageBitmap !== "function") {
    return file;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, UETDS_IMAGE_OPTIMIZE_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= 1_200_000) {
      return file;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", UETDS_IMAGE_OPTIMIZE_QUALITY);
    });
    if (!blob || blob.size === 0 || blob.size >= file.size) {
      return file;
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function prepareUetdsUploadFiles(files: File[]) {
  const prepared: File[] = [];
  for (const file of files) {
    prepared.push(isOptimizableImage(file) ? await optimizeUetdsImageFile(file) : file);
  }
  return prepared;
}
