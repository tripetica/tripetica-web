import test from "node:test";
import assert from "node:assert/strict";
import {
  foldUetdsPersonNameToEnglishAscii,
  normalizeUetdsExtractedPersonName,
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

test("ministry normalize still transliterates without ASCII-folding Turkish letters", () => {
  assert.equal(normalizeUetdsPersonName("Алексей"), "Aleksey");
  assert.equal(normalizeUetdsPersonName("Çiğdem"), "Çiğdem");
});

test("AI extracted names fold to English ASCII A-Z/a-z", () => {
  assert.equal(normalizeUetdsExtractedPersonName("Højris Louens"), "Hojris Louens");
  assert.equal(normalizeUetdsExtractedPersonName("Østergaard"), "Ostergaard");
  assert.equal(normalizeUetdsExtractedPersonName("Müller"), "Muller");
  assert.equal(normalizeUetdsExtractedPersonName("François"), "Francois");
  assert.equal(normalizeUetdsExtractedPersonName("García"), "Garcia");
  assert.equal(normalizeUetdsExtractedPersonName("Şahin"), "Sahin");
  assert.equal(normalizeUetdsExtractedPersonName("Çelik"), "Celik");
  assert.equal(normalizeUetdsExtractedPersonName("İpek"), "Ipek");
  assert.equal(normalizeUetdsExtractedPersonName("Öztürk"), "Ozturk");
  assert.equal(normalizeUetdsExtractedPersonName("Ünal"), "Unal");
  assert.equal(normalizeUetdsExtractedPersonName("Ğüneş"), "Gunes");
  assert.equal(normalizeUetdsExtractedPersonName("Ægir"), "Aegir");
  assert.equal(normalizeUetdsExtractedPersonName("Œuvre"), "Oeuvre");
  assert.equal(normalizeUetdsExtractedPersonName("Łukasz"), "Lukasz");
  assert.equal(normalizeUetdsExtractedPersonName("Đorđe"), "Dorde");
  assert.equal(normalizeUetdsExtractedPersonName("Þor"), "Thor");
  assert.equal(normalizeUetdsExtractedPersonName("Groß"), "Gross");
  assert.equal(normalizeUetdsExtractedPersonName("Anne Sofie"), "Anne Sofie");
  assert.equal(foldUetdsPersonNameToEnglishAscii("Holm Olsen"), "Holm Olsen");
});

test("AI repair folds Højris Louens and keeps particle splits", () => {
  assert.deepEqual(
    repairUetdsExtractedPersonNames({ firstName: "Højris", lastName: "Louens" }),
    { firstName: "Hojris", lastName: "Louens" },
  );
  assert.deepEqual(
    repairUetdsExtractedPersonNames({
      firstName: "Elton Portela da Silva",
      lastName: null,
    }),
    { firstName: "Elton Portela", lastName: "da Silva" },
  );
  assert.deepEqual(
    repairUetdsExtractedPersonNames({
      firstName: "Lilian Pinheiro da Silva",
      lastName: null,
    }),
    { firstName: "Lilian Pinheiro", lastName: "da Silva" },
  );
});

test("hyphen and apostrophe in AI names are preserved as ASCII separators", () => {
  assert.equal(normalizeUetdsExtractedPersonName("Jean-Pierre"), "Jean-Pierre");
  assert.equal(normalizeUetdsExtractedPersonName("O'Connor"), "O'Connor");
  assert.equal(normalizeUetdsExtractedPersonName("O’Connor"), "O'Connor");
});
