import assert from "node:assert/strict";
import test from "node:test";

import { appendUetdsImageFiles, isSameUetdsUploadFile } from "@/lib/uetds/upload-files";
import { UETDS_MAX_IMAGE_COUNT } from "@/lib/uetds/upload-limits";

function file(name: string, size = 10, lastModified = 1_700_000_000_000) {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: "image/jpeg", lastModified });
}

test("appendUetdsImageFiles appends sequential picks and skips true duplicates", () => {
  const first = file("passport-a.jpg", 100, 11);
  const second = file("passport-b.jpg", 200, 22);
  const dup = file("passport-a.jpg", 100, 11);
  const differentContentSameName = file("passport-a.jpg", 101, 11);

  const afterFirst = appendUetdsImageFiles([], [first]);
  assert.equal(afterFirst.length, 1);
  assert.equal(afterFirst[0]?.name, "passport-a.jpg");

  const afterSecond = appendUetdsImageFiles(afterFirst, [second]);
  assert.equal(afterSecond.length, 2);
  assert.deepEqual(
    afterSecond.map((item) => item.name),
    ["passport-a.jpg", "passport-b.jpg"],
  );

  const afterDup = appendUetdsImageFiles(afterSecond, [dup]);
  assert.equal(afterDup.length, 2);
  assert.ok(isSameUetdsUploadFile(afterDup[0]!, dup));

  const afterSimilarName = appendUetdsImageFiles(afterDup, [differentContentSameName]);
  assert.equal(afterSimilarName.length, 3);
  assert.equal(afterSimilarName[2]?.size, 101);
});

test("appendUetdsImageFiles respects UETDS_MAX_IMAGE_COUNT", () => {
  const current = Array.from({ length: UETDS_MAX_IMAGE_COUNT }, (_, index) =>
    file(`existing-${index}.jpg`, 10 + index, 1_000 + index),
  );
  const next = appendUetdsImageFiles(current, [file("overflow.jpg", 999, 9_999)]);
  assert.equal(next.length, UETDS_MAX_IMAGE_COUNT);
  assert.equal(next.at(-1)?.name, `existing-${UETDS_MAX_IMAGE_COUNT - 1}.jpg`);
});

test("notification form appends image picks via appendUetdsImageFiles", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const form = fs.readFileSync(
    path.join(process.cwd(), "components/uetds/uetds-notification-form.tsx"),
    "utf8",
  );
  assert.match(form, /appendUetdsImageFiles/);
  assert.match(form, /setImageFiles\(\(current\) => appendUetdsImageFiles\(current, files/);
  assert.doesNotMatch(form, /else setImageFiles\(files\);/);
});
