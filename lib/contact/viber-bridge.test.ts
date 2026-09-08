import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/go/viber/route";
import { viberChatDeepLink } from "@/lib/contact/links";

test("Viber email bridge redirects to the chat deep link", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  const html = await response.text();
  assert.match(html, new RegExp(viberChatDeepLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /window\.location\.replace/);
});
