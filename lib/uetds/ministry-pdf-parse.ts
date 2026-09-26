export function extractUetdsSoapPdfBytes(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) {
    return null;
  }
  const pdf = Buffer.from(compact, "base64");
  if (pdf.length < 5 || pdf.subarray(0, 4).toString("latin1") !== "%PDF") {
    return null;
  }
  return pdf;
}
