import "server-only";

import {
  resolveUetdsMinistryEndpoint,
  resolveUetdsMinistryRuntime,
  UETDS_NS,
  type UETDS_SOAP_ACTIONS,
} from "@/lib/uetds/ministry-env";

export type UetdsSoapResult = {
  sonucKodu: number | null;
  sonucMesaji: string;
  values: Record<string, string>;
  rawSafe: string;
  xml?: string;
};

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function redactSecrets(value: string) {
  return value
    .replace(/<sifre>[^<]*<\/sifre>/gi, "<sifre>***</sifre>")
    .replace(/<kullaniciAdi>[^<]*<\/kullaniciAdi>/gi, "<kullaniciAdi>***</kullaniciAdi>")
    .replace(/Authorization:\s*Basic\s+\S+/gi, "Authorization: Basic ***");
}

function localName(tag: string) {
  return tag.replace(/^.*:/, "").toLowerCase();
}

export function parseUetdsSoapResult(xml: string): UetdsSoapResult {
  const values: Record<string, string> = {};
  const tagRe = /<([A-Za-z0-9_.:]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(xml))) {
    const name = localName(match[1] ?? "");
    const text = (match[2] ?? "").trim();
    if (!name || !text) {
      continue;
    }
    if (!(name in values)) {
      values[name] = text;
    }
  }
  const sonucKoduRaw = values.sonuckodu;
  const sonucKodu = sonucKoduRaw != null && /^-?\d+$/.test(sonucKoduRaw) ? Number(sonucKoduRaw) : null;
  return {
    sonucKodu,
    sonucMesaji: values.sonucmesaji ?? "",
    values,
    rawSafe: redactSecrets(xml).slice(0, 4000),
  };
}

export function soapUserXml(username: string, password: string) {
  return `<wsuser><kullaniciAdi>${xmlEscape(username)}</kullaniciAdi><sifre>${xmlEscape(password)}</sifre></wsuser>`;
}

export function soapField(name: string, value: string | number) {
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

export async function callUetdsTestSoap(input: {
  operation: keyof typeof UETDS_SOAP_ACTIONS;
  soapAction: string;
  innerXml: string;
  username: string;
  password: string;
  keepXml?: boolean;
  timeoutMs?: number;
}): Promise<UetdsSoapResult> {
  const endpoint = resolveUetdsMinistryEndpoint();
  if (!input.username.trim() || !input.password.trim()) {
    throw new Error("uetds_credentials_missing");
  }
  const runtime = resolveUetdsMinistryRuntime();
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:uet="${UETDS_NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <uet:${input.operation}>
      ${input.innerXml}
    </uet:${input.operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
  const auth = Buffer.from(`${input.username}:${input.password}`, "utf8").toString("base64");
  let responseText = "";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: input.timeoutMs ? AbortSignal.timeout(input.timeoutMs) : undefined,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${input.soapAction}"`,
        Authorization: `Basic ${auth}`,
      },
      body: envelope,
    });
    responseText = await response.text();
  } catch {
    return {
      sonucKodu: null,
      sonucMesaji:
        runtime === "live" ? "U-ETDS servisine bağlanılamadı." : "U-ETDS TEST servisine bağlanılamadı.",
      values: {},
      rawSafe: "",
    };
  } finally {
    envelope.replace(input.password, "***");
  }
  const parsed = parseUetdsSoapResult(responseText);
  return input.keepXml ? { ...parsed, xml: responseText } : parsed;
}
