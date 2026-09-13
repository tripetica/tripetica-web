import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTwilioCallRequest,
  readTwilioVoiceConfig,
  startTwilioVoiceCall,
} from "@/lib/alerts/twilio-voice";
import { VOICE_ALERT_TWIML } from "@/lib/alerts/voice-alert-policy";

const validEnv = {
  TWILIO_ACCOUNT_SID: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  TWILIO_API_KEY_SID: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  TWILIO_API_SECRET: "test-secret",
  TWILIO_FROM_NUMBER: "+15551234567",
  TWILIO_ALERT_TO_NUMBER: "+15557654321",
};

test("reads API key SID or TWILIO_API_KEY alias and rejects incomplete config", () => {
  assert.equal(readTwilioVoiceConfig({}), null);
  assert.ok(readTwilioVoiceConfig(validEnv));
  assert.ok(
    readTwilioVoiceConfig({
      ...validEnv,
      TWILIO_API_KEY_SID: "",
      TWILIO_API_KEY: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    }),
  );
  assert.equal(
    readTwilioVoiceConfig({
      ...validEnv,
      TWILIO_ALERT_TO_NUMBER: "5557654321",
    }),
    null,
  );
});

test("Twilio request uses Hangup TwiML and does not embed a conversation", () => {
  const request = buildTwilioCallRequest(readTwilioVoiceConfig(validEnv)!);
  const params = new URLSearchParams(request.body);
  assert.equal(params.get("Twiml"), VOICE_ALERT_TWIML);
  assert.equal(params.get("Timeout"), "20");
  assert.match(request.url, /\/Calls\.json$/);
  assert.doesNotMatch(request.body, /Say|Gather|Play/);
});

test("Twilio request can send assignment-alarm Say TwiML without changing Hangup default", () => {
  const config = readTwilioVoiceConfig(validEnv)!;
  const hangup = new URLSearchParams(buildTwilioCallRequest(config).body);
  assert.equal(hangup.get("Twiml"), VOICE_ALERT_TWIML);

  const spoken = new URLSearchParams(
    buildTwilioCallRequest(config, {
      twiml: '<Response><Say language="tr-TR">Test</Say></Response>',
    }).body,
  );
  assert.equal(
    spoken.get("Twiml"),
    '<Response><Say language="tr-TR">Test</Say></Response>',
  );
});

test("startTwilioVoiceCall treats HTTP and missing SID as failure", async () => {
  const config = readTwilioVoiceConfig(validEnv)!;
  const ok = await startTwilioVoiceCall(config, async () =>
    new Response(JSON.stringify({ sid: "CAcccccccccccccccccccccccccccccccc" }), {
      status: 201,
    }),
  );
  assert.deepEqual(ok, { ok: true, callSid: "CAcccccccccccccccccccccccccccccccc" });

  const failed = await startTwilioVoiceCall(config, async () =>
    new Response(JSON.stringify({ message: "nope" }), { status: 400 }),
  );
  assert.deepEqual(failed, { ok: false, error: "twilio_400" });
});
