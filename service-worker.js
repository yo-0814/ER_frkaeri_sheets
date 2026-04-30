/**
 * 浦添ER 振り返り共有シート - Service Worker
 *
 * 役割:
 * - オフライン時もアプリが起動できるよう、HTML/アイコン/manifest をキャッシュ
 * - ネットワーク優先・キャッシュフォールバック方式
 *   （新しいバージョンを優先しつつ、オフライン時はキャッシュから）
 *
 * 注意:
 * - GAS への通信（同期処理）はキャッシュしない（常に最新を取得）
 */

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `urasoe-er-${CACHE_VERSION}`;

// 起動時にキャッシュしておくリソース
const PRECACHE_URLS = [
  "./",
  "./urasoe_er_reflection.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-apple-180.png",
  "./favicon-32.png",
];

// インストール時：必要ファイルをキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

// 有効化時：古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch時：ネットワーク優先・失敗時キャッシュ
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // GAS への通信はキャッシュせずパススルー
  if (url.hostname.includes("script.google.com")) {
    return;
  }

  // 外部 CDN（Tailwind, Google Fonts）はネットワーク優先・キャッシュフォールバック
  // 同一オリジンも同じ戦略
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 成功したらキャッシュにも保存
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // GETのみキャッシュ
          if (event.request.method === "GET") {
            cache.put(event.request, resClone).catch(() => {});
          }
        });
        return res;
      })
      .catch(() => {
        // ネットワーク失敗時はキャッシュから
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // キャッシュにもなければ HTML を返す（SPA的フォールバック）
          if (event.request.mode === "navigate") {
            return caches.match("./urasoe_er_reflection.html");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
      })
  );
});
