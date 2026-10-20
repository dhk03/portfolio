/* DH 타워 오피스 서비스 워커 — 앱으로 설치할 수 있게 하고, 화면 파일은 캐시해 빨리 연다.
 * 실시간 데이터(/events, /state)는 절대 캐시하지 않는다. */
var CACHE = "dh-office-v1";
var SHELL = [
  "./", "index.html", "office.css", "office.js", "scene3d.js", "characters3d.js",
  "core/state.js", "core/demo.js", "vendor/three.min.js", "vendor/RoundedBoxGeometry.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// 네트워크 먼저, 안 되면 캐시 — 코드를 고치면 바로 반영되고, 서버가 꺼져 있어도 화면은 열린다
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || /\/(events|state)$/.test(url.pathname)) return;
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return res;
  }).catch(function () { return caches.match(e.request).then(function (hit) { return hit || caches.match("index.html"); }); }));
});
