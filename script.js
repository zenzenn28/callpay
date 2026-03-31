// ============================================================
//  CALLPAY — MAIN SCRIPT
// ============================================================
import { DB, TALENTS, PRICES, DUR_LABEL } from './admin/data.js';

// ── STATE ─────────────────────────────────────────────────────
let currentFilter = 'all';
let showAll       = false;
let activeTalent  = null;
const ACTIVE_IDS  = new Set([1,2,3,4,9,10,11,12]);
const DEFAULT_IDS = ACTIVE_IDS;

const WA_NUMBER = '62895400709371';

const SVC_KEY_TO_LABEL = {
  'temen-call'   : 'Temen Call',
  'sleepcall'    : 'Sleepcall',
  'temen-curhat' : 'Temen Curhat',
  'pacar-virtual': 'Pacar Virtual',
};

// ============================================================
//  TALENT RENDER
// ============================================================
function renderTalents() {
  const grid = document.getElementById('talent-grid');
  if (!grid) return;
  // Tampilkan semua talent yang ada di TALENTS (sudah difilter approved saat load)
  const allActive = TALENTS;
  const list = currentFilter === 'all' ? allActive : allActive.filter(t => t.gender === currentFilter);
  grid.innerHTML = list.map(t => {
    const hasAudio = t.audio && t.audio.trim() !== '';
    return `
    <div class="talent-card" data-talent-id="${t.id}" onclick="${t.online === false ? `alert('Talent tidak available')` : `openModal('${t.id}')`}">
      <div class="talent-photo">
        <img src="${t.img}" alt="${t.name}" loading="lazy">
        <span class="gender-pill ${t.gender}">${t.gender === 'female' ? '🌸 Wanita' : '💙 Pria'}</span>
      </div>
      <div class="talent-body">
        <div class="talent-top">
          <div class="talent-name">${t.name}</div>
          <div class="talent-age">${t.age} tahun</div>
        </div>
        <div class="talent-tags">${t.services.map(s => `<span class="talent-tag">${s}</span>`).join('')}</div>
        <div class="talent-bio">${t.bio || 'Hai! Senang bisa menemani hari-harimu 💕'}</div>
        <div class="talent-footer">
          <button class="pesan-btn ${t.online === false ? 'offline' : ''}" onclick="event.stopPropagation();${t.online === false ? `alert('Talent tidak available')` : `openModal('${t.id}')`}">${t.online === false ? 'Tidak Available' : 'Pesan Sekarang'}</button>
          <button class="play-audio-btn ${hasAudio ? '' : 'no-audio'}" id="play-btn-${t.id}" onclick="event.stopPropagation();toggleAudio('${t.id}','${t.audio || ''}',this)" title="${hasAudio ? 'Preview Suara' : 'Audio belum tersedia'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="talent-status"><span class="status-dot${t.online === false ? ' offline' : ''}"></span> <span class="status-txt">${t.online === false ? 'OFFLINE' : 'ONLINE'}</span></div>
        </div>
      </div>
    </div>`;
  }).join('');
  updateSeeMoreBtn(list);
}

function updateSeeMoreBtn(list) {
  const wrap = document.getElementById('see-more-wrap');
  if (wrap) wrap.style.display = 'none'; // semua talent ditampilkan langsung
}

window.setFilter = function(type, el) {
  currentFilter = type;
  showAll = false;
  document.querySelectorAll('.gf-btn').forEach(b => { b.className = 'gf-btn'; });
  if (type === 'all')    el.classList.add('fa');
  if (type === 'female') el.classList.add('fp');
  if (type === 'male')   el.classList.add('fm');
  renderTalents();
};

window.toggleSeeMore = function() {
  showAll = !showAll;
  document.querySelectorAll('.talent-card.extra').forEach(c => c.classList.toggle('show', showAll));
  const btn  = document.getElementById('see-more-btn');
  const allActive = TALENTS;
  const list = currentFilter === 'all' ? allActive : allActive.filter(t => t.gender === currentFilter);
  const extraCount = currentFilter === 'all'
    ? list.filter(t => !DEFAULT_IDS.has(t.id)).length
    : list.slice(8).length;
  if (btn) {
    btn.classList.toggle('open', showAll);
    btn.innerHTML = showAll
      ? `Sembunyikan <span class="arr">▲</span>`
      : `Lihat ${extraCount} Talent Lainnya <span class="arr">▼</span>`;
  }
  if (!showAll) document.getElementById('talent').scrollIntoView({ behavior: 'smooth' });
};

// ============================================================
//  ORDER MODAL
// ============================================================
window.openModal = function(id) {
  activeTalent = TALENTS.find(t => String(t.id) === String(id));
  if (!activeTalent) return;
  document.getElementById('modal-img').src           = activeTalent.img;
  document.getElementById('modal-tname').textContent = activeTalent.name;
  document.getElementById('modal-tmeta').textContent = `${activeTalent.age} tahun · Indonesia`;
  document.getElementById('modal-service').value     = '';
  document.getElementById('modal-duration').innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('modal-note').value        = '';
  document.getElementById('modal-price').textContent = 'Pilih layanan & durasi';
  const btn = document.getElementById('modal-wa-btn');
  if (btn) { btn.disabled = true; }
  document.getElementById('order-modal').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('order-modal').classList.remove('open');
};

window.updateDurations = function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const durSel   = document.getElementById('modal-duration');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const priceMap = svcLabel ? PRICES[svcLabel] : null;
  durSel.innerHTML = '<option value="">— Pilih Durasi —</option>';
  if (priceMap) {
    Object.entries(priceMap).forEach(([min]) => {
      const opt = document.createElement('option');
      opt.value = min;
      opt.textContent = DUR_LABEL[min] || min + ' menit';
      durSel.appendChild(opt);
    });
  } else {
    durSel.innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  }
  updateModalPrice();
};

window.updateModalPrice = function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const dur      = parseInt(document.getElementById('modal-duration').value);
  const el       = document.getElementById('modal-price');
  const btn      = document.getElementById('modal-wa-btn');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = (svcLabel && dur) ? PRICES[svcLabel]?.[dur] : null;
  el.textContent = price ? 'Rp ' + price.toLocaleString('id-ID') : 'Pilih layanan & durasi';
  if (btn) btn.disabled = !price;
};

window.confirmViaWA = async function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const dur      = parseInt(document.getElementById('modal-duration').value);
  const note     = document.getElementById('modal-note').value.trim();
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = PRICES[svcLabel]?.[dur] ?? 0;
  const durLabel = DUR_LABEL[dur] || dur + ' menit';

  if (!svcLabel || !dur) {
    alert('Mohon pilih layanan dan durasi terlebih dahulu!');
    return;
  }

  // Disable tombol sementara
  const btn = document.getElementById('modal-wa-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

  try {
    // Simpan order ke Firestore
    await DB.addOrder({
      talentId   : String(activeTalent.id),
      talentName : activeTalent.name,
      service    : svcLabel,
      duration   : dur,
      price      : price,
      note       : note,
      orderType  : 'direct', // langsung pilih talent
    });
  } catch(e) {
    console.warn('Gagal simpan order:', e);
  }

  // Buka WhatsApp
  const msg = [
    `Halo CallPay! 👋`,
    ``,
    `Saya ingin memesan layanan:`,
    `👤 Talent: ${activeTalent.name}`,
    `🎯 Layanan: ${svcLabel}`,
    `⏱ Durasi: ${durLabel}`,
    `💰 Harga: Rp ${price.toLocaleString('id-ID')}`,
    note ? `📝 Catatan: ${note}` : '',
    ``,
    `Mohon konfirmasinya, terima kasih! 🙏`,
  ].filter(l => l !== undefined).join('\n');

  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');

  if (btn) { btn.disabled = false; btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" fill="white"><path d="M24 4C13 4 4 13 4 24c0 3.6 1 7 2.7 9.9L4 44l10.4-2.7C17.2 43 20.5 44 24 44c11 0 20-9 20-20S35 4 24 4zm0 36c-3.1 0-6.1-.8-8.7-2.4l-.6-.4-6.2 1.6 1.7-6-.4-.6C8.8 30.1 8 27.1 8 24 8 15.2 15.2 8 24 8s16 7.2 16 16-7.2 16-16 16zm8.7-11.8c-.5-.2-2.8-1.4-3.2-1.5-.4-.2-.7-.2-1 .2-.3.4-1.2 1.5-1.4 1.8-.3.3-.5.4-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.3-2.8-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.4-.8.1-.3 0-.6-.1-.8-.1-.2-1-2.5-1.4-3.4-.4-.9-.8-.8-1-.8h-.9c-.3 0-.8.1-1.2.6-.4.5-1.6 1.6-1.6 3.8s1.7 4.4 1.9 4.7c.2.3 3.3 5.1 8.1 7.1 1.1.5 2 .8 2.7 1 1.1.3 2.2.3 3 .2.9-.1 2.8-1.1 3.2-2.2.4-1.1.4-2 .3-2.2-.2-.3-.5-.4-1-.6z"/></svg> Konfirmasi via WhatsApp`; }
  closeModal();
};

// ============================================================
//  AUDIO PREVIEW
// ============================================================
let _activeAudio = null;
let _activeBtn   = null;

window.playTalentAudio = function(btn) {
  const tid = btn.dataset.tid;
  const t   = TALENTS.find(x => String(x.id) === String(tid));
  const url = t?.audio || '';
  toggleAudio(tid, url, btn);
};

window.toggleAudio = function(id, url, btn) {
  if (!url || url.trim() === '') {
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 500);
    return;
  }
  // Jika tombol yang sama diklik lagi → stop
  if (_activeAudio && _activeBtn === btn) {
    _activeAudio.pause();
    _activeAudio.currentTime = 0;
    _activeAudio = null;
    _activeBtn = null;
    btn.classList.remove('playing');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    return;
  }
  // Stop audio yang sedang main
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.currentTime = 0;
    _activeBtn.classList.remove('playing');
    _activeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  // Play yang baru - pakai Audio langsung tanpa crossOrigin (Cloudinary support)
  const audio = new Audio(url);
  btn.classList.add('playing');
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  _activeAudio = audio;
  _activeBtn   = btn;
  audio.play().catch(() => {
    btn.classList.remove('playing');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    _activeAudio = null; _activeBtn = null;
  });
  audio.onended = () => {
    btn.classList.remove('playing');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    _activeAudio = null;
    _activeBtn   = null;
  };
};

// ============================================================
//  SCROLL ANIMATIONS
// ============================================================
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function observeCards() {
    document.querySelectorAll('.service-card,.testi-card,.talent-card').forEach(el => {
      el.classList.add('anim-card');
      observer.observe(el);
    });
  }
  observeCards();
  const grid = document.getElementById('talent-grid');
  if (grid) new MutationObserver(observeCards).observe(grid, { childList: true });
}

// ============================================================
//  SECRET ADMIN ACCESS
// ============================================================
(function() {
  let buf = '';
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    buf += e.key.toLowerCase();
    if (buf.length > 5) buf = buf.slice(-5);
    if (buf.includes('admin')) { buf = ''; window.location.href = 'admin/index.html'; }
  });
  let clicks = 0, timer;
  document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.nav-logo');
    if (!logo) return;
    logo.addEventListener('click', () => {
      clicks++; clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 2000);
      if (clicks >= 5) { clicks = 0; window.location.href = 'admin/index.html'; }
    });
  });
})();

// ============================================================
//  LOAD AUDIO FROM FIRESTORE
// ============================================================
// ── Firebase init (shared) ────────────────────────────────
let _fbApp = null, _fbDb = null;
async function getFirebase() {
  if (_fbDb) return _fbDb;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js');
  const { getFirestore, collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
  const FIREBASE_CONFIG = {
    apiKey:'AIzaSyBLPe_yx28LyefI856Ysxz3YEPnwA0ENFU',
    authDomain:'callpay-28a28.firebaseapp.com',
    projectId:'callpay-28a28',
    storageBucket:'callpay-28a28.firebasestorage.app',
    messagingSenderId:'44722427776',
    appId:'1:44722427776:web:29d1a297746cd83d685365'
  };
  _fbApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  _fbDb  = getFirestore(_fbApp);
  return _fbDb;
}

async function loadAudioFromFirestore() {
  try {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    const db   = await getFirebase();
    const snap = await getDocs(collection(db, 'talents'));
    snap.forEach(d => {
      const data = d.data();
      // Sync data ke TALENTS array (talent lama berdasarkan nama)
      const t = TALENTS.find(x => x.name.toLowerCase() === d.id || String(x.id) === d.id);
      if (t) {
        t.audio   = data.audio  || t.audio || '';
        t.online  = data.online !== false;
        t.img     = data.img    || t.img;
        t.bio     = data.bio    || '';
        t.approved = data.status === 'approved' || !data.status;
      }
      // Talent baru dari Firestore yang sudah approved
      if (data.status === 'approved') {
        const exists = TALENTS.find(x => x.name.toLowerCase() === d.id || String(x.id) === d.id);
        if (!exists) {
          TALENTS.push({
            id       : d.id,
            name     : data.name     || d.id,
            age      : data.age      || 20,
            gender   : data.gender   || 'female',
            img      : data.img      || '',
            audio    : data.audio    || '',
            online   : data.online   !== false,
            bio      : data.bio      || '',
            services : data.services || [],
            approved : true,
          });
        }
      }
    });
  } catch(e) { console.warn('Gagal load data talent:', e); }
}

// Realtime status update — update dot tanpa re-render seluruh grid
async function listenTalentStatus() {
  try {
    const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    const db = await getFirebase();
    let _prevApprovedIds = new Set(TALENTS.map(t => String(t.id)));
    onSnapshot(collection(db, 'talents'), snap => {
      let needRerender = false;
      snap.forEach(d => {
        const data = d.data();
        const t    = TALENTS.find(x => x.name.toLowerCase() === d.id || String(x.id) === d.id);
        if (t) {
          t.online = data.online !== false;
          t.audio  = data.audio || t.audio || '';
          t.approved = data.status === 'approved' || !data.status;
          // Update dot langsung di DOM
          const card = document.querySelector(`[data-talent-id="${t.id}"]`);
          const dot  = card?.querySelector('.status-dot');
          const txt  = card?.querySelector('.status-txt');
          if (dot) dot.className = 'status-dot' + (t.online ? '' : ' offline');
          if (txt) txt.textContent = t.online ? 'ONLINE' : 'OFFLINE';
        } else if (data.status === 'approved') {
          // Talent baru yang baru di-approve — tambah dan re-render
          TALENTS.push({
            id: d.id, name: data.name||d.id, age: data.age||20,
            gender: data.gender||'female', img: data.img||'',
            audio: data.audio||'', online: data.online!==false,
            bio: data.bio||'', services: data.services||[], approved: true,
          });
          needRerender = true;
        }
      });
      if (needRerender) renderTalents();
    });
  } catch(e) { console.warn('Gagal listen status:', e); }
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await DB.getSettingsAsync(); // inisialisasi settings agar DB.addOrder bisa jalan
  await loadAudioFromFirestore();
  renderTalents();
  listenTalentStatus();
  const modal = document.getElementById('order-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  initScrollAnimations();
});