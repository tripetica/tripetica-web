import assert from "node:assert/strict";
import test from "node:test";
import { postAtsKonumBildir } from "@/lib/uetds/ats-post";

test("ATS konum post refuses before opening a ministry socket", async () => {
  const previous = process.env.ATS_MINISTRY_DISPATCH;
  delete process.env.ATS_MINISTRY_DISPATCH;
  try {
    await assert.rejects(
      () => postAtsKonumBildir({
        username: "not-sent",
        password: "not-sent",
        plate: "34EGP847",
        latitude: 41,
        longitude: 29,
        ilKodu: 34,
        ilceMernisKodu: 2053,
        konumZamani: "08/10/2026 12:00:00",
      }),
      /ats_dispatch_withheld/,
    );
  } finally {
    if (previous === undefined) delete process.env.ATS_MINISTRY_DISPATCH;
    else process.env.ATS_MINISTRY_DISPATCH = previous;
  }
});
