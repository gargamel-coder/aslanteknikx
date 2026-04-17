// firebase-messaging-sw.js
// Service worker untuk Firebase Cloud Messaging (push notifications)
// File ini DIPANGGIL OTOMATIS oleh Firebase saat app di-background / layar terkunci.
// WAJIB diletakkan di root domain (sama level dengan teknisi.html).

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config — sama persis dengan config di teknisi.html
firebase.initializeApp({
  apiKey:            "AIzaSyAd_HmgX5djmePrHpYHxsydSErTPSjcBdY",
  authDomain:        "aslan-teknik.firebaseapp.com",
  projectId:         "aslan-teknik",
  storageBucket:     "aslan-teknik.firebasestorage.app",
  messagingSenderId: "372303552922",
  appId:             "1:372303552922:web:5b61d3cd2c590ff1381a23"
});

const messaging = firebase.messaging();

// ── HANDLE BACKGROUND MESSAGES ──────────────────────────────
// Dipanggil saat: app tertutup, minimized, atau layar HP terkunci.
// Foreground messages (app kebuka) ditangani di teknisi.html via onMessage().
messaging.onBackgroundMessage((payload) => {
  console.log('[sw] Background message:', payload);

  const notif  = payload.notification || {};
  const data   = payload.data || {};

  const title = notif.title || 'Aslan Teknik — Tugas Baru';
  const options = {
    body:  notif.body || 'Ada tugas baru untuk kamu. Buka app untuk detail.',
    icon:  '/icon-192.png',
    badge: '/favicon-32.png',
    tag:   data.order_id || 'new-task',   // tag sama = notifikasi ditimpa (bukan tumpuk)
    renotify: true,                        // tetap bunyi meski tag sama
    requireInteraction: false,             // auto-dismiss setelah beberapa detik
    vibrate: [200, 100, 200, 100, 200],    // pola getar (Android)
    data: {
      order_id: data.order_id || '',
      url:      data.url      || '/teknisi'
    },
    actions: [
      { action: 'open',    title: 'Buka Tugas' },
      { action: 'dismiss', title: 'Nanti Saja' }
    ]
  };

  return self.registration.showNotification(title, options);
});

// ── HANDLE NOTIFICATION CLICK ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/teknisi';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Kalau app sudah kebuka di tab lain — fokusin aja, jangan buka baru
      for (const client of list) {
        if (client.url.includes('/teknisi') && 'focus' in client) {
          return client.focus();
        }
      }
      // Kalau belum, buka tab baru
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── PWA CACHING (basic offline shell) ───────────────────────
const CACHE = 'aslan-teknik-v1';
const ASSETS = [
  '/teknisi',
  '/teknisi.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Jangan intercept Firebase/Firestore API calls — biarin native
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')    ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebase.com')) return;

  // HTML — network first, fallback ke cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/teknisi.html')))
    );
    return;
  }

  // Assets — cache first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && url.origin === self.location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => cached))
  );
});
