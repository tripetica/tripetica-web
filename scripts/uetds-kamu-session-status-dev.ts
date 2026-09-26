/**
 * DEV helper: probe whether a sealed Kamu portal session is present and usable.
 * Never prints cookie values.
 *
 * Usage:
 *   EXPECTED_DATABASE=tripetica_dev NODE_ENV=development \
 *     npx tsx --conditions=react-server scripts/uetds-kamu-session-status-dev.ts
 */
import { hasKamuPortalSession } from "@/lib/uetds/kamu-portal/session";
import { probeKamuPortalSession } from "@/lib/uetds/kamu-portal/client";
import { kamuSeferListesiUrl } from "@/lib/uetds/kamu-portal/html";

async function main() {
  const present = await hasKamuPortalSession();
  if (!present) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "kamu-session-required",
        loginUrl: kamuSeferListesiUrl(),
        hint: "Complete e-Devlet login on the official portal, then bind Cookie header via edit form (DEV) or saveKamuPortalSession.",
      }),
    );
    process.exitCode = 2;
    return;
  }
  const probe = await probeKamuPortalSession();
  console.log(
    JSON.stringify({
      ok: probe.ok,
      error: probe.ok ? null : probe.error,
      loginUrl: kamuSeferListesiUrl(),
    }),
  );
  process.exitCode = probe.ok ? 0 : 3;
}

void main();
