// ============================================================
//  CALLPAY — SERVICE WORKER (Web Push)
// ============================================================
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Handle Web Push notification
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(err) { data = { title: '🔔 Order Masuk!' }; }

  const title = data.title || '🔔 Order Masuk!';
  const body  = data.body  || 'Ada orderan baru untukmu!';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon    : 'https://zenzenn28.github.io/callpay/assets/logo.png',
      badge   : 'https://zenzenn28.github.io/callpay/assets/logo.png',
      tag     : 'callpay-order-' + Date.now(),
      renotify: true,
      vibrate : [300, 100, 300],
      data    : { url: 'https://zenzenn28.github.io/callpay/talent.html' },
    })
  );
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