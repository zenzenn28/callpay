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
  try { return JSON.parse(sessionStorage.getItem(SESS_KEY)); } catch { return null; }
}
function setSession(t) { sessionStorage.setItem(SESS_KEY, JSON.stringify(t)); }
function clearSession() { sessionStorage.removeItem(SESS_KEY); }

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

    // Incoming: quick orders waiting for bid (no talent yet OR has bids but not confirmed)
    const incoming = all.filter(o =>
      o.orderType === 'quick' &&
      o.status === 'waiting_bid' &&
      !o.confirmedTalent
    );

    // My assigned orders
    const myOrders = all.filter(o =>
      o.confirmedTalent === currentTalent.id ||
      o.confirmedTalentName === currentTalent.name
    );

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
    const timeLeft   = getTimeLeft(o.createdAt, 3);
    const expired    = timeLeft <= 0;
    const genderPref = o.genderPref
      ? `<span style="background:rgba(249,168,201,.1);color:var(--pink);border:1px solid var(--border-pk);padding:2px 10px;border-radius:99px;font-size:.7rem;font-weight:800">${o.genderPref === 'female' ? '🌸 Wanita' : '💙 Pria'}</span>`
      : '';

    return `
    <div class="order-card" id="ocard-${o.id}">
      <div class="order-card-head">
        <div>
          <div class="order-id">#${(o.id||'').slice(-8)}</div>
          <div class="order-service">${o.service}</div>
          <div class="order-meta">⏱ ${getDurLabel(o.duration)} &nbsp;·&nbsp; ${bidCount} talent bid ${genderPref ? '&nbsp;·&nbsp;' + genderPref : ''}</div>
        </div>
        <div class="order-price">Rp ${(o.price||0).toLocaleString('id-ID')}</div>
      </div>
      ${o.customerNote ? `<div class="order-note">📝 "${o.customerNote}"</div>` : ''}
      <div class="timer-wrap" id="timer-wrap-${o.id}">
        <div class="timer-bar-track">
          <div class="timer-bar-fill ${timeLeft < 60 ? 'urgent' : ''}" id="tbar-${o.id}" style="width:${getTimerPct(o.createdAt, 3)}%"></div>
        </div>
        <div class="timer-text ${timeLeft < 60 ? 'urgent' : ''}" id="ttext-${o.id}">
          ${expired ? 'Waktu habis' : formatTime(timeLeft)}
        </div>
      </div>
      <button class="bid-btn ${alreadyBid ? 'bidded' : ''}" id="bidbtn-${o.id}"
        onclick="doBid('${o.id}','${o._docId}')"
        ${(alreadyBid || expired) ? 'disabled' : ''}>
        ${alreadyBid ? '✅ Sudah Bid' : expired ? 'Waktu Habis' : '🙋 Bid Orderan Ini'}
      </button>
    </div>`;
  }).join('');

  // Start timers
  orders.forEach(o => startTimer(o.id, o._docId, o.createdAt));
}

// ── TIMER ──────────────────────────────────────────────────────
const BID_MINUTES = 3;

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

function startTimer(orderId, docId, createdAt) {
  if (timerIntervals[orderId]) clearInterval(timerIntervals[orderId]);

  timerIntervals[orderId] = setInterval(() => {
    const left    = getTimeLeft(createdAt, BID_MINUTES);
    const pct     = getTimerPct(createdAt, BID_MINUTES);
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

    // Add bid
    await updateDoc(ref, {
      bids: arrayUnion({
        talentId  : currentTalent.id,
        talentName: currentTalent.name,
        gender    : currentTalent.gender,
        bidAt     : new Date().toISOString(),
      })
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
  return new Date(iso).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'});
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