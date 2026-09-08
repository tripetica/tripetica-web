import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partnerCopy } from "@/lib/partner/copy";
import { partnerRegisterUiPhase } from "@/lib/partner/register-gate";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("register UI stays on email until a code is sent for that address", () => {
  assert.deepEqual(
    partnerRegisterUiPhase({
      currentEmail: "a@example.com",
      verifiedEmail: "",
      challengeEmail: "",
      codeSent: false,
    }),
    { emailVerified: false, showSend: true, showCode: false, showForm: false },
  );
  assert.deepEqual(
    partnerRegisterUiPhase({
      currentEmail: "a@example.com",
      verifiedEmail: "",
      challengeEmail: "a@example.com",
      codeSent: true,
    }),
    { emailVerified: false, showSend: true, showCode: true, showForm: false },
  );
});

test("register application fields open only after the current email is verified", () => {
  assert.deepEqual(
    partnerRegisterUiPhase({
      currentEmail: "a@example.com",
      verifiedEmail: "a@example.com",
      challengeEmail: "a@example.com",
      codeSent: true,
    }),
    { emailVerified: true, showSend: false, showCode: false, showForm: true },
  );
  assert.deepEqual(
    partnerRegisterUiPhase({
      currentEmail: "b@example.com",
      verifiedEmail: "a@example.com",
      challengeEmail: "a@example.com",
      codeSent: true,
    }),
    { emailVerified: false, showSend: true, showCode: false, showForm: false },
  );
});

test("register form gates the application fields behind verified email", () => {
  const form = source("components/partner/register-form.tsx");
  assert.match(form, /partnerRegisterUiPhase/);
  assert.match(form, /phase\.showForm/);
  assert.match(form, /phase\.showCode/);
  assert.match(form, /copy\.emailVerifiedBadge/);
  assert.match(form, /verifiedEmail/);
  assert.match(form, /autoComplete="one-time-code"/);
  assert.doesNotMatch(form, /codeSent \|\| emailVerified/);
  assert.equal(partnerCopy.tr.emailVerifiedBadge, "Doğrulandı");
  assert.equal(partnerCopy.en.emailVerifiedBadge, "Verified");
  assert.equal(partnerCopy.ru.emailVerifiedBadge, "Подтверждено");
});
