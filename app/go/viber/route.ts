import { NextResponse } from "next/server";
import {
  contactDisplayNumbers,
  tripeticaMessagingDigits,
} from "@/lib/contact/links";

const VIBER_DEEP_LINK = `viber://chat?number=${tripeticaMessagingDigits}`;

/**
 * HTTPS bridge for email clients (Gmail iOS/Android) that block custom URL schemes.
 * Opens Viber chat with the Tripetica messaging number.
 */
export function GET() {
  const safeHref = VIBER_DEEP_LINK.replace(/"/g, "&quot;");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safeHref}" />
  <title>Viber — Tripetica</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f4f6fa; color: #172033; }
    main { max-width: 28rem; margin: 0 auto; padding: 2.5rem 1.25rem; text-align: center; }
    a { color: #4a8fd4; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <p>Opening Viber chat with ${contactDisplayNumbers.messaging}…</p>
    <p><a href="${safeHref}">Open Viber</a></p>
  </main>
  <script>
    window.location.replace(${JSON.stringify(VIBER_DEEP_LINK)});
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
