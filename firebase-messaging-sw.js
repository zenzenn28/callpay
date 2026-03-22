// ============================================================
//  CALLPAY — FIREBASE MESSAGING SERVICE WORKER
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey           : "AIzaSyDpaaDSHLu8Oy27WKXBjBcDsn9sRpVnRw0",
  authDomain       : "callpay-28a28.firebaseapp.com",
  projectId        : "callpay-28a28",
  storageBucket    : "callpay-28a28.firebasestorage.app",
  messagingSenderId: "44722427776",
  appId            : "1:44722427776:web:29d1a297746cd83d685365",
});

const messaging = firebase.messaging();

// Handle background FCM messages
messaging.onBackgroundMessage(payload => {
  console.log('Background message:', payload);
  const title = payload.notification?.title || '🔔 Order Masuk!';
  const body  = payload.notification?.body  || 'Ada orderan baru!';

  self.registration.showNotification(title, {
    body,
    icon    : 'https://zenzenn28.github.io/callpay/assets/logo.png',
    badge   : 'https://zenzenn28.github.io/callpay/assets/logo.png',
    tag     : 'callpay-order',
    renotify: true,
    vibrate : [300, 100, 300],
    data    : { url: 'https://zenzenn28.github.io/callpay/talent.html' },
  });
});

// Klik notif → buka talent portal
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('talent.html') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('https://zenzenn28.github.io/callpay/talent.html');
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));