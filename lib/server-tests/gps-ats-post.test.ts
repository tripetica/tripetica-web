import assert from "node:assert/strict";
import test from "node:test";
import { atsFaultSocketOpen, atsLiveDispatchAllowed, postAtsArizaBildir, postAtsKonumBildir } from "@/lib/uetds/ats-post";

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

test("atsArizaBildir uses the konum live gate and stays closed without it", async () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    EXPECTED_DATABASE: process.env.EXPECTED_DATABASE,
    ATS_MINISTRY_DISPATCH: process.env.ATS_MINISTRY_DISPATCH,
    ATS_LIVE_DISPATCH: process.env.ATS_LIVE_DISPATCH,
  };
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = "production";
    env.EXPECTED_DATABASE = "tripetica";
    env.ATS_MINISTRY_DISPATCH = "withheld";
    delete env.ATS_LIVE_DISPATCH;
    assert.equal(atsLiveDispatchAllowed(), false);
    assert.equal(atsFaultSocketOpen(), false);
    await assert.rejects(
      () => postAtsArizaBildir({
        username: "not-sent",
        password: "not-sent",
        plate: "34EGP847",
        arizaBaslangicTarihi: "19/10/2026 23:15:00",
        aciklama: "not sent",
      }),
      /ats_fault_withheld/,
    );
    env.ATS_LIVE_DISPATCH = "approved";
    assert.equal(atsFaultSocketOpen(), true);
    assert.equal(atsLiveDispatchAllowed(), true);
    env.ATS_MINISTRY_DISPATCH = "allow-test";
    assert.equal(atsFaultSocketOpen(), false);
    env.NODE_ENV = "development";
    env.EXPECTED_DATABASE = "tripetica_dev";
    env.ATS_MINISTRY_DISPATCH = "withheld";
    env.ATS_LIVE_DISPATCH = "approved";
    assert.equal(atsFaultSocketOpen(), false);
  } finally {
    restore();
  }
});
