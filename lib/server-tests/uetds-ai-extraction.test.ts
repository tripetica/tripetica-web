import test from "node:test";
import assert from "node:assert/strict";
import { istanbulLocalToUtcMs } from "../booking/istanbul-time";
import { extractAiUetdsDocument } from "../uetds/ai-extraction";
import { AiExtractionError, mapAiUetdsExtraction, mergeAiUetdsExtraction, UETDS_AI_EXTRACTION_SCHEMA } from "../uetds/ai-extraction-schema";
import { createEmptyDraft, createPassengerDraft } from "../uetds/draft";

const empty = {
  origin: null, destination: null, startDate: null, startTime: null, endDate: null, endTime: null,
  tripKind: null, purpose: null, fare: null, flightCode: null, passengers: [],
};
const passenger = {
  firstName: "Fixture",
  lastName: "Passenger",
  nationality: "LY",
  identityNumber: null,
  gender: "male",
};

test("canonical date/fare validation and required nationality/gender mapping", () => {
  const mapped = mapAiUetdsExtraction({ ...empty, passengers: [passenger] });
  assert.equal(mapped.passengers?.[0].nationality, "LY");
  assert.equal(mapped.passengers?.[0].gender, "male");
  assert.equal(mapped.passengers?.[0].identityNumber, "11111111111");
  assert.equal(mapped.startDate, undefined);
  const dated = mapAiUetdsExtraction({ ...empty, startDate: "2026-09-20", startTime: "17:30", endDate: "2026-02-30", endTime: "25:00", fare: "0", flightCode: "XX123" });
  assert.equal(dated.startDate, "2026-09-20");
  assert.equal(dated.startTime, "17:30");
  assert.equal(dated.endDate, undefined);
  assert.equal(dated.endTime, undefined);
  assert.equal(dated.fare, "0");
  assert.equal(dated.purpose, "Uçuş: XX123");
  assert.equal(mapAiUetdsExtraction({ ...empty, startDate: "20 Sep" }).startDate, undefined);
  assert.throws(() => mapAiUetdsExtraction({ ...empty, unknown: "injected" }), AiExtractionError);
  assert.throws(() => mapAiUetdsExtraction({ ...empty, passengers: [{ ...passenger, gender: "guess" }] }), AiExtractionError);
  assert.throws(() => mapAiUetdsExtraction({ ...empty, passengers: [{ ...passenger, gender: null }] }), AiExtractionError);
  assert.throws(() => mapAiUetdsExtraction({ ...empty, passengers: [{ ...passenger, nationality: null }] }), AiExtractionError);
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.nationality.description,
    /jointly weighing given name\/surname plus any visible phone numbers/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.nationality.description,
    /fall back to name-only inference/,
  );
  assert.match(UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.gender.description, /always infer/);
  assert.deepEqual(UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.gender.enum, ["male", "female"]);
});

test("AI identity placeholder and inferred nationality/gender fill the form without overwriting explicit user values", () => {
  const draft = createEmptyDraft("manual");
  const mapped = mapAiUetdsExtraction({
    ...empty,
    passengers: [
      passenger,
      { ...passenger, firstName: "Ayşe", lastName: "Yılmaz", nationality: "Türkiye", gender: "female", identityNumber: "FIXTURE-ONLY" },
    ],
  });
  const merged = mergeAiUetdsExtraction(draft, mapped).draft;
  assert.equal(merged.passengers[0].identityNumber, "11111111111");
  assert.equal(merged.passengers[0].provenance.identityNumber, "suggested");
  assert.equal(merged.passengers[0].nationality, "LY");
  assert.equal(merged.passengers[0].gender, "male");
  assert.equal(merged.passengers[1].identityNumber, "FIXTURE-ONLY");
  assert.equal(merged.passengers[1].nationality, "TR");
  assert.equal(merged.passengers[1].gender, "female");
  merged.passengers[0].gender = "female";
  merged.passengers[0].provenance.gender = "user";
  merged.passengers[0].nationality = "TR";
  merged.passengers[0].provenance.nationality = "user";
  merged.passengers[0].identityNumber = "EXISTING-FIXTURE";
  merged.passengers[0].provenance.identityNumber = "document";
  const repeated = mergeAiUetdsExtraction(merged, mapped).draft;
  assert.equal(repeated.passengers[0].gender, "female");
  assert.equal(repeated.passengers[0].nationality, "TR");
  assert.equal(repeated.passengers[0].identityNumber, "EXISTING-FIXTURE");
  assert.equal(createPassengerDraft().gender, "female", "manual default remains unchanged");
});

test("AI merge applies deterministic +65 start / +3h end without inventing identity", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const draft = createEmptyDraft("manual", { applyTripDefaults: false });
  const mapped = mapAiUetdsExtraction({
    ...empty,
    passengers: [passenger],
  });
  const merged = mergeAiUetdsExtraction(draft, mapped, now).draft;
  assert.equal(merged.startDate, "2026-09-20");
  assert.equal(merged.startTime, "11:05");
  assert.equal(merged.endDate, "2026-09-20");
  assert.equal(merged.endTime, "14:05");
  assert.equal(merged.passengers[0].identityNumber, "11111111111");
  const withShortEnd = mergeAiUetdsExtraction(
    draft,
    mapAiUetdsExtraction({
      ...empty,
      startDate: "2026-09-20",
      startTime: "15:05",
      endDate: "2026-09-20",
      endTime: "17:05",
      passengers: [passenger],
    }),
    now,
  ).draft;
  assert.equal(withShortEnd.startTime, "15:05");
  assert.equal(withShortEnd.endTime, "18:05");
});

test("AI merge keeps two same-surname passengers with different passport numbers", () => {
  const draft = createEmptyDraft("manual");
  const mapped = mapAiUetdsExtraction({
    ...empty,
    passengers: [
      {
        firstName: "ABDIRAHMAN M",
        lastName: "MUKHTAR",
        nationality: "US",
        identityNumber: "657507398",
        gender: "male",
      },
      {
        firstName: "MALYUN ABOW",
        lastName: "MUKHTAR",
        nationality: "US",
        identityNumber: "A50646720",
        gender: "female",
      },
    ],
  });
  assert.equal(mapped.passengers?.length, 2);
  const merged = mergeAiUetdsExtraction(draft, mapped).draft;
  assert.equal(merged.passengers.length, 2);
  assert.equal(merged.passengers[0]?.lastName, "MUKHTAR");
  assert.equal(merged.passengers[1]?.lastName, "MUKHTAR");
  assert.equal(merged.passengers[0]?.identityNumber, "657507398");
  assert.equal(merged.passengers[1]?.identityNumber, "A50646720");
  assert.equal(merged.passengers[0]?.gender, "male");
  assert.equal(merged.passengers[1]?.gender, "female");
  assert.equal(merged.passengers[0]?.nationality, "US");
  assert.equal(merged.passengers[1]?.nationality, "US");
});

test("AI mapping repairs full-name-in-firstName empty-surname for Brazilian particle names", () => {
  // Simulates the intermittent model failure: entire full name in firstName, lastName null.
  const mapped = mapAiUetdsExtraction({
    ...empty,
    fare: "50",
    passengers: [
      {
        firstName: "Elton Portela da Silva",
        lastName: null,
        nationality: "Brazil",
        identityNumber: "GA836860",
        gender: "male",
      },
      {
        firstName: "Lilian Pinheiro da Silva",
        lastName: null,
        nationality: "Brazil",
        identityNumber: "GD492213",
        gender: "female",
      },
    ],
  });
  assert.equal(mapped.passengers?.length, 2);
  assert.equal(mapped.passengers?.[0]?.firstName, "Elton Portela");
  assert.equal(mapped.passengers?.[0]?.lastName, "da Silva");
  assert.equal(mapped.passengers?.[0]?.identityNumber, "GA836860");
  assert.equal(mapped.passengers?.[0]?.nationality, "BR");
  assert.equal(mapped.passengers?.[1]?.firstName, "Lilian Pinheiro");
  assert.equal(mapped.passengers?.[1]?.lastName, "da Silva");
  assert.equal(mapped.passengers?.[1]?.identityNumber, "GD492213");
  assert.equal(mapped.passengers?.[1]?.nationality, "BR");

  const merged = mergeAiUetdsExtraction(createEmptyDraft("manual"), mapped).draft;
  assert.equal(merged.passengers.length, 2);
  assert.equal(merged.passengers[0]?.firstName, "Elton Portela");
  assert.equal(merged.passengers[0]?.lastName, "da Silva");
  assert.equal(merged.passengers[0]?.identityNumber, "GA836860");
  assert.equal(merged.passengers[1]?.firstName, "Lilian Pinheiro");
  assert.equal(merged.passengers[1]?.lastName, "da Silva");
  assert.equal(merged.passengers[1]?.identityNumber, "GD492213");
});

test("AI merge preserves a partial second passenger with placeholder identity", () => {
  const draft = createEmptyDraft("manual");
  const mapped = mapAiUetdsExtraction({
    ...empty,
    passengers: [
      {
        firstName: "ABDIRAHMAN M",
        lastName: "MUKHTAR",
        nationality: "US",
        identityNumber: "657507398",
        gender: "male",
      },
      {
        firstName: "MALYUN ABOW",
        lastName: "MUKHTAR",
        nationality: "US",
        identityNumber: null,
        gender: "female",
      },
    ],
  });
  const merged = mergeAiUetdsExtraction(draft, mapped).draft;
  assert.equal(merged.passengers.length, 2);
  assert.equal(merged.passengers[1]?.firstName, "MALYUN ABOW");
  assert.equal(merged.passengers[1]?.identityNumber, "11111111111");
  assert.equal(merged.passengers[1]?.provenance.identityNumber, "suggested");
});

test("Responses SDK sends one strict request for text/images/PDF and never falls back or retries", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "fixture-not-a-real-key";
  let calls = 0;
  let mode: "ok" | "model" | "refusal" | "incomplete" = "ok";
  let unblock: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-5.6-luna");
    assert.equal(body.store, false);
    assert.deepEqual(body.tools, []);
    assert.equal(body.text.format.strict, true);
    assert.deepEqual(body.text.format.schema, UETDS_AI_EXTRACTION_SCHEMA);
    assert.deepEqual(body.input[0].content.map((item: { type: string }) => item.type), ["input_text", "input_image", "input_file"]);
    assert.equal(body.input[0].content[2].filename, "document-2.pdf");
    assert.ok(init?.signal);
    if (gate) await gate;
    if (mode === "model") return new Response(JSON.stringify({ error: { message: "upstream-sensitive-text", type: "invalid_request_error", code: "model_not_found" } }), { status: 404, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ id: "resp_fixture", object: "response", status: mode === "incomplete" ? "incomplete" : "completed", output: [{ id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: mode === "refusal" ? [{ type: "refusal", refusal: "fixture" }] : [{ type: "output_text", text: JSON.stringify({ ...empty, passengers: [passenger] }), annotations: [] }] }] }), { headers: { "content-type": "application/json" } });
  };
  const input = { text: "Synthetic fixture only", files: [
    new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "private-original.png", { type: "image/png" }),
    new File(["%PDF-1.7\nfixture"], "private-original.pdf", { type: "application/pdf" }),
  ] };
  try {
    const result = await extractAiUetdsDocument(input, "fixture-actor");
    assert.equal(result.passengers?.[0].firstName, "Fixture");
    assert.equal(calls, 1);
    mode = "model";
    await assert.rejects(extractAiUetdsDocument(input, "fixture-actor"), { message: "model-unavailable" });
    assert.equal(calls, 2);
    mode = "refusal";
    await assert.rejects(extractAiUetdsDocument(input, "fixture-actor"), { message: "failed" });
    mode = "incomplete";
    await assert.rejects(extractAiUetdsDocument(input, "fixture-actor"), { message: "failed" });
    mode = "ok";
    gate = new Promise<void>(resolve => { unblock = resolve; });
    const first = extractAiUetdsDocument(input, "fixture-actor");
    await assert.rejects(extractAiUetdsDocument(input, "fixture-actor"), { message: "busy" });
    unblock!();
    await first;
    assert.equal(calls, 5);
    await assert.rejects(extractAiUetdsDocument({ text: "", files: [] }, "fixture-actor"), { message: "invalid" });
    await assert.rejects(extractAiUetdsDocument({ text: "x".repeat(30_001), files: [] }, "fixture-actor"), { message: "too-large" });
    await assert.rejects(extractAiUetdsDocument({ text: "", files: [new File(["x"], "x.pdf", { type: "text/plain" })] }, "fixture-actor"), { message: "unsupported-type" });
    await assert.rejects(extractAiUetdsDocument({ text: "", files: [new File(["invalid"], "x.pdf", { type: "application/pdf" })] }, "fixture-actor"), { message: "invalid" });
    assert.equal(calls, 5);
    globalThis.fetch = async () => { calls++; throw new DOMException("fixture", "AbortError"); };
    await assert.rejects(extractAiUetdsDocument(input, "fixture-actor"), { message: "timeout" });
    assert.equal(calls, 6);
  } finally {
    unblock?.();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("all seven source combinations use one request and preserve canonical prefill", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  const pdf = new File(["%PDF-1.7\nsynthetic"], "fixture.pdf", { type: "application/pdf" });
  const image = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "fixture.png", { type: "image/png" });
  let expected: string[] = [];
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.input[0].content.map((part: { type: string }) => part.type), expected);
    assert.match(body.instructions, /complementary sources for ONE reservation trip/);
    assert.match(body.instructions, /return null for the disputed field/);
    assert.match(body.instructions, /jointly weighing all meaningful clues/);
    assert.match(body.instructions, /phone numbers and country\/area dialing codes/);
    assert.match(body.instructions, /fall back to the most likely nationality from the name alone/);
    assert.match(body.instructions, /Do not treat any single indirect signal/);
    assert.match(body.instructions, /infer the most likely gender from the passenger's given name and surname only/);
    assert.doesNotMatch(body.instructions, /Never infer nationality or gender from a person's name/);
    assert.match(body.instructions, /U-ETDS ministry form language rules/);
    assert.match(body.instructions, /NEVER translate into Turkish/);
    assert.match(body.instructions, /TRANSLATE into natural Turkish/);
    assert.match(body.instructions, /Never invent ministry il\/ilçe|Never invent province\/district/);
    assert.match(body.instructions, /Ops and Partner/);
    assert.match(body.instructions, /Each distinct passport or ID document/);
    assert.match(body.instructions, /ONLY when the explicit identity\/passport number is the same/);
    assert.match(body.instructions, /Same surname, same nationality/);
    assert.match(body.instructions, /Never silently omit a hard-to-read second passport/);
    assert.doesNotMatch(body.instructions, /list each person once across duplicated pages\/images/);
    assert.doesNotMatch(body.instructions, /not separate passenger lists per source/);
    return new Response(JSON.stringify({ id: "resp_fixture", object: "response", status: "completed", output: [{ id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ ...empty, passengers: [{ ...passenger, nationality: "LY", gender: "male" }] }), annotations: [] }] }] }), { headers: { "content-type": "application/json" } });
  };
  try {
    for (let mask = 1; mask < 8; mask++) {
      const files = [...(mask & 1 ? [pdf] : []), ...(mask & 2 ? [image] : [])];
      const text = mask & 4 ? "Synthetic reservation: all listed passengers are Libyan and male." : "";
      expected = [...(text ? ["input_text"] : []), ...(mask & 1 ? ["input_file"] : []), ...(mask & 2 ? ["input_image"] : [])];
      const result = await extractAiUetdsDocument({ files, text }, "hybrid-fixture");
      assert.equal(calls, mask);
      const merged = mergeAiUetdsExtraction(createEmptyDraft("manual"), result).draft;
      assert.equal(merged.passengers[0].nationality, "LY");
      assert.equal(merged.passengers[0].gender, "male");
      assert.equal(merged.passengers[0].identityNumber, "11111111111");
    }
    await assert.rejects(extractAiUetdsDocument({ files: [], text: " " }, "hybrid-fixture"), { message: "invalid" });
    assert.equal(calls, 7);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
