// ============================================================
//  CALLPAY — MAIN SCRIPT
//  TALENTS, PRICES, DUR_LABEL, DB semuanya dari admin/data.js
// ============================================================

// ── STATE ─────────────────────────────────────────────────────
let currentFilter = 'all';   // 'all' | 'female' | 'male'
let showAll       = false;
let activeTalent  = null;

// Default visible: 4 wanita (id 1-4) + 4 pria (id 9-12)
const DEFAULT_IDS = new Set([1, 2, 3, 4, 9, 10, 11, 12]);

// ============================================================
//  RENDER TALENTS
// ============================================================
function renderTalents() {
  const grid = document.getElementById('talent-grid');
  if (!grid) return;

  let list = currentFilter === 'all'
    ? TALENTS
    : TALENTS.filter(t => t.gender === currentFilter);

  grid.innerHTML = list.map(t => {
    let extraClass = '';
    if (currentFilter !== 'all') {
      extraClass = list.indexOf(t) >= 8 ? 'extra' : '';
    } else {
      extraClass = DEFAULT_IDS.has(t.id) ? '' : 'extra';
    }
    const showClass = (showAll && extraClass) ? 'show' : '';

    return `
    <div class="talent-card ${extraClass} ${showClass}" data-id="${t.id}">
      <div class="talent-photo">
        <img src="${t.img}" alt="${t.name}" loading="lazy">
        <span class="gender-pill ${t.gender}">${t.gender === 'female' ? '🌸 Wanita' : '💙 Pria'}</span>
      </div>
      <div class="talent-body">
        <div class="talent-name">${t.name}</div>
        <div class="talent-meta">🎂 ${t.age} thn &nbsp;·&nbsp; 🇮🇩 Indonesia</div>
        <div class="talent-tags">
          ${t.services.map(s => `<span class="talent-tag">${s}</span>`).join('')}
        </div>
        <button class="pesan-btn" onclick="openModal(${t.id})">💬 Pesan</button>
      </div>
    </div>`;
  }).join('');

  updateSeeMoreBtn(list);
}

function updateSeeMoreBtn(list) {
  const wrap = document.getElementById('see-more-wrap');
  const btn  = document.getElementById('see-more-btn');
  if (!wrap || !btn) return;

  const extraCount = currentFilter === 'all'
    ? list.filter(t => !DEFAULT_IDS.has(t.id)).length
    : list.slice(8).length;

  wrap.style.display = extraCount > 0 ? 'block' : 'none';
  btn.classList.toggle('open', showAll);
  btn.innerHTML = showAll
    ? `Sembunyikan <span class="arr">▲</span>`
    : `Lihat ${extraCount} Talent Lainnya <span class="arr">▼</span>`;
}

// ── FILTER ────────────────────────────────────────────────────
function setFilter(type, el) {
  currentFilter = type;
  showAll = false;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.className = 'filter-btn';
  });
  if (type === 'all')    el.classList.add('fa');
  if (type === 'female') el.classList.add('fp');
  if (type === 'male')   el.classList.add('fm');
  renderTalents();
}

// ── SEE MORE TOGGLE ───────────────────────────────────────────
function toggleSeeMore() {
  showAll = !showAll;
  document.querySelectorAll('.talent-card.extra').forEach(c => {
    c.classList.toggle('show', showAll);
  });
  const btn  = document.getElementById('see-more-btn');
  const list = currentFilter === 'all'
    ? TALENTS
    : TALENTS.filter(t => t.gender === currentFilter);
  const extraCount = currentFilter === 'all'
    ? list.filter(t => !DEFAULT_IDS.has(t.id)).length
    : list.slice(8).length;

  if (btn) {
    btn.classList.toggle('open', showAll);
    btn.innerHTML = showAll
      ? `Sembunyikan <span class="arr">▲</span>`
      : `Lihat ${extraCount} Talent Lainnya <span class="arr">▼</span>`;
  }
  if (!showAll) {
    document.getElementById('talent').scrollIntoView({ behavior: 'smooth' });
  }
}

// ============================================================
//  ORDER MODAL
// ============================================================
function openModal(id) {
  activeTalent = TALENTS.find(t => t.id === id);
  if (!activeTalent) return;

  document.getElementById('modal-img').src              = activeTalent.img;
  document.getElementById('modal-tname').textContent    = activeTalent.name;
  document.getElementById('modal-tmeta').textContent    = `${activeTalent.age} tahun · Indonesia`;
  document.getElementById('modal-service').value        = '';
  document.getElementById('modal-duration').innerHTML     = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('modal-duration').value       = '';
  document.getElementById('modal-customer').value       = '';
  document.getElementById('modal-wa').value             = '';
  document.getElementById('modal-note').value           = '';
  document.getElementById('modal-price').textContent    = 'Pilih layanan & durasi';
  document.querySelector('.modal-backdrop').classList.add('open');
}

function closeModal() {
  document.querySelector('.modal-backdrop').classList.remove('open');
}

// Isi opsi durasi sesuai layanan yang dipilih
function updateDurations() {
  const svcRaw   = document.getElementById('modal-service').value;
  const durSel   = document.getElementById('modal-duration');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const priceMap = svcLabel ? PRICES[svcLabel] : null;

  durSel.innerHTML = '<option value="">— Pilih Durasi —</option>';

  if (priceMap) {
    Object.entries(priceMap).forEach(([min, harga]) => {
      const opt = document.createElement('option');
      opt.value       = min;
      opt.textContent = DUR_LABEL[min] || min + ' menit';
      durSel.appendChild(opt);
    });
  } else {
    durSel.innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  }
}

function updateModalPrice() {
  const svcRaw   = document.getElementById('modal-service').value;
  const dur      = parseInt(document.getElementById('modal-duration').value);
  const el       = document.getElementById('modal-price');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = (svcLabel && dur) ? PRICES[svcLabel]?.[dur] : null;

  el.textContent = price
    ? 'Rp ' + price.toLocaleString('id-ID')
    : 'Pilih layanan & durasi';
}

// mapping key select → label PRICES
const SVC_KEY_TO_LABEL = {
  'temen-call'   : 'Temen Call',
  'sleepcall'    : 'Sleepcall',
  'temen-curhat' : 'Temen Curhat',
  'pacar-virtual': 'Pacar Virtual',
};

function submitOrder() {
  const svcEl  = document.getElementById('modal-service');
  const durEl  = document.getElementById('modal-duration');
  const name   = document.getElementById('modal-customer').value.trim();
  const wa     = document.getElementById('modal-wa').value.trim();
  const note   = document.getElementById('modal-note').value.trim();

  if (!svcEl.value || !durEl.value || !name || !wa) {
    alert('Mohon lengkapi semua field yang wajib diisi!');
    return;
  }

  const dur      = parseInt(durEl.value);
  const svcLabel = SVC_KEY_TO_LABEL[svcEl.value];
  const durLabel = DUR_LABEL[dur] || durEl.options[durEl.selectedIndex].text;
  const price    = PRICES[svcLabel]?.[dur] ?? 0;

  // ── Simpan ke localStorage via DB ─────────────────────────
  const saved = DB.addOrder({
    talentId    : activeTalent.id,
    talentName  : activeTalent.name,
    service     : svcLabel,
    duration    : dur,
    price       : price,
    customerName: name,
    customerWa  : wa,
    customerNote: note,
  });

  // ── Template pesan WA ──────────────────────────────────────
  const cfg      = DB.getSettings();
  const waTarget = cfg.waNumber || '62895400709371';

  const lines = [
    `Halo ${cfg.agencyName}! Saya mau pesan layanan 💕`,
    ``,
    `━━━━━━━━━━━━━━━━━━━`,
    `📋 DETAIL ORDER`,
    `━━━━━━━━━━━━━━━━━━━`,
    `👤 Talent  : ${activeTalent.name}`,
    `💼 Layanan : ${svcLabel}`,
    `⏱ Durasi  : ${durLabel}`,
    `💰 Harga   : Rp ${price.toLocaleString('id-ID')}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `📝 DATA PEMESAN`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Nama   : ${name}`,
    `No. WA : ${wa}`,
  ];
  if (note) lines.push(`Catatan: ${note}`);
  lines.push(``, `ID Order: ${saved.id.slice(-8)}`, `Terima kasih! 🙏`);

  window.open(`https://wa.me/${waTarget}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  closeModal();
  showOrderToast(activeTalent.name, svcLabel, durLabel);
}

// ── TOAST ──────────────────────────────────────────────────────
function showOrderToast(talent, svc, dur) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1A1A2A', 'border:1px solid rgba(249,168,201,.3)',
    'border-radius:14px', 'padding:14px 22px',
    "font-family:'Nunito',sans-serif", 'font-size:.88rem', 'font-weight:700',
    'color:#F0EBF8', 'box-shadow:0 8px 32px rgba(0,0,0,.5)',
    'z-index:9999', 'white-space:nowrap',
    'animation:toastIn .3s ease both',
  ].join(';');
  el.innerHTML = `✅ Order <strong style="color:#F9A8C9">${talent}</strong> — ${svc} ${dur} terkirim!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============================================================
//  SECRET ADMIN ACCESS
//  Ketik "admin" di keyboard ATAU klik logo 5x
// ============================================================
(function () {
  // keyboard buffer
  let buf = '';
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    buf += e.key.toLowerCase();
    if (buf.length > 5) buf = buf.slice(-5);
    if (buf.includes('admin')) {
      buf = '';
      window.location.href = window.location.pathname.replace(/\/[^\/]*$/, '') + '/admin/index.html';
    }
  });

  // logo 5x click
  let clicks = 0, timer;
  document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.nav-logo');
    if (!logo) return;
    logo.addEventListener('click', () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 2000);
      if (clicks >= 5) {
        clicks = 0;
        window.location.href = window.location.pathname.replace(/\/[^\/]*$/, '') + '/admin/index.html';
      }
    });
  });
})();


// ============================================================
//  AUTO LOGOUT — ketika user kembali ke halaman utama,
//  session admin otomatis dihapus
// ============================================================
(function () {
  // Hapus session saat halaman utama dimuat
  DB.setLogin(false);
})();

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // render talent grid
  renderTalents();

  // set default filter btn active
  const allBtn = document.querySelector('.filter-btn');
  if (allBtn) allBtn.classList.add('fa');

  // close modal on backdrop click
  const bd = document.querySelector('.modal-backdrop');
  if (bd) bd.addEventListener('click', e => {
    if (e.target === bd) closeModal();
  });
});

// ============================================================
//  SCROLL-IN ANIMATION (Intersection Observer)
//  Card muncul saat di-scroll ke layar
// ============================================================
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // hanya animasi sekali
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Observe semua card yang ada sekarang
  function observeCards() {
    document.querySelectorAll(
      '.service-card, .testi-card, .talent-card'
    ).forEach(el => {
      el.classList.add('anim-card');
      observer.observe(el);
    });
  }

  observeCards();

  // Re-observe setelah talent grid di-render ulang (filter / see more)
  const grid = document.getElementById('talent-grid');
  if (grid) {
    const mo = new MutationObserver(observeCards);
    mo.observe(grid, { childList: true });
  }
}

document.addEventListener('DOMContentLoaded', initScrollAnimations);