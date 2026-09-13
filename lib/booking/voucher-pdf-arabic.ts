import { createRequire } from "node:module";
import { join } from "node:path";
import bidiFactory from "bidi-js";

const require = createRequire(import.meta.url);
const { ArabicShaper } = require("arabic-persian-reshaper") as {
  ArabicShaper: { convertArabic: (text: string) => string };
};

const bidi = bidiFactory();

export const NOTO_SANS_ARABIC_REGULAR = join(
  process.cwd(),
  "lib/ops/fonts/NotoSansArabic-Regular.ttf",
);
export const NOTO_SANS_ARABIC_BOLD = join(
  process.cwd(),
  "lib/ops/fonts/NotoSansArabic-Bold.ttf",
);

const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type ArabicParagraphDir = "ltr" | "rtl";

export function hasArabicScript(text: string) {
  return ARABIC_SCRIPT_RE.test(text);
}

export function shapeArabicLine(
  text: string,
  paragraphDir: ArabicParagraphDir = "rtl",
) {
  if (!text || !hasArabicScript(text)) {
    return text;
  }
  const shaped = ArabicShaper.convertArabic(text);
  const levels = bidi.getEmbeddingLevels(shaped, paragraphDir);
  return bidi.getReorderedString(shaped, levels);
}

function wrapArabicParagraph(
  text: string,
  width: number,
  measure: (value: string) => number,
  paragraphDir: ArabicParagraphDir,
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "";
  }
  const lines: string[] = [];
  let current = words[0] ?? "";
  for (const word of words.slice(1)) {
    const trial = `${current} ${word}`;
    if (measure(ArabicShaper.convertArabic(trial)) > width - 0.75 && current) {
      lines.push(shapeArabicLine(current, paragraphDir));
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) {
    lines.push(shapeArabicLine(current, paragraphDir));
  }
  return lines.join("\n");
}

export function prepareArabicVoucherText(
  text: string,
  options: {
    width?: number;
    lineBreak?: boolean;
    paragraphDir?: ArabicParagraphDir;
  } | undefined,
  measure: (value: string) => number,
) {
  if (!hasArabicScript(text)) {
    return text;
  }
  const paragraphDir = options?.paragraphDir ?? "rtl";
  if (options?.lineBreak === false) {
    return shapeArabicLine(text, paragraphDir);
  }
  const width = options?.width;
  if (!width || !Number.isFinite(width)) {
    return text
      .split("\n")
      .map((line) => shapeArabicLine(line, paragraphDir))
      .join("\n");
  }
  return text
    .split("\n")
    .map((line) => wrapArabicParagraph(line, width, measure, paragraphDir))
    .join("\n");
}

function resolveTextArgs(
  x?: number | PDFKit.Mixins.TextOptions,
  y?: number,
  options?: PDFKit.Mixins.TextOptions,
): {
  x?: number;
  y?: number;
  options?: PDFKit.Mixins.TextOptions;
} {
  if (x !== undefined && typeof x === "object") {
    return { options: x };
  }
  return { x, y, options };
}

export type ArabicPdfRenderingOptions = {
  paragraphDir?: ArabicParagraphDir;
  forceRtlAlign?: boolean;
  resolveArabicFont?: (currentFont: string) => string | null;
};

/**
 * PDFKit draws glyphs left-to-right with no OpenType Arabic shaping.
 * Reshape presentation forms, wrap in logical order, then apply Unicode bidi.
 */
export function attachArabicPdfRendering(
  doc: PDFKit.PDFDocument,
  rendering: ArabicPdfRenderingOptions = {},
) {
  const paragraphDir = rendering.paragraphDir ?? "rtl";
  const originalText = doc.text.bind(doc);
  const originalHeightOfString = doc.heightOfString.bind(doc);
  const originalWidthOfString = doc.widthOfString.bind(doc);
  const originalFont = doc.font.bind(doc);
  let currentFont = "";

  doc.font = ((
    src: string,
    family?: string | number,
    size?: number,
  ) => {
    if (typeof src === "string" && !src.includes("/") && !src.endsWith(".ttf")) {
      currentFont = src;
    }
    return originalFont(src, family as never, size as never);
  }) as typeof doc.font;

  function withArabicFont<T>(text: string, fn: () => T): T {
    if (!hasArabicScript(text) || !rendering.resolveArabicFont) {
      return fn();
    }
    const next = rendering.resolveArabicFont(currentFont);
    if (!next || next === currentFont) {
      return fn();
    }
    const previous = currentFont;
    originalFont(next);
    currentFont = next;
    try {
      return fn();
    } finally {
      if (previous) {
        originalFont(previous);
        currentFont = previous;
      }
    }
  }

  function prepare(
    text: string,
    textOptions: PDFKit.Mixins.TextOptions | undefined,
  ) {
    return prepareArabicVoucherText(
      text,
      { ...textOptions, paragraphDir },
      (value) => originalWidthOfString(value),
    );
  }

  doc.text = ((
    text: string,
    x?: number | PDFKit.Mixins.TextOptions,
    y?: number,
    options?: PDFKit.Mixins.TextOptions,
  ) => {
    const raw = String(text ?? "");
    return withArabicFont(raw, () => {
      const args = resolveTextArgs(x, y, options);
      const prepared = prepare(raw, args.options);
      const nextOptions = args.options
        ? { ...args.options }
        : hasArabicScript(raw)
          ? {}
          : undefined;
      if (
        rendering.forceRtlAlign &&
        nextOptions &&
        hasArabicScript(raw) &&
        nextOptions.align !== "center" &&
        nextOptions.align !== "justify"
      ) {
        nextOptions.align = "right";
      }
      if (args.x !== undefined && args.y !== undefined) {
        return originalText(prepared, args.x, args.y, nextOptions);
      }
      if (nextOptions) {
        return originalText(prepared, nextOptions);
      }
      return originalText(prepared);
    });
  }) as typeof doc.text;

  doc.heightOfString = ((
    text: string,
    textOptions?: PDFKit.Mixins.TextOptions,
  ) => {
    const raw = String(text ?? "");
    return withArabicFont(raw, () =>
      originalHeightOfString(prepare(raw, textOptions), textOptions),
    );
  }) as typeof doc.heightOfString;
}

/**
 * For `ar` vouchers only: RTL paragraph + right-aligned Arabic runs.
 * The voucher already uses Noto Sans Arabic as its only face.
 */
export function attachArabicVoucherRendering(doc: PDFKit.PDFDocument) {
  attachArabicPdfRendering(doc, {
    paragraphDir: "rtl",
    forceRtlAlign: true,
  });
}
