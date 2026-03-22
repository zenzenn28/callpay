// ============================================================
//  CALLPAY — SERVICE WORKER
//  Handle push notif di background via Web Push API
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');

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

let talentName    = null;
let knownOrderIds = new Set();
let unsubscribe   = null;

// ── Terima info dari talent-app.js ────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'INIT_LISTENER') {
    talentName = e.data.talentName;
    // Kirim known order IDs yang sudah ada
    if (e.data.knownIds) {
      e.data.knownIds.forEach(id => knownOrderIds.add(id));
    }
    startListener();
  }
});

// ── Listen Firestore ──────────────────────────────────────────
function startListener() {
  if (unsubscribe) unsubscribe();
  if (!talentName) return;

  unsubscribe = db.collection('orders')
    .where('status', '==', 'waiting_bid')
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const o = change.doc.data();
        if (knownOrderIds.has(o.id)) return;
        knownOrderIds.add(o.id);

        // Cek apakah talent ini ditarget
        const targets = o.targetTalents || [];
        const isTarget = targets.length === 0 ||
          targets.some(t => (t.name||'').toLowerCase() === talentName.toLowerCase());
        if (!isTarget) return;

        // Cek timer masih valid
        const bidMins = o.bidType === 'special' ? 6 : 5;
        const created = o.createdAt?.toDate?.() || new Date(o.date);
        if (Date.now() > created.getTime() + bidMins * 60 * 1000) return;

        // Tampilkan notif di notification bar HP
        const isSpecial = o.bidType === 'special';
        showNotif(
          isSpecial ? '⭐ Bid Spesial Untukmu!' : '🔔 Order Masuk!',
          `${o.service} · ${o.duration} menit · Rp ${(o.price||0).toLocaleString('id-ID')}`,
          o.id
        );
      });
    });
}

function showNotif(title, body, orderId) {
  self.registration.showNotification(title, {
    body,
    icon    : 'https://zenzenn28.github.io/callpay/assets/logo.png',
    badge   : 'https://zenzenn28.github.io/callpay/assets/logo.png',
    tag     : 'callpay-' + orderId,
    renotify: true,
    vibrate : [300, 100, 300, 100, 300],
    data    : { url: '/callpay/talent.html' },
  });
}

// ── Klik notif → buka talent portal ──────────────────────────
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

// ── Keep service worker alive ─────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('install', e => {
  self.skipWaiting();
});