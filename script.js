// ============================================================
//  CALLPAY — MAIN SCRIPT (ES Module)
//  Import dari admin/data.js yang sudah pakai Firebase
// ============================================================
import { DB, TALENTS, PRICES, DUR_LABEL } from './admin/data.js';

// ── STATE ─────────────────────────────────────────────────────
let currentFilter = 'all';
let showAll       = false;
let activeTalent  = null;
const DEFAULT_IDS = new Set([1,2,3,4,9,10,11,12]);

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
  let list = currentFilter === 'all' ? TALENTS : TALENTS.filter(t => t.gender === currentFilter);
  grid.innerHTML = list.map(t => {
    let extraClass = currentFilter !== 'all'
      ? (list.indexOf(t) >= 8 ? 'extra' : '')
      : (DEFAULT_IDS.has(t.id) ? '' : 'extra');
    const showClass = (showAll && extraClass) ? 'show' : '';
    return `
    <div class="talent-card ${extraClass} ${showClass}" data-id="${t.id}">
      <div class="talent-photo">
        <img src="${t.img}" alt="${t.name}" loading="lazy">
        <span class="gender-pill ${t.gender}">${t.gender==='female'?'🌸 Wanita':'💙 Pria'}</span>
      </div>
      <div class="talent-body">
        <div class="talent-name">${t.name}</div>
        <div class="talent-meta">🎂 ${t.age} thn &nbsp;·&nbsp; 🇮🇩 Indonesia</div>
        <div class="talent-tags">${t.services.map(s=>`<span class="talent-tag">${s}</span>`).join('')}</div>
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

window.setFilter = function(type, el) {
  currentFilter = type;
  showAll = false;
  document.querySelectorAll('.filter-btn').forEach(b => { b.className='filter-btn'; });
  if(type==='all')    el.classList.add('fa');
  if(type==='female') el.classList.add('fp');
  if(type==='male')   el.classList.add('fm');
  renderTalents();
};

window.toggleSeeMore = function() {
  showAll = !showAll;
  document.querySelectorAll('.talent-card.extra').forEach(c => c.classList.toggle('show', showAll));
  const btn  = document.getElementById('see-more-btn');
  const list = currentFilter === 'all' ? TALENTS : TALENTS.filter(t => t.gender === currentFilter);
  const extraCount = currentFilter === 'all'
    ? list.filter(t => !DEFAULT_IDS.has(t.id)).length
    : list.slice(8).length;
  if (btn) {
    btn.classList.toggle('open', showAll);
    btn.innerHTML = showAll
      ? `Sembunyikan <span class="arr">▲</span>`
      : `Lihat ${extraCount} Talent Lainnya <span class="arr">▼</span>`;
  }
  if (!showAll) document.getElementById('talent').scrollIntoView({behavior:'smooth'});
};

// ============================================================
//  ORDER MODAL (dengan talent)
// ============================================================
window.openModal = function(id) {
  activeTalent = TALENTS.find(t => t.id === id);
  if (!activeTalent) return;
  document.getElementById('modal-img').src           = activeTalent.img;
  document.getElementById('modal-tname').textContent = activeTalent.name;
  document.getElementById('modal-tmeta').textContent = `${activeTalent.age} tahun · Indonesia`;
  document.getElementById('modal-service').value     = '';
  document.getElementById('modal-duration').innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('modal-customer').value    = '';
  document.getElementById('modal-wa').value          = '';
  document.getElementById('modal-note').value        = '';
  document.getElementById('modal-price').textContent = 'Pilih layanan & durasi';
  document.querySelector('.modal-backdrop').classList.add('open');
};

window.closeModal = function() {
  document.querySelector('.modal-backdrop').classList.remove('open');
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
      opt.value = min; opt.textContent = DUR_LABEL[min]||min+' menit';
      durSel.appendChild(opt);
    });
  } else {
    durSel.innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  }
};

window.updateModalPrice = function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const dur      = parseInt(document.getElementById('modal-duration').value);
  const el       = document.getElementById('modal-price');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = (svcLabel && dur) ? PRICES[svcLabel]?.[dur] : null;
  el.textContent = price ? 'Rp '+price.toLocaleString('id-ID') : 'Pilih layanan & durasi';
};

window.submitOrder = async function() {
  const svcEl  = document.getElementById('modal-service');
  const durEl  = document.getElementById('modal-duration');
  const name   = document.getElementById('modal-customer').value.trim();
  const wa     = document.getElementById('modal-wa').value.trim();
  const note   = document.getElementById('modal-note').value.trim();
  if (!svcEl.value || !durEl.value || !name || !wa) { alert('Mohon lengkapi semua field!'); return; }
  const dur      = parseInt(durEl.value);
  const svcLabel = SVC_KEY_TO_LABEL[svcEl.value];
  const durLabel = DUR_LABEL[dur] || durEl.options[durEl.selectedIndex].text;
  const price    = PRICES[svcLabel]?.[dur] ?? 0;

  const saved = await DB.addOrder({
    talentId:activeTalent.id, talentName:activeTalent.name,
    service:svcLabel, duration:dur, price,
    customerName:name, customerWa:wa, customerNote:note,
    orderType:'talent',
  });

  const cfg    = DB.getSettings();
  const waNum  = cfg.waNumber || '62895400709371';
  const masWA  = maskWA(wa);
  const lines  = [
    `Halo ${cfg.agencyName}! Saya mau pesan layanan 💕`,``,
    `━━━━━━━━━━━━━━━━━━━`,`📋 DETAIL ORDER`,`━━━━━━━━━━━━━━━━━━━`,
    `👤 Talent  : ${activeTalent.name}`,`💼 Layanan : ${svcLabel}`,
    `⏱ Durasi  : ${durLabel}`,`💰 Harga   : Rp ${price.toLocaleString('id-ID')}`,
    `━━━━━━━━━━━━━━━━━━━`,`📝 DATA PEMESAN`,`━━━━━━━━━━━━━━━━━━━`,
    `Nama   : ${name}`,`No. WA : ${masWA}`,
    note?`Catatan: ${note}`:null,``,`ID Order: ${(saved.id||'').slice(-8)}`,`Terima kasih! 🙏`,
  ].filter(l=>l!==null).join('\n');

  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(lines)}`, '_blank');
  closeModal();
  showOrderToast(activeTalent.name, svcLabel, durLabel);
};

// ============================================================
//  QUICK ORDER (tanpa talent)
// ============================================================
window.openQuickOrder = function() {
  document.getElementById('qo-service').value   = '';
  document.getElementById('qo-duration').innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('qo-gender').value    = '';
  document.getElementById('qo-customer').value  = '';
  document.getElementById('qo-wa').value        = '';
  document.getElementById('qo-note').value      = '';
  document.getElementById('qo-price').textContent = 'Pilih layanan & durasi';
  document.getElementById('quick-modal').classList.add('open');
};

window.closeQuickOrder = function() {
  document.getElementById('quick-modal').classList.remove('open');
};

window.updateQODurations = function() {
  const svcRaw   = document.getElementById('qo-service').value;
  const durSel   = document.getElementById('qo-duration');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const priceMap = svcLabel ? PRICES[svcLabel] : null;
  durSel.innerHTML = '<option value="">— Pilih Durasi —</option>';
  if (priceMap) {
    Object.entries(priceMap).forEach(([min]) => {
      const opt = document.createElement('option');
      opt.value = min; opt.textContent = DUR_LABEL[min]||min+' menit';
      durSel.appendChild(opt);
    });
  } else {
    durSel.innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  }
};

window.updateQOPrice = function() {
  const svcRaw   = document.getElementById('qo-service').value;
  const dur      = parseInt(document.getElementById('qo-duration').value);
  const el       = document.getElementById('qo-price');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = (svcLabel && dur) ? PRICES[svcLabel]?.[dur] : null;
  el.textContent = price ? 'Rp '+price.toLocaleString('id-ID') : 'Pilih layanan & durasi';
};

window.submitQuickOrder = async function() {
  const svcEl  = document.getElementById('qo-service');
  const durEl  = document.getElementById('qo-duration');
  const gender = document.getElementById('qo-gender').value;
  const name   = document.getElementById('qo-customer').value.trim();
  const wa     = document.getElementById('qo-wa').value.trim();
  const note   = document.getElementById('qo-note').value.trim();
  if (!svcEl.value || !durEl.value || !name || !wa) { alert('Mohon lengkapi semua field!'); return; }
  const dur      = parseInt(durEl.value);
  const svcLabel = SVC_KEY_TO_LABEL[svcEl.value];
  const durLabel = DUR_LABEL[dur] || durEl.options[durEl.selectedIndex].text;
  const price    = PRICES[svcLabel]?.[dur] ?? 0;

  const saved = await DB.addOrder({
    talentId:null, talentName:null, genderPref:gender||null,
    service:svcLabel, duration:dur, price,
    customerName:name, customerWa:wa, customerNote:note,
    orderType:'quick',
  });

  const cfg   = DB.getSettings();
  const waNum = cfg.waNumber || '62895400709371';
  const masWA = maskWA(wa);
  const lines = [
    `Halo ${cfg.agencyName}! Saya mau pesan layanan 💕`,``,
    `━━━━━━━━━━━━━━━━━━━`,`📋 DETAIL ORDER`,`━━━━━━━━━━━━━━━━━━━`,
    `💼 Layanan : ${svcLabel}`,`⏱ Durasi  : ${durLabel}`,
    `💰 Harga   : Rp ${price.toLocaleString('id-ID')}`,
    gender?`👤 Preferensi: ${gender==='female'?'Wanita 🌸':'Pria 💙'}`:null,
    `━━━━━━━━━━━━━━━━━━━`,`📝 DATA PEMESAN`,`━━━━━━━━━━━━━━━━━━━`,
    `Nama   : ${name}`,`No. WA : ${masWA}`,
    note?`Catatan: ${note}`:null,``,`ID Order: ${(saved.id||'').slice(-8)}`,`Terima kasih! 🙏`,
  ].filter(l=>l!==null).join('\n');

  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(lines)}`, '_blank');
  closeQuickOrder();
  showOrderToast('Admin', svcLabel, durLabel);
};

// ── HELPERS ───────────────────────────────────────────────────
function maskWA(wa) {
  const d = wa.replace(/\D/g,'');
  return d.length <= 4 ? d : '••••••' + d.slice(-4);
}

function showOrderToast(talent, svc, dur) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A2A;border:1px solid rgba(249,168,201,.3);border-radius:14px;padding:14px 22px;font-family:\'Nunito\',sans-serif;font-size:.88rem;font-weight:700;color:#F0EBF8;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9999;white-space:nowrap;animation:toastIn .3s ease both';
  el.innerHTML = `✅ Order <strong style="color:#F9A8C9">${talent}</strong> — ${svc} ${dur} terkirim!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── SCROLL ANIMATIONS ─────────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);} });
  }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});

  function observeCards() {
    document.querySelectorAll('.service-card,.testi-card,.talent-card').forEach(el => {
      el.classList.add('anim-card'); observer.observe(el);
    });
  }
  observeCards();
  const grid = document.getElementById('talent-grid');
  if (grid) new MutationObserver(observeCards).observe(grid, {childList:true});
}

// ── SECRET ADMIN ACCESS ────────────────────────────────────────
(function(){
  let buf='';
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if(['input','textarea','select'].includes(tag)) return;
    buf += e.key.toLowerCase();
    if(buf.length>5) buf=buf.slice(-5);
    if(buf.includes('admin')){buf=''; window.location.href='admin/index.html';}
  });
  let clicks=0, timer;
  document.addEventListener('DOMContentLoaded',()=>{
    const logo=document.querySelector('.nav-logo');
    if(!logo)return;
    logo.addEventListener('click',()=>{
      clicks++;clearTimeout(timer);
      timer=setTimeout(()=>{clicks=0;},2000);
      if(clicks>=5){clicks=0;window.location.href='admin/index.html';}
    });
  });
})();

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Preload settings
  await DB.getSettingsAsync();

  renderTalents();

  const allBtn = document.querySelector('.filter-btn');
  if (allBtn) allBtn.classList.add('fa');

  // Modal backdrop clicks
  const bd = document.querySelector('.modal-backdrop');
  if (bd) bd.addEventListener('click', e => { if(e.target===bd) closeModal(); });
  const qm = document.getElementById('quick-modal');
  if (qm) qm.addEventListener('click', e => { if(e.target===qm) closeQuickOrder(); });

  initScrollAnimations();
});