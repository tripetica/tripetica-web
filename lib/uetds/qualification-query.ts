import "server-only";

import { createHash } from "node:crypto";
import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryEndpoint, UETDS_NS } from "@/lib/uetds/ministry-env";
import { soapUserXml } from "@/lib/uetds/ministry-soap";
import {
  qualificationOutcomeFromXml,
  type QualificationOutcome,
} from "@/lib/uetds/qualification";

const ACTION = `${UETDS_NS}uetdsyts/meslekiYeterlilikSorgula`;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; outcome: QualificationOutcome }>();

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cacheKey(partnerId: string, companyId: string, nationalId: string) {
  return createHash("sha256").update(`${partnerId}\n${companyId}\n${nationalId}`).digest("hex");
}

export async function queryDriverQualification(companyId: string, nationalId: string): Promise<QualificationOutcome> {
  if (!isUuid(companyId)) return { status: "unverified", sonucKodu: null };
  const active = await query<{ id: string }>(
    `SELECT id FROM uetds_companies WHERE id = $1 AND status = 'active' LIMIT 1`,
    [companyId],
  );
  if (!active.rows[0]) return { status: "unverified", sonucKodu: null };
  const credentials = await loadUetdsMinistryCredentials(companyId);
  if (!credentials) return { status: "unverified", sonucKodu: null };
  let endpoint = "";
  try {
    endpoint = resolveUetdsMinistryEndpoint();
  } catch {
    return { status: "unverified", sonucKodu: null };
  }
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:uet="${UETDS_NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <uet:meslekiYeterlilikSorgula>
      ${soapUserXml(credentials.username, credentials.password)}
      <kimlikNo>${nationalId.replace(/\D/g, "")}</kimlikNo>
    </uet:meslekiYeterlilikSorgula>
  </soapenv:Body>
</soapenv:Envelope>`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${ACTION}"`,
        Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`, "utf8").toString("base64")}`,
      },
      body: envelope,
    });
    const xml = await response.text();
    return qualificationOutcomeFromXml(xml, istanbulToday());
  } catch {
    return { status: "unverified", sonucKodu: null };
  }
}

export async function cachedDriverQualification(input: {
  partnerId: string;
  companyId: string;
  nationalId: string;
}) {
  const key = cacheKey(input.partnerId, input.companyId, input.nationalId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.outcome;
  const outcome = await queryDriverQualification(input.companyId, input.nationalId);
  cache.set(key, { at: Date.now(), outcome });
  return outcome;
}

export function rememberDriverQualification(input: {
  partnerId: string;
  companyId: string;
  nationalId: string;
  outcome: QualificationOutcome;
}) {
  cache.set(cacheKey(input.partnerId, input.companyId, input.nationalId), {
    at: Date.now(),
    outcome: input.outcome,
  });
}
