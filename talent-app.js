// ============================================================
//  CALLPAY — TALENT PORTAL SCRIPT
//  Login via Firestore, bid order, timer 3 menit
// ============================================================
import { initializeApp }         from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore,
         collection, doc,
         getDoc, getDocs, query,
         where, updateDoc,
         onSnapshot, orderBy,
         serverTimestamp,
         arrayUnion }            from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyBLPe_yx28LyefI856Ysxz3YEPnwA0ENFU",
  authDomain       : "callpay-28a28.firebaseapp.com",
  projectId        : "callpay-28a28",
  storageBucket    : "callpay-28a28.firebasestorage.app",
  messagingSenderId: "44722427776",
  appId            : "1:44722427776:web:29d1a297746cd83d685365",
};

const app = initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

// ── SESSION ────────────────────────────────────────────────────
const SESS_KEY = 'cp_talent';
let currentTalent = null;
let unsubOrders   = null;
let timerIntervals= {};  // orderId → intervalId
let activeTab     = 'incoming'; // 'incoming' | 'assigned'

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESS_KEY)); } catch { return null; }
}
function setSession(t) { localStorage.setItem(SESS_KEY, JSON.stringify(t)); }
function clearSession() { localStorage.removeItem(SESS_KEY); }

// ── LOGIN ──────────────────────────────────────────────────────
async function doLogin() {
  const u   = document.getElementById('t-user').value.trim().toLowerCase();
  const p   = document.getElementById('t-pass').value;
  const err = document.getElementById('t-err');
  const btn = document.getElementById('t-login-btn');

  if (!u || !p) { showErr('Username dan password wajib diisi'); return; }

  btn.textContent = 'Memuat...';
  btn.disabled    = true;

  try {
    const ref  = doc(db, 'talents', u);
    const snap = await getDoc(ref);

    if (!snap.exists()) { showErr('Username tidak ditemukan'); reset(); return; }

    const data = snap.data();
    if (data.password !== p) { showErr('Password salah'); reset(); return; }
    if (data.active === false) { showErr('Akun kamu sedang tidak aktif'); reset(); return; }

    currentTalent = { id: u, ...data };
    setSession(currentTalent);
    err.style.display = 'none';
    showDashboard();
  } catch(e) {
    showErr('Gagal terhubung ke server. Coba lagi.');
    console.error(e);
  }
  reset();

  function showErr(msg) { err.textContent = '❌ ' + msg; err.style.display = 'block'; }
  function reset() { btn.textContent = 'Masuk'; btn.disabled = false; }
}

// ── DASHBOARD ──────────────────────────────────────────────────
function showDashboard() {
  document.getElementById('login-page').style.display  = 'none';
  document.getElementById('dashboard').style.display   = 'flex';

  // Set user info
  const initial = currentTalent.name.charAt(0).toUpperCase();
  document.getElementById('t-avatar').textContent   = initial;
  document.getElementById('t-name-top').textContent = currentTalent.name;

  // Set online status
  updateOnlineStatus(true);

  // Init notifikasi
  setTimeout(initNotifications, 500);

  // Listen to orders realtime
  startOrderListener();

  // Default tab
  switchTab('incoming');
}

function doLogout() {
  if (unsubOrders) unsubOrders();
  Object.values(timerIntervals).forEach(clearInterval);
  timerIntervals = {};
  clearSession();
  currentTalent = null;
  document.getElementById('dashboard').style.display   = 'none';
  document.getElementById('login-page').style.display  = 'flex';
  document.getElementById('t-user').value = '';
  document.getElementById('t-pass').value = '';
}

// ── ONLINE STATUS ──────────────────────────────────────────────
let isOnline = true;

async function updateOnlineStatus(online) {
  isOnline = online;
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const btn  = document.getElementById('status-toggle');
  if (online) {
    dot.className  = 'status-dot online';
    text.textContent = 'Kamu sedang Online — siap menerima order';
    btn.textContent  = 'Set Offline';
    btn.classList.add('active');
  } else {
    dot.className  = 'status-dot offline';
    text.textContent = 'Kamu sedang Offline — tidak menerima order';
    btn.textContent  = 'Set Online';
    btn.classList.remove('active');
  }
  // Update Firestore
  try {
    await updateDoc(doc(db, 'talents', currentTalent.id), { online });
  } catch(e) { console.error(e); }
}

function toggleStatus() {
  updateOnlineStatus(!isOnline);
}

// ── ORDER LISTENER ─────────────────────────────────────────────
function startOrderListener() {
  // Listen to orders that are waiting for bid OR assigned to this talent
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

  unsubOrders = onSnapshot(q, snap => {
    const all = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    // Incoming: quick orders waiting for bid, still within 3 min window, not confirmed
    const BID_MINS = 5;
    const incoming = all.filter(o => {
      if (o.orderType !== 'quick') return false;
      if (o.status !== 'waiting_bid') return false;
      if (o.confirmedTalent) return false;
      // Cek apakah talent ini termasuk yang ditarget
      // targetTalents kosong [] = semua talent bisa lihat (regular bid)
      // targetTalents berisi nama = hanya talent yang dipilih (special bid)
      if (o.targetTalents && Array.isArray(o.targetTalents) && o.targetTalents.length > 0) {
        const myName   = (currentTalent.name || '').toLowerCase();
        const isTarget = o.targetTalents.some(t =>
          (t.name || '').toLowerCase() === myName
        );
        if (!isTarget) return false;
      }
      // Kalau targetTalents tidak ada atau kosong → semua talent bisa lihat
      // Timer: special = 6 menit, regular = 5 menit
      const bidMins  = o.bidType === 'special' ? 6 : 5;
      const created  = o.createdAt?.toDate ? o.createdAt.toDate().getTime() : new Date(o.date).getTime();
      const timeLeft = (created + bidMins * 60 * 1000) - Date.now();
      return timeLeft > 0;
    });

    // My orders: confirmed by customer OR assigned by admin
    const myOrders = all.filter(o =>
      o.confirmedTalent === currentTalent.id ||
      o.confirmedTalentName === currentTalent.name ||
      (o.talentId === currentTalent.id && o.status !== 'waiting_bid') ||
      (o.talentName === currentTalent.name && o.status !== 'waiting_bid')
    );

    checkNewOrders(incoming);
    renderIncoming(incoming);
    renderMyOrders(myOrders);
    updateTabCounts(incoming.length, myOrders.length);
  });
}

// ── RENDER INCOMING ORDERS ─────────────────────────────────────
function renderIncoming(orders) {
  const container = document.getElementById('incoming-list');
  if (!orders.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>Belum ada order masuk</p></div>`;
    return;
  }

  container.innerHTML = orders.map(o => {
    const alreadyBid = (o.bids || []).find(b => b.talentId === currentTalent.id);
    const bidCount   = (o.bids || []).length;
    const bidMins    = o.bidType === 'special' ? 6 : 5;
    const timeLeft   = getTimeLeft(o.createdAt, bidMins);
    const expired    = timeLeft <= 0;
    const isSpecial  = o.bidType === 'special';
    const genderPref = o.genderPref
      ? `<span style="background:rgba(249,168,201,.1);color:var(--pink);border:1px solid var(--border-pk);padding:2px 10px;border-radius:99px;font-size:.7rem;font-weight:800">${o.genderPref === 'female' ? '🌸 Wanita' : '💙 Pria'}</span>`
      : '';

    return `
    <div class="order-card ${isSpecial ? 'order-card-special' : ''}" id="ocard-${o.id}">
      ${isSpecial ? `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding:6px 12px;background:rgba(249,168,201,.1);border:1px solid rgba(249,168,201,.25);border-radius:8px">
        <span style="font-size:.85rem">⭐</span>
        <span style="font-size:.75rem;font-weight:800;color:var(--pink)">BID SPESIAL — Kamu dipilih khusus oleh customer!</span>
      </div>` : ''}
      <div class="order-card-head">
        <div>
          <div class="order-id">#${(o.id||'').slice(-8)}</div>
          <div class="order-service">${o.service}</div>
          <div class="order-meta">⏱ ${getDurLabel(o.duration)} &nbsp;·&nbsp; ${bidCount > 0 ? bidCount + ' talent bid' : 'Belum ada yang bid'}</div>
          <div class="order-meta" style="margin-top:3px">🕐 Masuk: ${formatDate(o.date)}</div>
        </div>
        <div class="order-price">Rp ${(o.price||0).toLocaleString('id-ID')}</div>
      </div>
      ${o.customerNote ? `<div class="order-note">📝 "${o.customerNote}"</div>` : ''}
      <div class="timer-wrap" id="timer-wrap-${o.id}">
        <div class="timer-bar-track">
          <div class="timer-bar-fill ${isSpecial ? 'special' : ''} ${timeLeft < 60 ? 'urgent' : ''}" id="tbar-${o.id}" style="width:${getTimerPct(o.createdAt, bidMins)}%"></div>
        </div>
        <div class="timer-text ${timeLeft < 60 ? 'urgent' : ''}" id="ttext-${o.id}">
          ${expired ? 'Waktu habis' : formatTime(timeLeft)}
        </div>
      </div>
      <button class="bid-btn ${alreadyBid ? 'bidded' : ''} ${isSpecial ? 'bid-btn-special' : ''}" id="bidbtn-${o.id}"
        onclick="doBid('${o.id}','${o._docId}')"
        ${(alreadyBid || expired) ? 'disabled' : ''}>
        ${alreadyBid ? '✅ Sudah Bid' : expired ? 'Waktu Habis' : isSpecial ? '⭐ Terima Bid Spesial' : '🙋 Bid Orderan Ini'}
      </button>
    </div>`;
  }).join('');

  // Start timers
  orders.forEach(o => startTimer(o.id, o._docId, o.createdAt, o.bidType === 'special' ? 6 : 5));
}

// ── TIMER ──────────────────────────────────────────────────────
const BID_MINUTES = 5;

function getTimeLeft(createdAt, minutes) {
  if (!createdAt) return 0;
  const created = createdAt.toDate ? createdAt.toDate().getTime() : new Date(createdAt).getTime();
  const deadline = created + minutes * 60 * 1000;
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
}

function getTimerPct(createdAt, minutes) {
  const total = minutes * 60;
  const left  = getTimeLeft(createdAt, minutes);
  return Math.round((left / total) * 100);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')} tersisa`;
}

function startTimer(orderId, docId, createdAt, bidMins) {
  if (timerIntervals[orderId]) clearInterval(timerIntervals[orderId]);
  const mins = bidMins || BID_MINUTES;

  timerIntervals[orderId] = setInterval(() => {
    const left    = getTimeLeft(createdAt, mins);
    const pct     = getTimerPct(createdAt, mins);
    const urgent  = left < 60;
    const expired = left <= 0;

    const bar  = document.getElementById(`tbar-${orderId}`);
    const txt  = document.getElementById(`ttext-${orderId}`);
    const btn  = document.getElementById(`bidbtn-${orderId}`);

    if (!bar) { clearInterval(timerIntervals[orderId]); return; }

    bar.style.width = pct + '%';
    bar.className   = 'timer-bar-fill' + (urgent ? ' urgent' : '');
    txt.textContent = expired ? 'Waktu habis' : formatTime(left);
    txt.className   = 'timer-text' + (urgent ? ' urgent' : '');

    if (expired && btn && !btn.classList.contains('bidded')) {
      btn.disabled     = true;
      btn.textContent  = 'Waktu Habis';
      clearInterval(timerIntervals[orderId]);
    }
  }, 1000);
}

// ── BID ORDER ──────────────────────────────────────────────────
async function doBid(orderId, docId) {
  const btn = document.getElementById(`bidbtn-${orderId}`);
  if (!btn || btn.disabled) return;

  btn.disabled    = true;
  btn.textContent = 'Memproses...';

  try {
    const ref  = doc(db, 'orders', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) { toast('Order tidak ditemukan'); return; }

    const data = snap.data();
    const timeLeft = getTimeLeft(data.createdAt, BID_MINUTES);
    if (timeLeft <= 0) { btn.textContent = 'Waktu Habis'; toast('Waktu bid sudah habis'); return; }

    // Check already bid
    const existing = (data.bids || []).find(b => b.talentId === currentTalent.id);
    if (existing) { btn.textContent = '✅ Sudah Bid'; btn.classList.add('bidded'); return; }

    // Add bid — semua talent boleh bid selama 5 menit
    await updateDoc(ref, {
      bids: arrayUnion({
        talentId  : currentTalent.id,
        talentName: currentTalent.name,
        gender    : currentTalent.gender,
        bidAt     : new Date().toISOString(),
      }),
    });

    btn.textContent = '✅ Sudah Bid';
    btn.classList.add('bidded');
    toast('✅ Berhasil bid! Tunggu customer memilih.');
  } catch(e) {
    console.error(e);
    btn.disabled    = false;
    btn.textContent = '🙋 Bid Orderan Ini';
    toast('Gagal bid, coba lagi');
  }
}

// ── RENDER MY ORDERS ───────────────────────────────────────────
function renderMyOrders(orders) {
  const container = document.getElementById('my-orders-list');
  if (!orders.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>Belum ada orderan yang kamu ambil</p></div>`;
    return;
  }
  container.innerHTML = orders.map(o => `
    <div class="assigned-card">
      <span class="assigned-badge">✅ Orderanmu</span>
      <div style="font-weight:900;font-size:1rem;margin-bottom:4px">${o.service}</div>
      <div style="font-size:.82rem;color:var(--muted);font-weight:600;margin-bottom:8px">
        ⏱ ${getDurLabel(o.duration)} &nbsp;·&nbsp; 📅 ${formatDate(o.date)}
      </div>
      <div style="font-size:1rem;font-weight:900;color:var(--pink)">Rp ${(o.price||0).toLocaleString('id-ID')}</div>
      ${o.customerNote ? `<div class="order-note" style="margin-top:8px">📝 "${o.customerNote}"</div>` : ''}
      <div style="margin-top:10px">
        <span class="badge-status badge-${o.status}">${o.status.charAt(0).toUpperCase()+o.status.slice(1)}</span>
      </div>
    </div>`).join('');
}

// ── TABS ───────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('incoming-section').style.display = tab === 'incoming' ? 'block' : 'none';
  document.getElementById('myorders-section').style.display = tab === 'assigned' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
}

function updateTabCounts(incoming, assigned) {
  document.getElementById('tab-incoming').innerHTML =
    `📥 Order Masuk ${incoming > 0 ? `<span class="badge-count">${incoming}</span>` : ''}`;
  document.getElementById('tab-assigned').innerHTML =
    `📋 Orderanku ${assigned > 0 ? `<span class="badge-count">${assigned}</span>` : ''}`;
}

// ── HELPERS ────────────────────────────────────────────────────
function getDurLabel(d) {
  const map = {30:'30 menit',60:'60 menit',90:'90 menit',120:'2 jam',180:'3 jam'};
  return map[d] || d + ' menit';
}
function formatDate(iso) {
  if (!iso) return '-';
  const d    = new Date(iso);
  const date = d.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'});
  const h    = String(d.getHours()).padStart(2,'0');
  const m    = String(d.getMinutes()).padStart(2,'0');
  return `${date}, ${h}.${m}`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── BADGE STATUS CSS ───────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .badge-status{display:inline-block;padding:3px 11px;border-radius:99px;font-size:.72rem;font-weight:800}
  .badge-baru{background:rgba(77,166,232,.12);color:#4DA6E8}
  .badge-proses{background:rgba(255,184,0,.12);color:#FFB800}
  .badge-selesai{background:rgba(61,214,140,.12);color:#3DD68C}
  .badge-batal{background:rgba(255,92,92,.12);color:#FF5C5C}
  .badge-waiting_bid{background:rgba(249,168,201,.12);color:#F9A8C9}
`;
document.head.appendChild(style);

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check existing session
  const sess = getSession();
  if (sess) {
    currentTalent = sess;
    showDashboard();
  }

  // Login button
  document.getElementById('t-login-btn').onclick = doLogin;
  ['t-user','t-pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  });

  // Logout
  document.getElementById('t-logout-btn').onclick = doLogout;

  // Status toggle
  document.getElementById('status-toggle').onclick = toggleStatus;

  // Tabs
  document.getElementById('tab-incoming').onclick = () => switchTab('incoming');
  document.getElementById('tab-assigned').onclick = () => switchTab('assigned');
});

// Export doBid to window for onclick
window.doBid = doBid;

// ============================================================
//  PUSH NOTIFICATION — FCM + Web Notifications API
//  Notif muncul meskipun browser ditutup (via FCM)
// ============================================================

const VAPID_KEY = 'BGTV734OtVEVgM-LiL7Xymht9gEjba-uu0y_X_vj-TZkQgGf2r9yhWLqyNXgu6NguDfjD_rrQQtgWtzvOwFNNYA';
let lastOrderIds = new Set();
let notifPermission = false;

async function initNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  try {
    // Minta izin notifikasi
    const permission = await Notification.requestPermission();
    notifPermission = permission === 'granted';
    if (!notifPermission) { showNotifBanner(false); return; }

    // Register service worker — harus sesuai dengan lokasi file
    const swReg = await navigator.serviceWorker.register(
      '/callpay/firebase-messaging-sw.js'
    );

    // Tunggu SW aktif
    await new Promise(resolve => {
      if (swReg.active) { resolve(); return; }
      const sw = swReg.installing || swReg.waiting;
      if (sw) {
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      } else {
        navigator.serviceWorker.ready.then(resolve);
      }
    });

    // Kirim info talent + known order IDs ke SW
    const sw = swReg.active;
    if (sw) {
      sw.postMessage({
        type      : 'INIT_LISTENER',
        talentName: currentTalent.name,
        knownIds  : [...lastOrderIds],
      });
    }

    // Re-send setiap kali SW berubah (update)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const newSw = navigator.serviceWorker.controller;
      if (newSw) {
        newSw.postMessage({
          type      : 'INIT_LISTENER',
          talentName: currentTalent.name,
          knownIds  : [...lastOrderIds],
        });
      }
    });

    showNotifBanner(true);
    console.log('✅ Service Worker registered & notif aktif untuk', currentTalent.name);
  } catch(e) {
    console.error('❌ Notif init error:', e.message);
    // Fallback — coba register tanpa menunggu aktivasi
    try {
      const swReg2 = await navigator.serviceWorker.register('/callpay/firebase-messaging-sw.js');
      console.log('SW registered (fallback):', swReg2.scope);
      showNotifBanner(notifPermission);
    } catch(e2) {
      console.error('❌ SW register gagal total:', e2.message);
      showNotifBanner(false);
    }
  }
}

function showNotifBanner(enabled) {
  const existing = document.getElementById('notif-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'notif-banner';
  banner.style.cssText = `margin:0 0 16px;padding:12px 16px;border-radius:12px;display:flex;align-items:center;gap:10px;background:${enabled?'rgba(61,214,140,.08)':'rgba(255,184,0,.08)'};border:1px solid ${enabled?'rgba(61,214,140,.25)':'rgba(255,184,0,.25)'};font-size:.82rem;font-weight:700;color:${enabled?'var(--green)':'var(--yellow)'};`;
  banner.innerHTML = enabled
    ? `<span>🔔</span><span>Notifikasi aktif — kamu akan diberitahu saat ada order masuk</span>`
    : `<span>🔕</span><span>Notifikasi belum diaktifkan</span>
       <button onclick="initNotifications()" style="margin-left:auto;padding:4px 12px;border-radius:99px;border:1px solid currentColor;background:transparent;color:inherit;font-size:.75rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif">Aktifkan</button>`;
  const dashContent = document.querySelector('.dash-content');
  if (dashContent) dashContent.insertBefore(banner, dashContent.firstChild);
}

function sendPushNotif(title, body, isSpecial) {
  // In-app toast
  const notif = document.createElement('div');
  notif.style.cssText = `position:fixed;top:70px;right:16px;z-index:9999;background:var(--surface2);border:1px solid ${isSpecial?'rgba(249,168,201,.4)':'rgba(77,166,232,.3)'};border-radius:14px;padding:14px 18px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.5);font-family:'Nunito',sans-serif;animation:toastIn .3s ease both`;
  notif.innerHTML = `<div style="font-weight:900;font-size:.9rem;color:${isSpecial?'var(--pink)':'var(--blue)'};margin-bottom:4px">${title}</div><div style="font-size:.82rem;color:var(--muted);font-weight:600">${body}</div>`;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 6000);

  if (!notifPermission) return;

  const tag = 'callpay-' + Date.now();

  // Coba lewat SW dulu (muncul di notif bar meski tab background)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type : 'SHOW_NOTIF',
      title, body, tag,
    });
  } else {
    // Fallback langsung
    try {
      new Notification(title, {
        body,
        icon    : 'https://zenzenn28.github.io/callpay/assets/logo.png',
        tag,
        renotify: true,
        vibrate : [300, 100, 300],
      });
    } catch(e) { console.error('Notif error:', e); }
  }
}

function checkNewOrders(orders) {
  const incoming = orders.filter(o => {
    if (o.orderType !== 'quick') return false;
    if (o.status !== 'waiting_bid') return false;
    if (o.confirmedTalent) return false;
    if (o.targetTalents && o.targetTalents.length > 0) {
      const myName = (currentTalent.name||'').toLowerCase();
      return o.targetTalents.some(t => (t.name||'').toLowerCase() === myName);
    }
    const bidMins = o.bidType === 'special' ? 6 : 5;
    const created = o.createdAt?.toDate ? o.createdAt.toDate().getTime() : new Date(o.date).getTime();
    return (created + bidMins*60*1000) - Date.now() > 0;
  });

  incoming.forEach(o => {
    if (!lastOrderIds.has(o.id)) {
      lastOrderIds.add(o.id);
      const isSpecial = o.bidType === 'special';
      const title = isSpecial ? '⭐ Bid Spesial Untukmu!' : '🔔 Order Masuk!';
      const body  = `${o.service} · ${o.duration} menit · Rp ${(o.price||0).toLocaleString('id-ID')}`;
      sendPushNotif(title, body, isSpecial);
    }
  });
}

window.initNotifications = initNotifications;