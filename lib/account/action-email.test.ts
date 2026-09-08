import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAccountActionEmail } from "@/lib/account/action-email";

test("password reset email is localized and escapes its link", () => {
  const tr = buildAccountActionEmail(
    "tr",
    "password_reset",
    "https://tripetica.com/tr/account/reset-password?token=a&next=b",
  );
  assert.match(tr.subject, /Şifrenizi sıfırlayın/);
  assert.match(tr.text, /Şifremi sıfırla/);
  assert.match(tr.html, /token=a&amp;next=b/);

  const ru = buildAccountActionEmail("ru", "password_reset", "https://example.com/reset");
  assert.match(ru.subject, /Сброс пароля/);
});

test("email-change message uses locale-specific confirmation copy", () => {
  const en = buildAccountActionEmail("en", "email_change", "https://example.com/verify");
  assert.match(en.subject, /Confirm your new email/);
  assert.match(en.text, /Confirm my new email/);
  assert.match(en.text, /ignore this email/);
});
