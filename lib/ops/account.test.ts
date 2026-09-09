import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("ops self-account updates never take a target user id from the client", () => {
  const actions = source("lib/ops/account-actions.ts");
  const store = source("lib/ops/account.ts");
  const form = source("components/ops/account-form.tsx");
  assert.match(actions, /actorId: actor\.id/);
  assert.doesNotMatch(actions, /formData\.get\(["']id["']\)/);
  assert.doesNotMatch(actions, /formData\.get\(["']userId["']\)/);
  assert.doesNotMatch(actions, /formData\.get\(["']user_id["']\)/);
  assert.match(store, /WHERE id = \$1/);
  assert.match(store, /actorId/);
  assert.doesNotMatch(form, /name="id"/);
  assert.doesNotMatch(form, /name="userId"/);
  assert.match(store, /verifyPassword\(input\.currentPassword/);
  assert.match(store, /hashPassword\(input\.newPassword\)/);
  assert.doesNotMatch(store, /console\.(log|info|debug|error).*password/);
  assert.match(actions, /redirect\(localizedPath\(locale, "\/ops\/login"\)\)/);
  assert.doesNotMatch(actions, /\/ops\/users/);
  assert.match(actions, /createOpsSession\(actor\.id\)/);
  assert.match(store, /deleteOpsSessionsForUser\(input\.actorId\)/);
  assert.doesNotMatch(store, /SET created_at/);
});

test("ops account page is self-service and separate from panel users", () => {
  const page = source("app/[locale]/ops/(panel)/account/page.tsx");
  const users = source("app/[locale]/ops/(panel)/users/page.tsx");
  assert.match(page, /requireOpsPage\(locale\)/);
  assert.doesNotMatch(page, /users\.manage|users\.view/);
  assert.match(users, /copy\.users/);
  assert.match(users, /users\.view/);
  assert.match(source("lib/ops/nav.ts"), /\/ops\/users/);
  assert.match(source("lib/ops/nav.ts"), /\/ops\/account/);
});
