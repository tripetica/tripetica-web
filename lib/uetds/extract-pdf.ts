import { inflateSync, inflateRawSync } from "node:zlib";

function decodePdfString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function collectPdfStrings(content: string) {
  const texts: string[] = [];
  const tj = /(?:\((?:\\.|[^\\)])*\)|\[[^\]]*\])\s*T[jJ]/g;
  for (const match of content.matchAll(tj)) {
    const chunk = match[0];
    for (const part of chunk.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      texts.push(decodePdfString(part[0].slice(1, -1)));
    }
  }
  return texts.join(" ");
}

function inflateStream(payload: Buffer) {
  try {
    return inflateSync(payload);
  } catch {
    try {
      return inflateRawSync(payload);
    } catch {
      return null;
    }
  }
}

export function extractTextFromPdfBuffer(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  for (const match of raw.matchAll(streamRe)) {
    const payload = Buffer.from(match[1], "latin1");
    const inflated = inflateStream(payload);
    const text = collectPdfStrings((inflated ?? payload).toString("latin1"));
    if (text.trim()) {
      chunks.push(text);
    }
  }
  if (chunks.length === 0) {
    const fallback = collectPdfStrings(raw);
    if (fallback.trim()) {
      chunks.push(fallback);
    }
  }
  return chunks.join("\n").replace(/\s+/g, " ").trim().slice(0, 200_000);
}
