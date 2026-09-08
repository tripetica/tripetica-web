import { VOICE_ALERT_TWIML } from "@/lib/alerts/voice-alert-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twimlResponse() {
  return new Response(VOICE_ALERT_TWIML, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function GET() {
  return twimlResponse();
}

export function POST() {
  return twimlResponse();
}
