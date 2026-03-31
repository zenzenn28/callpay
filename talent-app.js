// ============================================================
//  CALLPAY — TALENT APP v3
//  - Hapus tab Order Masuk
//  - Tambah tab Setting (edit profil → pending admin)
// ============================================================
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { DB, DUR_LABEL } from './admin/data.js';

const FIREBASE_CONFIG = {
  apiKey:'AIzaSyBLPe_yx28LyefI856Ysxz3YEPnwA0ENFU',
  authDomain:'callpay-28a28.firebaseapp.com',
  projectId:'callpay-28a28',
  storageBucket:'callpay-28a28.firebasestorage.app',
  messagingSenderId:'44722427776',
  appId:'1:44722427776:web:29d1a297746cd83d685365'
};
const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

const CLOUDINARY_CLOUD  = 'dnbjw43hp';
const CLOUDINARY_PRESET = 'callpay_audio';
const ALL_SERVICES = ['Temen Call','Sleepcall','Temen Curhat','Pacar Virtual'];
const SESSION_KEY  = 'cp_talent_v2';

let currentTalent = null;
let _docId        = null;
let _uploadedAudioUrl = '';
let _uploadedPhotoUrl = '';

// ── SESSION ───────────────────────────────────────────────
function getSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function setSession(d) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(d)); }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' toast-' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

function showPage(id) {
  // display yang benar untuk tiap page
  const displayMap = { 'login-page': 'flex', 'dashboard': 'flex', 'setup-page': 'block' };
  ['login-page','dashboard','setup-page'].forEach(p => {
    const el = document.getElementById(p);
    if (!el) return;
    el.style.display = (p === id) ? (displayMap[p] || 'block') : 'none';
  });
}

// ── LOGIN ─────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('t-user').value.trim().toLowerCase();
  const password = document.getElementById('t-pass').value.trim();
  const errEl    = document.getElementById('t-err');
  const btn      = document.getElementById('t-login-btn');
  errEl.style.display = 'none';
  if (!username || !password) { errEl.textContent='Username dan password wajib diisi.'; errEl.style.display='block'; return; }
  btn.disabled = true; btn.textContent = 'Memuat...';
  try {
    const snap = await getDoc(doc(db, 'talents', username));
    if (!snap.exists()) throw new Error('Username atau password salah.');
    const data = snap.data();
    if (data.password !== password) throw new Error('Username atau password salah.');
    _docId = username;
    currentTalent = { id: username, ...data };
    setSession({ docId: username });
    loadDashboard();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
  btn.disabled = false; btn.textContent = 'Masuk';
}

// ── DASHBOARD ─────────────────────────────────────────────
function loadDashboard() {
  document.getElementById('t-avatar').textContent   = (currentTalent.name || _docId)[0].toUpperCase();
  document.getElementById('t-name-top').textContent = currentTalent.name || _docId;
  if (currentTalent.status === 'draft' || currentTalent.status === 'rejected') {
    renderSetupPage(); showPage('setup-page'); return;
  }
  showPage('dashboard');
  listenStatus();
  listenOrders();
  updateBanner();
}

function updateBanner() {
  const b = document.getElementById('status-banner');
  if (!b) return;
  if (currentTalent.status === 'pending') {
    b.innerHTML = `<div style="background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.2);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:.85rem;font-weight:700;color:var(--yellow)">⏳ Profil kamu sedang dalam review admin. Harap tunggu persetujuan.</div>`;
  } else if (currentTalent.status === 'rejected') {
    b.innerHTML = `<div style="background:rgba(255,92,92,.06);border:1px solid rgba(255,92,92,.2);border-radius:12px;padding:14px 18px;margin-bottom:20px">
      <p style="font-size:.85rem;font-weight:800;color:var(--red);margin-bottom:6px">❌ Perubahan profil ditolak admin</p>
      ${currentTalent.declineReason?`<p style="font-size:.82rem;color:var(--muted);font-weight:600">Alasan: "${currentTalent.declineReason}"</p>`:''}
      <button onclick="document.getElementById('tab-settings').click()" style="margin-top:10px;padding:7px 18px;border-radius:99px;background:var(--pink-mid);color:#fff;border:none;font-size:.8rem;font-weight:800;cursor:pointer">Edit & Kirim Ulang</button>
    </div>`;
  } else { b.innerHTML = ''; }
}

// ── SETUP PAGE (first time / rejected) ────────────────────
window._showSetup = function() { renderSetupPage(); showPage('setup-page'); };

function renderSetupPage() {
  const t  = currentTalent;
  const el = document.getElementById('setup-content');
  if (!el) return;
  _uploadedAudioUrl = '';
  _uploadedPhotoUrl = '';
  el.innerHTML = buildProfileForm(t, false);
  attachFormHandlers();
}

// ── SETTING PANEL (di dalam dashboard) ────────────────────
function renderSettingsPanel() {
  const t  = currentTalent;
  const el = document.getElementById('settings-content');
  if (!el) return;
  _uploadedAudioUrl = '';
  _uploadedPhotoUrl = '';

  // Jika ada pending edit, tampilkan info
  const hasPendingEdit = currentTalent._pendingEdit === true;

  el.innerHTML = `
    ${hasPendingEdit ? `
    <div style="background:rgba(255,184,0,.08);border:1px solid rgba(255,184,0,.2);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:.84rem;font-weight:700;color:var(--yellow)">
      ⏳ Ada perubahan profil yang sedang menunggu persetujuan admin.
    </div>` : ''}
    ${buildProfileForm(t, true)}
  `;
  attachFormHandlers();
}

function buildProfileForm(t, isSettingMode) {
  const title   = isSettingMode ? '✏️ Edit Profil' : (t.status==='rejected' ? '✏️ Edit & Kirim Ulang' : '📝 Setup Profil');
  const btnText = isSettingMode ? '📤 Simpan & Minta Persetujuan' : (t.status==='rejected' ? '📤 Kirim Ulang' : '📤 Submit untuk Review');

  return `
  <div class="setup-card">
    <h2 style="font-size:1.2rem;font-weight:900;margin-bottom:20px">${title}</h2>
    ${!isSettingMode && t.status==='rejected' && t.declineReason ? `<div style="background:rgba(255,92,92,.06);border:1px solid rgba(255,92,92,.2);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:.82rem;color:var(--red);font-weight:700">❌ "${t.declineReason}"</div>` : ''}

    <div class="setup-section">
      <div class="setup-label">📷 Foto Profil *</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div id="photo-preview" style="width:76px;height:76px;border-radius:12px;overflow:hidden;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:2rem">
          ${t.img ? `<img src="${t.img}" style="width:100%;height:100%;object-fit:cover">` : '👤'}
        </div>
        <label class="upload-audio-label">
          <input type="file" id="photo-file" accept="image/*" style="display:none" onchange="previewPhoto(this)">
          <span id="photo-lbl">📁 Pilih Foto</span>
        </label>
      </div>
      <div id="photo-prog" style="display:none;margin-top:8px">
        <div style="height:5px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden"><div id="photo-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#E8628A,#F9A8C9);border-radius:99px;transition:width .3s"></div></div>
        <p id="photo-prog-txt" style="font-size:.73rem;color:var(--muted);margin-top:4px"></p>
      </div>
    </div>

    <div class="setup-section">
      <div class="setup-label">📛 Nama Tampil *</div>
      <input type="text" id="s-name" class="setup-input" value="${t.name||''}" placeholder="Nama kamu">
    </div>
    <div class="setup-section">
      <div class="setup-label">🎂 Umur *</div>
      <input type="number" id="s-age" class="setup-input" value="${t.age||''}" placeholder="Umur" min="18" max="35">
    </div>
    <div class="setup-section">
      <div class="setup-label">💬 Bio Singkat</div>
      <textarea id="s-bio" class="setup-input" rows="3" placeholder="Ceritakan tentang dirimu...">${t.bio||''}</textarea>
    </div>

    <div class="setup-section">
      <div class="setup-label">🎯 Layanan *</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px" id="svc-wrap">
        ${ALL_SERVICES.map(s=>`
        <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <input type="checkbox" value="${s}" class="svc-ck" ${(t.services||[]).includes(s)?'checked':''} style="display:none">
          <span class="svc-pill ${(t.services||[]).includes(s)?'svc-active':''}">${s}</span>
        </label>`).join('')}
      </div>
    </div>

    <div class="setup-section">
      <div class="setup-label">🎵 Sample Suara *</div>
      ${t.audio ? `<audio controls style="width:100%;height:32px;margin-bottom:8px" src="${t.audio}"></audio>` : ''}
      <label class="upload-audio-label">
        <input type="file" id="audio-file" accept="audio/*" style="display:none" onchange="handleAudio(this)">
        <span id="audio-lbl">${t.audio ? '🔄 Ganti Audio' : '📁 Pilih Audio (MP3/WAV)'}</span>
      </label>
      <div id="audio-prog" style="display:none;margin-top:8px">
        <div style="height:5px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden"><div id="audio-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#E8628A,#F9A8C9);border-radius:99px;transition:width .3s"></div></div>
        <p id="audio-prog-txt" style="font-size:.73rem;color:var(--muted);margin-top:4px"></p>
      </div>
      <div id="audio-new" style="display:none;margin-top:8px"><audio controls style="width:100%;height:32px" id="audio-new-el"></audio></div>
    </div>

    <p id="s-err" style="color:var(--red);font-size:.82rem;font-weight:700;display:none;margin-bottom:8px"></p>
    <button id="s-submit" onclick="submitProfile()" style="width:100%;padding:13px;border-radius:99px;background:var(--pink-mid);color:white;border:none;font-weight:800;font-size:.9rem;cursor:pointer;transition:opacity .2s;box-shadow:0 0 18px var(--pink-glow)">
      ${btnText}
    </button>
    ${isSettingMode ? `<p style="margin-top:12px;font-size:.76rem;color:var(--muted);font-weight:600;text-align:center">⚠️ Perubahan akan ditinjau admin sebelum ditampilkan ke publik.</p>` : ''}
    ${!isSettingMode && (t.status==='approved'||t.status==='pending') ? `<button onclick="showPage('dashboard')" style="width:100%;margin-top:10px;padding:11px;border-radius:99px;background:transparent;border:1.5px solid var(--border);color:var(--muted);font-weight:800;font-size:.85rem;cursor:pointer">← Kembali</button>` : ''}
  </div>`;
}

function attachFormHandlers() {
  document.querySelectorAll('.svc-ck').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.nextElementSibling.classList.toggle('svc-active', cb.checked);
    });
  });
}

window.previewPhoto = function(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('photo-lbl').textContent = '⏳ Mengupload...';
  document.getElementById('photo-prog').style.display = 'block';
  const bar = document.getElementById('photo-bar');
  const txt = document.getElementById('photo-prog-txt');
  // Preview lokal dulu
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('photo-preview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
  // Upload ke Cloudinary
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`);
  xhr.upload.onprogress = e => { if (e.lengthComputable) { const p=Math.round(e.loaded/e.total*100); bar.style.width=p+'%'; txt.textContent=`${p}%`; } };
  xhr.onload = () => {
    if (xhr.status === 200) {
      const res = JSON.parse(xhr.responseText);
      _uploadedPhotoUrl = res.secure_url;
      txt.textContent = '✅ Foto berhasil diupload!'; bar.style.background='var(--green)';
      document.getElementById('photo-lbl').textContent = '✅ ' + file.name;
      setTimeout(()=>{ document.getElementById('photo-prog').style.display='none'; bar.style.width='0%'; bar.style.background='linear-gradient(90deg,#E8628A,#F9A8C9)'; }, 2500);
    } else { txt.textContent='❌ Gagal upload foto.'; }
  };
  xhr.onerror = ()=>{ txt.textContent='❌ Gagal.'; };
  xhr.send(fd);
};

window.handleAudio = function(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 10*1024*1024) { alert('Maks 10MB!'); return; }
  document.getElementById('audio-lbl').textContent = '⏳ Mengupload...';
  document.getElementById('audio-prog').style.display = 'block';
  const bar = document.getElementById('audio-bar');
  const txt = document.getElementById('audio-prog-txt');
  const fd  = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`);
  xhr.upload.onprogress = e => { if (e.lengthComputable) { const p=Math.round(e.loaded/e.total*100); bar.style.width=p+'%'; txt.textContent=`${p}%`; } };
  xhr.onload = () => {
    if (xhr.status===200) {
      const res = JSON.parse(xhr.responseText);
      _uploadedAudioUrl = res.secure_url;
      txt.textContent = '✅ Berhasil!'; bar.style.background='var(--green)';
      document.getElementById('audio-lbl').textContent = '✅ ' + file.name;
      const el = document.getElementById('audio-new-el');
      if (el) { el.src=_uploadedAudioUrl; document.getElementById('audio-new').style.display='block'; }
      setTimeout(()=>{ document.getElementById('audio-prog').style.display='none'; bar.style.width='0%'; bar.style.background='linear-gradient(90deg,#E8628A,#F9A8C9)'; }, 2500);
    } else { txt.textContent='❌ Gagal.'; }
  };
  xhr.onerror = ()=>{ txt.textContent='❌ Gagal.'; };
  xhr.send(fd);
};

// ── SUBMIT PROFIL (pertama kali / dari setup page) ────────
//     Langsung pending di talents collection
// ── SUBMIT DARI SETTING (talent sudah approved) ──────────
//     Simpan ke pending_edits collection → admin review dulu
window.submitProfile = async function() {
  const name      = document.getElementById('s-name')?.value.trim();
  const age       = parseInt(document.getElementById('s-age')?.value);
  const bio       = document.getElementById('s-bio')?.value.trim();
  const services  = [...document.querySelectorAll('.svc-ck:checked')].map(c=>c.value);
  const errEl     = document.getElementById('s-err');
  const btn       = document.getElementById('s-submit');
  errEl.style.display = 'none';

  if (!name)                { errEl.textContent='Nama wajib diisi.'; errEl.style.display='block'; return; }
  if (!age||age<18||age>35) { errEl.textContent='Umur harus 18–35 tahun.'; errEl.style.display='block'; return; }
  if (!services.length)     { errEl.textContent='Pilih minimal 1 layanan.'; errEl.style.display='block'; return; }

  // Foto: wajib kalau belum ada
  if (!_uploadedPhotoUrl && !currentTalent.img) {
    errEl.textContent='Upload foto profil terlebih dahulu.'; errEl.style.display='block'; return;
  }
  // Audio: wajib kalau belum ada
  if (!_uploadedAudioUrl && !currentTalent.audio) {
    errEl.textContent='Upload sample suara terlebih dahulu.'; errEl.style.display='block'; return;
  }

  btn.disabled=true; btn.textContent='Mengirim...';
  try {
    const finalImg   = _uploadedPhotoUrl   || currentTalent.img   || '';
    const finalAudio = _uploadedAudioUrl   || currentTalent.audio || '';
    const isApproved = currentTalent.status === 'approved';

    if (isApproved) {
      // ── Talent sudah approved → simpan ke pending_edits, bukan langsung ke talents
      await setDoc(doc(db, 'pending_edits', _docId), {
        talentDocId  : _docId,
        name, age, bio, services,
        img          : finalImg,
        audio        : finalAudio,
        submittedAt  : new Date().toISOString(),
        status       : 'pending',
      });
      // Tandai di talents bahwa ada pending edit
      await setDoc(doc(db, 'talents', _docId), { _pendingEdit: true }, { merge: true });
      currentTalent._pendingEdit = true;
      toast('✅ Perubahan dikirim! Menunggu persetujuan admin.', 'success');
      _uploadedAudioUrl = '';
      _uploadedPhotoUrl = '';
      // Re-render setting untuk tampilkan banner pending
      renderSettingsPanel();
    } else {
      // ── First time / rejected → langsung ke talents dengan status pending
      await setDoc(doc(db, 'talents', _docId), {
        name, age, bio, services,
        img          : finalImg,
        audio        : finalAudio,
        status       : 'pending',
        submittedAt  : new Date().toISOString(),
        _pendingEdit : false,
      }, { merge: true });
      currentTalent = { ...currentTalent, name, age, bio, services, img: finalImg, audio: finalAudio, status: 'pending' };
      toast('✅ Profil dikirim! Tunggu review admin.');
      _uploadedAudioUrl = '';
      _uploadedPhotoUrl = '';
      showPage('dashboard');
      updateBanner();
    }
  } catch(e) {
    errEl.textContent='Gagal: '+e.message;
    errEl.style.display='block';
  }
  btn.disabled=false;
  btn.textContent = currentTalent.status === 'approved'
    ? '📤 Simpan & Minta Persetujuan'
    : (currentTalent.status==='rejected' ? '📤 Kirim Ulang' : '📤 Submit untuk Review');
};

// ── STATUS ────────────────────────────────────────────────
function listenStatus() {
  onSnapshot(doc(db, 'talents', _docId), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    currentTalent = { ...currentTalent, ...data };
    updateStatusUI(data.online !== false);
    updateBanner();
    updatePointDisplay(data.points !== undefined ? data.points : 100);
    // Avatar & nama
    document.getElementById('t-avatar').textContent   = (data.name || _docId)[0].toUpperCase();
    document.getElementById('t-name-top').textContent = data.name || _docId;
  });
}

function updatePointDisplay(points) {
  const el = document.getElementById('talent-point-box');
  if (el) el.innerHTML = `
    <div style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.25);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
      <div style="font-size:2rem">⭐</div>
      <div>
        <div style="font-size:.72rem;font-weight:800;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Total Point Kamu</div>
        <div style="font-size:1.6rem;font-weight:900;color:#a78bfa">${points} Point</div>
      </div>
    </div>`;
}

function updateStatusUI(online) {
  const dot=document.getElementById('status-dot'), text=document.getElementById('status-text'), toggle=document.getElementById('status-toggle');
  if (!dot||!text||!toggle) return;
  dot.className    = 'status-dot '+(online?'online':'offline');
  text.textContent = online ? 'Kamu sedang ONLINE' : 'Kamu sedang OFFLINE';
  toggle.textContent = online ? 'Set Offline' : 'Set Online';
  toggle.className   = 'status-toggle'+(online?' active':'');
}

async function toggleStatus() {
  if (!_docId) return;
  const snap = await getDoc(doc(db, 'talents', _docId));
  const on   = snap.exists() ? snap.data().online !== false : false;
  await setDoc(doc(db, 'talents', _docId), { online: !on }, { merge: true });
  toast(on ? '⚫ Kamu OFFLINE' : '🟢 Kamu ONLINE');
}

// ── ORDERS ────────────────────────────────────────────────
function listenOrders() {
  DB.onOrdersChange(orders => {
    const name = currentTalent.name || _docId;
    renderMyOrders(orders.filter(o => o.talentName === name));
  });
}

function renderMyOrders(orders) {
  const el = document.getElementById('my-orders-list'); if (!el) return;
  if (!orders.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>Belum ada orderan</p></div>';
    return;
  }
  el.innerHTML = orders.map(o => {
    const statusColor = {
      baru:'var(--blue)', proses:'var(--yellow)', selesai:'var(--green)', batal:'var(--red)'
    }[o.status] || 'var(--muted)';
    return `
    <div class="order-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-weight:900;font-size:.97rem">${o.service||'-'}</div>
          <div style="font-size:.78rem;color:var(--muted);font-weight:600;margin-top:2px">${DUR_LABEL[o.duration]||o.duration+' mnt'} · ${o.date ? new Date(o.date).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:1rem;font-weight:900;color:var(--pink)">Rp ${(o.price||0).toLocaleString('id-ID')}</div>
          <span style="display:inline-block;margin-top:4px;padding:2px 10px;border-radius:99px;border:1.5px solid ${statusColor};color:${statusColor};font-size:.7rem;font-weight:800;text-transform:uppercase">${o.status}</span>
        </div>
      </div>
      ${o.note ? `<div style="font-size:.8rem;color:var(--muted);background:rgba(255,255,255,.04);border-radius:8px;padding:8px 12px;font-style:italic">${o.note}</div>` : ''}
    </div>`;
  }).join('');
}

// ── TABS ──────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('tab-orders').classList.toggle('active', tab==='orders');
  document.getElementById('tab-settings').classList.toggle('active', tab==='settings');
  document.getElementById('orders-section').style.display   = tab==='orders'   ? 'block' : 'none';
  document.getElementById('settings-section').style.display = tab==='settings' ? 'block' : 'none';
  if (tab === 'settings') renderSettingsPanel();
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await DB.getSettingsAsync();
  const session = getSession();
  if (session?.docId) {
    try {
      const snap = await getDoc(doc(db, 'talents', session.docId));
      if (snap.exists()) {
        _docId = session.docId;
        currentTalent = { id: session.docId, ...snap.data() };
        loadDashboard();
      } else clearSession();
    } catch { clearSession(); }
  }

  document.getElementById('t-login-btn').onclick = doLogin;
  document.getElementById('t-user').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('t-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('t-logout-btn').onclick = () => {
    clearSession(); currentTalent=null; _docId=null;
    // Bersihkan form login
    const userEl = document.getElementById('t-user');
    const passEl = document.getElementById('t-pass');
    const errEl  = document.getElementById('t-err');
    if (userEl) userEl.value = '';
    if (passEl) passEl.value = '';
    if (errEl)  { errEl.textContent = ''; errEl.style.display = 'none'; }
    showPage('login-page');
  };
  document.getElementById('status-toggle').onclick = toggleStatus;

  document.getElementById('tab-orders').onclick   = () => switchTab('orders');
  document.getElementById('tab-settings').onclick = () => switchTab('settings');
});