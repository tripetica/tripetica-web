import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUetdsPersonName,
  repairUetdsExtractedPersonNames,
  splitUetdsFullPersonName,
} from "@/lib/uetds/passenger-name";

test("particle-aware split keeps multi-word surnames like da Silva", () => {
  assert.deepEqual(splitUetdsFullPersonName("Elton Portela da Silva"), {
    firstName: "Elton Portela",
    lastName: "da Silva",
  });
  assert.deepEqual(splitUetdsFullPersonName("Lilian Pinheiro da Silva"), {
    firstName: "Lilian Pinheiro",
    lastName: "da Silva",
  });
  assert.deepEqual(splitUetdsFullPersonName("Ludwig van Beethoven"), {
    firstName: "Ludwig",
    lastName: "van Beethoven",
  });
  assert.deepEqual(splitUetdsFullPersonName("Ahmed bin Ali"), {
    firstName: "Ahmed",
    lastName: "bin Ali",
  });
});

test("split without particle uses last token as surname", () => {
  assert.deepEqual(splitUetdsFullPersonName("John Smith"), {
    firstName: "John",
    lastName: "Smith",
  });
  assert.deepEqual(splitUetdsFullPersonName("Mary Ann Smith"), {
    firstName: "Mary Ann",
    lastName: "Smith",
  });
});

test("single-token names do not invent a surname", () => {
  assert.deepEqual(splitUetdsFullPersonName("Madonna"), {
    firstName: "Madonna",
    lastName: "",
  });
  assert.deepEqual(repairUetdsExtractedPersonNames({ firstName: "Madonna", lastName: null }), {
    firstName: "Madonna",
    lastName: undefined,
  });
  assert.deepEqual(repairUetdsExtractedPersonNames({ firstName: "Madonna", lastName: "" }), {
    firstName: "Madonna",
    lastName: undefined,
  });
});

test("repair only when lastName empty; never overwrite structured surname", () => {
  assert.deepEqual(
    repairUetdsExtractedPersonNames({
      firstName: "Elton Portela da Silva",
      lastName: null,
    }),
    { firstName: "Elton Portela", lastName: "da Silva" },
  );
  assert.deepEqual(
    repairUetdsExtractedPersonNames({
      firstName: "Elton Portela",
      lastName: "da Silva",
    }),
    { firstName: "Elton Portela", lastName: "da Silva" },
  );
  // Mis-split AI output with a non-empty lastName is left alone (do not re-cut).
  assert.deepEqual(
    repairUetdsExtractedPersonNames({
      firstName: "Elton Portela da Silva",
      lastName: "Ignored",
    }),
    { firstName: "Elton Portela da Silva", lastName: "Ignored" },
  );
});

test("normalize still transliterates without changing Latin names", () => {
  assert.equal(normalizeUetdsPersonName("Алексей"), "Aleksey");
  assert.equal(normalizeUetdsPersonName("Çiğdem"), "Çiğdem");
});
