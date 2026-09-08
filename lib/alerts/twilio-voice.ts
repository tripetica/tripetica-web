import { VOICE_ALERT_TWIML } from "@/lib/alerts/voice-alert-policy";

export type TwilioVoiceConfig = {
  accountSid: string;
  apiKeySid: string;
  apiSecret: string;
  fromNumber: string;
  toNumber: string;
};

type EnvMap = Record<string, string | undefined>;

function readEnv(env: EnvMap, ...keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function looksLikePhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function looksLikeSid(value: string, prefix: string) {
  return value.startsWith(prefix) && value.length >= prefix.length + 8;
}

export function readTwilioVoiceConfig(
  env: EnvMap = process.env,
): TwilioVoiceConfig | null {
  const accountSid = readEnv(env, "TWILIO_ACCOUNT_SID");
  const apiKeySid = readEnv(env, "TWILIO_API_KEY_SID", "TWILIO_API_KEY");
  const apiSecret = readEnv(env, "TWILIO_API_SECRET");
  const fromNumber = readEnv(env, "TWILIO_FROM_NUMBER");
  const toNumber = readEnv(env, "TWILIO_ALERT_TO_NUMBER");
  if (!accountSid || !apiKeySid || !apiSecret || !fromNumber || !toNumber) {
    return null;
  }
  if (!looksLikeSid(accountSid, "AC") || !looksLikeSid(apiKeySid, "SK")) {
    return null;
  }
  if (!looksLikePhoneNumber(fromNumber) || !looksLikePhoneNumber(toNumber)) {
    return null;
  }
  return { accountSid, apiKeySid, apiSecret, fromNumber, toNumber };
}

export function buildTwilioCallRequest(config: TwilioVoiceConfig) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Calls.json`;
  const body = new URLSearchParams({
    To: config.toNumber,
    From: config.fromNumber,
    Twiml: VOICE_ALERT_TWIML,
    Timeout: "20",
  });
  const authorization = Buffer.from(
    `${config.apiKeySid}:${config.apiSecret}`,
    "utf8",
  ).toString("base64");
  return {
    url,
    method: "POST" as const,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  };
}

export type TwilioCallResult =
  | { ok: true; callSid: string }
  | { ok: false; error: string };

export async function startTwilioVoiceCall(
  config: TwilioVoiceConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<TwilioCallResult> {
  const request = buildTwilioCallRequest(config);
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  } catch {
    return { ok: false, error: "network" };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const callSid =
    payload &&
    typeof payload === "object" &&
    "sid" in payload &&
    typeof payload.sid === "string"
      ? payload.sid.trim()
      : "";

  if (!response.ok || !callSid.startsWith("CA")) {
    return { ok: false, error: `twilio_${response.status}` };
  }
  return { ok: true, callSid };
}
