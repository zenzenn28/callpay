// ============================================================
//  CALLPAY — SERVICE WORKER (Simple)
// ============================================================

self.addEventListener('install', e => {
  console.log('SW installed');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('SW activated');
  e.waitUntil(clients.claim());
});

// Terima pesan dari talent-app.js untuk tampilkan notif
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIF') {
    self.registration.showNotification(e.data.title, {
      body    : e.data.body,
      icon    : 'https://zenzenn28.github.io/callpay/assets/logo.png',
      badge   : 'https://zenzenn28.github.io/callpay/assets/logo.png',
      tag     : e.data.tag || 'callpay-order',
      renotify: true,
      vibrate : [300, 100, 300],
    });
  }
});

// Klik notif → buka talent portal
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('talent.html') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/callpay/talent.html');
    })
  );
});