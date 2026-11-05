import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("new partner logins are owners and do not seed an allow-list", () => {
  const register = source("lib/partner/register.ts");
  const bootstrap = source("lib/partner/bootstrap.ts");
  assert.match(register, /is_owner/);
  assert.match(register, /'admin', 'pending', FALSE, TRUE/);
  assert.doesNotMatch(register, /partner_user_grants/);
  assert.doesNotMatch(register, /partner_menu_denials/);
  assert.match(bootstrap, /'admin', 'active', TRUE, TRUE/);
});

test("closed menus stay closed and unrestricted partners stay open", () => {
  const sql = source("db/migrations/118_partner_menu_default_open.sql");
  const access = source("lib/partner/access.ts");
  const session = source("lib/partner/session.ts");
  const replace = source("lib/partner/menu-access.ts");
  assert.match(sql, /CREATE TABLE partner_menu_denials/);
  assert.match(sql, /SET is_owner = TRUE/);
  assert.match(sql, /NOT EXISTS \([\s\S]*partner_user_grants/);
  assert.doesNotMatch(sql, /DELETE FROM partner_user_grants/);
  assert.doesNotMatch(sql, /DELETE FROM partner_menu_denials/);
  assert.doesNotMatch(sql, /INSERT INTO partner_user_grants/);
  assert.doesNotMatch(sql, /INSERT INTO partner_menu_denials/);
  assert.doesNotMatch(sql, /ops_users/);
  assert.match(access, /deniedTabs/);
  assert.match(access, /actor\.isOwner \|\| actor\.tabs\.includes\(tab\)/);
  assert.match(session, /partner_menu_denials/);
  assert.match(replace, /DELETE FROM partner_menu_denials WHERE partner_id = \$1/);
  assert.doesNotMatch(replace, /partner_user_grants/);
  assert.doesNotMatch(replace, /is_owner/);
});
