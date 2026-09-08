export type TurinvoiceEnv = "test" | "live";

export type TurinvoiceConfig = {
  env: TurinvoiceEnv;
  baseUrl: string;
  login: string;
  password: string;
  tspId: string;
  callbackSecret: string;
  appBaseUrl: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

/**
 * Host origin only. Client appends `/api/v1/...`.
 * Accepts values that already include `/api/v1` (as sometimes pasted from docs).
 */
export function normalizeTurinvoiceBaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "");
}

export function resolveTurinvoiceEnv(
  raw: string | undefined = process.env.TURINVOICE_ENV,
): TurinvoiceEnv {
  const value = (raw ?? "live").trim().toLowerCase();
  return value === "test" ? "test" : "live";
}

function readPrefixedTurinvoiceCredentials(env: TurinvoiceEnv) {
  const prefix = env === "test" ? "TURINVOICE_TEST_" : "TURINVOICE_LIVE_";
  return {
    baseUrl: normalizeTurinvoiceBaseUrl(readEnv(`${prefix}BASE_URL`)),
    login: readEnv(`${prefix}LOGIN`),
    password: readEnv(`${prefix}PASSWORD`),
    tspId: readEnv(`${prefix}TSP_ID`),
    callbackSecret: readEnv(`${prefix}CALLBACK_SECRET`),
  };
}

export function readTurinvoiceConfig(): TurinvoiceConfig | null {
  const env = resolveTurinvoiceEnv();
  const creds = readPrefixedTurinvoiceCredentials(env);
  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (
    !creds.baseUrl ||
    !creds.login ||
    !creds.password ||
    !creds.tspId ||
    !creds.callbackSecret ||
    !appBaseUrl
  ) {
    return null;
  }

  return {
    env,
    baseUrl: creds.baseUrl,
    login: creds.login,
    password: creds.password,
    tspId: creds.tspId,
    callbackSecret: creds.callbackSecret,
    appBaseUrl,
  };
}

export function requireTurinvoiceConfig(): TurinvoiceConfig {
  const config = readTurinvoiceConfig();
  if (!config) {
    throw new Error("Turinvoice environment is not configured");
  }
  return config;
}

/** Server callback for payment result notifications (not browser redirect). */
export function turinvoiceCallbackUrl(
  config: TurinvoiceConfig = requireTurinvoiceConfig(),
) {
  return `${config.appBaseUrl}/api/payments/turinvoice/callback`;
}

/** Browser return URL after payment — locale from the reservation. */
export function turinvoiceRedirectUrl(
  locale: string,
  config: TurinvoiceConfig = requireTurinvoiceConfig(),
) {
  return `${config.appBaseUrl}/${locale}/booking/success`;
}
