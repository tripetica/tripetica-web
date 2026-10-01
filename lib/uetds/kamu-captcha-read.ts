import OpenAI from "openai";

const MODEL = "gpt-5.6-luna";

/** Keep only the characters visible in a captcha image. Never log this value. */
export function captchaTextFromModel(value: unknown) {
  if (!value || typeof value !== "object" || !("code" in value)) return null;
  const code = String(value.code).replace(/[^A-Za-z0-9]/g, "");
  if (code.length < 4 || code.length > 8) return null;
  return code;
}

type CaptchaVote = { code: string | null; confidence?: number | null };

/** Pick the repeated code. Equal counts use confidence, then the earliest read. */
export function captchaConsensus(reads: Array<string | null | CaptchaVote>) {
  const ranked = new Map<string, { count: number; confidence: number; index: number }>();
  reads.forEach((read, index) => {
    const code = typeof read === "string" ? read : read?.code ?? null;
    if (!code) return;
    const confidence = typeof read === "object" && read?.confidence != null ? read.confidence : -1;
    const current = ranked.get(code);
    if (!current) {
      ranked.set(code, { count: 1, confidence, index });
      return;
    }
    current.count += 1;
    if (confidence > current.confidence) current.confidence = confidence;
  });
  let best: string | null = null;
  let bestCount = -1;
  let bestConfidence = -Infinity;
  let bestIndex = Infinity;
  for (const [code, stats] of ranked) {
    const preferred = stats.count > bestCount
      || (stats.count === bestCount && stats.confidence > bestConfidence)
      || (stats.count === bestCount && stats.confidence === bestConfidence && stats.index < bestIndex);
    if (!preferred) continue;
    best = code;
    bestCount = stats.count;
    bestConfidence = stats.confidence;
    bestIndex = stats.index;
  }
  return best;
}

/** Five reads of one image. The caller must not refresh or replace that image. */
export async function voteKamuCaptcha(image: Buffer, read: (image: Buffer) => Promise<string | null> = readKamuCaptcha) {
  const reads = await Promise.all(Array.from({ length: 5 }, () => read(image)));
  return captchaConsensus(reads);
}

export async function readKamuCaptcha(image: Buffer): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || image.length < 32) return null;
  const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1", timeout: 20_000, maxRetries: 0, logLevel: "off" });
  const data = `data:image/png;base64,${image.toString("base64")}`;
  try {
    const response = await client.responses.create({
      model: MODEL,
      store: false,
      tools: [],
      max_output_tokens: 200,
      reasoning: { effort: "low" },
      instructions: "Transcribe the security-code image. Return the visible letters and digits in order, preserving case. Read every character that is visibly inked. Do not skip a character because it is slightly distorted.",
      input: [{ role: "user", content: [{ type: "input_image", image_url: data, detail: "high" }] }],
      text: {
        format: {
          type: "json_schema",
          name: "captcha_text",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { code: { type: "string" } },
            required: ["code"],
          },
        },
      },
    });
    if (response.status !== "completed" || !response.output_text) return null;
    return captchaTextFromModel(JSON.parse(response.output_text));
  } catch {
    return null;
  }
}
