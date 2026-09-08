self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  const kind =
    payload.kind === "reservation"
      ? "reservation"
      : payload.kind === "partner"
        ? "partner"
        : payload.kind === "partner-job"
          ? "partner-job"
          : "process";
  const fallbackUrl = kind === "partner-job" ? "/tr/partner/jobs" : "/tr/ops";
  const title = typeof payload.title === "string" ? payload.title : "Tripetica";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: typeof payload.icon === "string" ? payload.icon : "/icon.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/icon.png",
    tag: typeof payload.tag === "string" ? payload.tag : "tripetica",
    data: {
      url: typeof payload.url === "string" ? payload.url : fallbackUrl,
      kind,
    },
    requireInteraction: payload.requireInteraction === true,
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        client.postMessage({
          type: kind === "partner-job" ? "partner-push" : "ops-push",
          kind,
        });
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const kind = event.notification.data?.kind;
  const fallbackUrl = kind === "partner-job" ? "/tr/partner/jobs" : "/tr/ops";
  const targetUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : fallbackUrl;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const absolute = new URL(targetUrl, self.location.origin);
      for (const client of windows) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname === absolute.pathname) {
            await client.focus();
            return;
          }
        } catch {
          // Ignore malformed client URLs.
        }
      }
      const section = absolute.pathname.includes("/partner") ? "/partner" : "/ops";
      const navigateType =
        section === "/partner" ? "partner-push-navigate" : "ops-push-navigate";
      for (const client of windows) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname.includes(section)) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(absolute.href);
            } else {
              client.postMessage({
                type: navigateType,
                url: absolute.pathname + absolute.search,
              });
            }
            return;
          }
        } catch {
          // Ignore malformed client URLs.
        }
      }
      await self.clients.openWindow(absolute.href);
    })(),
  );
});
