/* Train Live Map 京急線版（非公式）Service Worker */

const DEFAULT_ICON = "/icons/train-live-map-keikyu-192.png";
const DEFAULT_TAG =
  "train-live-map-keikyu:community:suspension:unknown";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title =
    typeof data.title === "string"
      ? data.title
      : "みんなの情報：見合わせ投稿が急増";
  const options = {
    body:
      typeof data.body === "string"
        ? data.body
        : "利用者投稿が増えています。京急電鉄の公式運行情報も確認してください。",
    icon: typeof data.icon === "string" ? data.icon : DEFAULT_ICON,
    badge: typeof data.badge === "string" ? data.badge : DEFAULT_ICON,
    tag: typeof data.tag === "string" ? data.tag : DEFAULT_TAG,
    renotify: true,
    data: {
      url: typeof data.url === "string" ? data.url : "/",
      lineId: typeof data.lineId === "string" ? data.lineId : null,
      source: "community",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let targetUrl = self.location.origin;
  try {
    const requested = new URL(
      event.notification.data?.url || "/",
      self.location.origin,
    );
    if (requested.origin === self.location.origin) {
      targetUrl = requested.href;
    }
  } catch {
    targetUrl = self.location.origin;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const windowClient of windows) {
          if (new URL(windowClient.url).origin === self.location.origin) {
            if ("navigate" in windowClient) {
              await windowClient.navigate(targetUrl);
            }
            return windowClient.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
