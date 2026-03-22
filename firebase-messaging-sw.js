// ============================================================
//  CALLPAY — SERVICE WORKER
//  Listen Firestore langsung → push notif ke HP talent
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyBLPe_yx28LyefI856Ysxz3YEPnwA0ENFU",
  authDomain       : "callpay-28a28.firebaseapp.com",
  projectId        : "callpay-28a28",
  storageBucket    : "callpay-28a28.firebasestorage.app",
  messagingSenderId: "44722427776",
  appId            : "1:44722427776:web:29d1a297746cd83d685365",
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const messaging = firebase.messaging();

// Handle FCM background messages
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || '🔔 Order Masuk!';
  const body  = payload.notification?.body  || 'Ada orderan baru untukmu!';
  self.registration.showNotification(title, {
    body,
    icon    : '/callpay/assets/logo.png',
    badge   : '/callpay/assets/logo.png',
    tag     : 'callpay-order',
    renotify: true,
    vibrate : [300, 100, 300],
  });
});

// ── FIRESTORE LISTENER di Service Worker ──────────────────────
// Dipanggil dari talent-app.js via postMessage
let talentName = null;
let unsubscribe = null;
let knownOrderIds = new Set();

self.addEventListener('message', e => {
  if (e.data?.type === 'INIT_LISTENER' && e.data.talentName) {
    talentName = e.data.talentName;
    startFirestoreListener();
  }
  if (e.data?.type === 'ADD_KNOWN_ORDER') {
    knownOrderIds.add(e.data.orderId);
  }
});

function startFirestoreListener() {
  if (unsubscribe) unsubscribe();

  unsubscribe = db.collection('orders')
    .where('status', '==', 'waiting_bid')
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const order = change.doc.data();
        if (knownOrderIds.has(order.id)) return;
        knownOrderIds.add(order.id);

        // Cek apakah talent ini termasuk target
        const targets = order.targetTalents || [];
        const isTarget = targets.length === 0 ||
          targets.some(t => (t.name||'').toLowerCase() === talentName.toLowerCase());

        if (!isTarget) return;

        // Cek timer masih valid
        const bidMins = order.bidType === 'special' ? 6 : 5;
        const created = order.createdAt?.toDate?.() || new Date(order.date);
        const timeLeft = (created.getTime() + bidMins*60*1000) - Date.now();
        if (timeLeft <= 0) return;

        // Tampilkan notif!
        const isSpecial = order.bidType === 'special';
        const title = isSpecial ? '⭐ Bid Spesial Untukmu!' : '🔔 Order Masuk!';
        const body  = `${order.service} · ${order.duration} menit · Rp ${(order.price||0).toLocaleString('id-ID')}`;

        self.registration.showNotification(title, {
          body,
          icon    : '/callpay/assets/logo.png',
          badge   : '/callpay/assets/logo.png',
          tag     : 'callpay-' + order.id,
          renotify: true,
          vibrate : [300, 100, 300],
          data    : { url: '/callpay/talent.html', orderId: order.id },
        });
      });
    });
}

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