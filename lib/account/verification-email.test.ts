import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVerificationEmail } from "@/lib/account/verification-email";

test("verification email is localized and includes CTA + link + ignore notice", () => {
  const link = "https://tripetica.com/tr/account/verify?token=abc";

  const tr = buildVerificationEmail("tr", link);
  assert.match(tr.subject, /doğrulayın/i);
  assert.match(tr.html, /E-posta adresimi doğrula/);
  assert.match(tr.html, /href="https:\/\/tripetica\.com\/tr\/account\/verify\?token=abc"/);
  assert.match(tr.text, /dikkate almayın/);
  assert.ok(tr.text.includes(link));

  const en = buildVerificationEmail("en", link);
  assert.match(en.subject, /Verify your email/i);
  assert.match(en.html, /Verify my email/);
  assert.match(en.text, /ignore this email/i);

  const ru = buildVerificationEmail("ru", link);
  assert.match(ru.subject, /Подтвердите/);
  assert.match(ru.html, /Подтвердить email/);
  assert.match(ru.text, /проигнорируйте/);
});
