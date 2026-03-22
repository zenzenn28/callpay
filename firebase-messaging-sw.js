// ============================================================
//  CALLPAY — FIREBASE SERVICE WORKER
//  Handle push notifications saat browser ditutup
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey           : "AIzaSyBLPe_yx28LyefI856Ysxz3YEPnwA0ENFU",
  authDomain       : "callpay-28a28.firebaseapp.com",
  projectId        : "callpay-28a28",
  storageBucket    : "callpay-28a28.firebasestorage.app",
  messagingSenderId: "44722427776",
  appId            : "1:44722427776:web:29d1a297746cd83d685365",
});

const messaging = firebase.messaging();

// Notif saat browser ditutup / background
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || '🔔 CallPay — Order Masuk!';
  const body  = payload.notification?.body  || 'Ada orderan baru untukmu!';
  const isSpecial = payload.data?.isSpecial === 'true';

  self.registration.showNotification(title, {
    body,
    icon    : '/callpay/assets/logo.png',
    badge   : '/callpay/assets/logo.png',
    tag     : 'callpay-order',
    renotify: true,
    vibrate : [200, 100, 200, 100, 200],
    data    : payload.data || {},
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
      return clients.openWindow('/callpay/talent.html');
    })
  );
});