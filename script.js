// ============================================================
//  CALLPAY — MAIN SCRIPT (ES Module)
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
        <div style="display:flex;gap:8px;margin-top:auto">
          <button class="play-btn" id="play-${t.id}" onclick="playSample(${t.id},'${t.name}','${t.gender}')" title="Dengar suara sample" style="width:100%">
            ▶ Sample Suara
          </button>
        </div>
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
//  TALENT ORDER MODAL
// ============================================================
window.openModal = function(id) {
  activeTalent = TALENTS.find(t => t.id === id);
  if (!activeTalent) return;
  document.getElementById('modal-img').src            = activeTalent.img;
  document.getElementById('modal-tname').textContent  = activeTalent.name;
  document.getElementById('modal-tmeta').textContent  = `${activeTalent.age} tahun · Indonesia`;
  document.getElementById('modal-service').value      = '';
  document.getElementById('modal-duration').innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('modal-wa').value           = '';
  document.getElementById('modal-note').value         = '';
  document.getElementById('modal-price').textContent  = 'Pilih layanan & durasi';
  // Reset checkbox & button
  const ag  = document.getElementById('modal-agree');
  const btn = document.getElementById('modal-confirm-btn');
  if(ag)  ag.checked = false;
  if(btn){ btn.disabled=true; btn.style.opacity='.4'; btn.style.cursor='not-allowed'; }
  document.getElementById('talent-modal').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('talent-modal').classList.remove('open');
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

window.toggleModalConfirm = function() {
  const agreed = document.getElementById('modal-agree')?.checked ?? false;
  const btn    = document.getElementById('modal-confirm-btn');
  if (!btn) return;
  btn.disabled      = !agreed;
  btn.style.opacity = agreed ? '1' : '.4';
  btn.style.cursor  = agreed ? 'pointer' : 'not-allowed';
};

window.submitOrder = async function() {
  const svcEl = document.getElementById('modal-service');
  const durEl = document.getElementById('modal-duration');
  const wa    = document.getElementById('modal-wa').value.trim();
  const note  = document.getElementById('modal-note').value.trim();
  if (!svcEl.value || !durEl.value || !wa) {
    alert('Mohon lengkapi layanan, durasi, dan nomor WhatsApp!');
    return;
  }
  const dur      = parseInt(durEl.value);
  const svcLabel = SVC_KEY_TO_LABEL[svcEl.value];
  const price    = PRICES[svcLabel]?.[dur] ?? 0;

  const saved = await DB.addOrder({
    talentId:activeTalent.id, talentName:activeTalent.name,
    service:svcLabel, duration:dur, price,
    customerWa:wa, customerNote:note,
    orderType:'talent',
  });

  closeModal();
  // Redirect ke cek-order dengan kode order
  window.location.href = `cek-order.html?code=${encodeURIComponent(saved.id||'')}`;
};

// ============================================================
//  QUICK ORDER MODAL (tanpa talent)
// ============================================================
window.openQuickOrder = function() {
  document.getElementById('qo-service').value      = '';
  document.getElementById('qo-duration').innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('qo-wa').value           = '';
  document.getElementById('qo-note').value         = '';
  document.getElementById('qo-price').textContent  = 'Pilih layanan & durasi';
  // Reset talent picks
  document.querySelectorAll('.talent-pick-cb').forEach(cb => cb.checked = false);
  updateTalentPickInfo();
  // Reset all-talent button
  const allBtn = document.getElementById('btn-all-talent');
  if (allBtn) { allBtn.style.background='transparent'; allBtn.textContent='Semua Talent'; }
  // Reset checkbox & button
  const ag  = document.getElementById('qo-agree');
  const btn = document.getElementById('qo-confirm-btn');
  if(ag)  ag.checked = false;
  if(btn){ btn.disabled=true; btn.style.opacity='.4'; btn.style.cursor='not-allowed'; }
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

window.toggleQOConfirm = function() {
  const agreed = document.getElementById('qo-agree')?.checked ?? false;
  const btn    = document.getElementById('qo-confirm-btn');
  if (!btn) return;
  btn.disabled      = !agreed;
  btn.style.opacity = agreed ? '1' : '.4';
  btn.style.cursor  = agreed ? 'pointer' : 'not-allowed';
};

window.submitQuickOrder = async function() {
  const svcEl = document.getElementById('qo-service');
  const durEl = document.getElementById('qo-duration');
  const wa    = document.getElementById('qo-wa').value.trim();
  const note  = document.getElementById('qo-note').value.trim();
  if (!svcEl.value || !durEl.value || !wa) {
    alert('Mohon lengkapi layanan, durasi, dan nomor WhatsApp!');
    return;
  }

  // Ambil talent yang dipilih
  const checked  = [...document.querySelectorAll('.talent-pick-cb:checked')];
  const allBtn   = document.getElementById('btn-all-talent');
  const isAllMode = allBtn?.dataset.allSelected === 'true';

  if (!checked.length) {
    alert('Pilih minimal 1 talent atau klik "Semua Talent"!');
    return;
  }

  const selectedTalents = checked.map(cb => ({
    id  : parseInt(cb.value),
    name: cb.dataset.name,
    gender: cb.dataset.gender,
  }));

  const dur      = parseInt(durEl.value);
  const svcLabel = SVC_KEY_TO_LABEL[svcEl.value];
  const price    = PRICES[svcLabel]?.[dur] ?? 0;

  // Hitung total talent per gender
  const totalFemale = document.querySelectorAll('.talent-pick-cb[data-gender="female"]').length;
  const totalMale   = document.querySelectorAll('.talent-pick-cb[data-gender="male"]').length;
  const totalAll    = totalFemale + totalMale;

  const pickedFemale = selectedTalents.filter(t => t.gender === 'female').length;
  const pickedMale   = selectedTalents.filter(t => t.gender === 'male').length;
  const pickedTotal  = selectedTalents.length;

  // Bid biasa kalau:
  // - Semua 16 talent dipilih, ATAU
  // - Semua wanita (8) dipilih, ATAU
  // - Semua pria (8) dipilih
  const isRegular = isAllMode ||
    pickedTotal === totalAll ||
    pickedFemale === totalFemale ||
    pickedMale   === totalMale;

  const bidType = isRegular ? 'regular' : 'special';

  const saved = await DB.addOrder({
    talentId:null, talentName:null,
    service:svcLabel, duration:dur, price,
    customerWa:wa, customerNote:note,
    orderType    : 'quick',
    bidType      : bidType,
    // Kalau semua talent → targetTalents kosong (semua bisa lihat)
    // Kalau spesifik → isi nama talent yang ditarget
    targetTalents: isAllMode ? [] : selectedTalents,
  });

  closeQuickOrder();
  window.location.href = `cek-order.html?code=${encodeURIComponent(saved.id||'')}`;
};


// ============================================================
//  TALENT PICKER — pilih talent spesifik atau semua
// ============================================================
window.selectGender = function(gender) {
  // Pilih semua talent dari gender tertentu
  const allBtn = document.getElementById('btn-all-talent');
  if (allBtn) { allBtn.dataset.allSelected = 'false'; allBtn.style.background='transparent'; allBtn.textContent='Semua Talent'; }
  document.querySelectorAll(`.talent-pick-cb[data-gender="${gender}"]`).forEach(cb => cb.checked = true);
  updateTalentPickInfo();
};

window.onTalentPickChange = function() {
  // Kalau user uncheck manual, reset all-mode
  const allBtn = document.getElementById('btn-all-talent');
  if (allBtn) {
    allBtn.dataset.allSelected = 'false';
    allBtn.style.background    = 'transparent';
    allBtn.textContent         = 'Semua Talent';
  }
  updateTalentPickInfo();
};

window.selectAllTalents = function() {
  const allBtn = document.getElementById('btn-all-talent');
  const cbs    = document.querySelectorAll('.talent-pick-cb');
  const isAll  = allBtn?.dataset.allSelected === 'true';

  if (isAll) {
    // Toggle off — uncheck all
    cbs.forEach(cb => cb.checked = false);
    allBtn.dataset.allSelected = 'false';
    allBtn.style.background    = 'transparent';
    allBtn.textContent         = 'Semua Talent';
  } else {
    // Check all
    cbs.forEach(cb => cb.checked = true);
    allBtn.dataset.allSelected = 'true';
    allBtn.style.background    = 'rgba(249,168,201,.15)';
    allBtn.style.borderColor   = 'var(--pink-mid)';
    allBtn.textContent         = '✓ Semua Talent';
  }
  updateTalentPickInfo();
};

function updateTalentPickInfo() {
  const allBtn      = document.getElementById('btn-all-talent');
  const isAll       = allBtn?.dataset.allSelected === 'true';
  const info        = document.getElementById('talent-pick-info');
  if (!info) return;

  const totalFemale  = document.querySelectorAll('.talent-pick-cb[data-gender="female"]').length;
  const totalMale    = document.querySelectorAll('.talent-pick-cb[data-gender="male"]').length;
  const totalAll     = totalFemale + totalMale;
  const pickedFemale = document.querySelectorAll('.talent-pick-cb[data-gender="female"]:checked').length;
  const pickedMale   = document.querySelectorAll('.talent-pick-cb[data-gender="male"]:checked').length;
  const pickedTotal  = pickedFemale + pickedMale;

  const isRegular = isAll ||
    pickedTotal === totalAll ||
    pickedFemale === totalFemale ||
    pickedMale   === totalMale;

  if (pickedTotal === 0) {
    info.textContent = '0 talent dipilih';
    info.style.color = 'var(--muted)';
  } else if (isRegular) {
    info.textContent = `✓ ${pickedTotal} talent dipilih — notifikasi bid biasa`;
    info.style.color = 'var(--green)';
  } else {
    info.textContent = `⭐ ${pickedTotal} talent dipilih — notifikasi bid spesial`;
    info.style.color = 'var(--pink)';
  }
}

// ============================================================
//  SAMPLE SUARA — Web Speech API
// ============================================================
let _activeSpeech = null;

window.playSample = function(id, name, gender) {
  const btn = document.getElementById('play-' + id);
  if (_activeSpeech && btn.classList.contains('playing')) {
    window.speechSynthesis.cancel();
    _activeSpeech = null;
    btn.innerHTML = '▶ Sample Suara';
    btn.classList.remove('playing');
    return;
  }
  window.speechSynthesis.cancel();
  document.querySelectorAll('.play-btn.playing').forEach(b => {
    b.innerHTML = '▶ Sample Suara';
    b.classList.remove('playing');
  });
  const texts = gender === 'female' ? [
    `Halo! Aku ${name}, senang bisa menemanimu hari ini.`,
    `Hai, aku ${name}! Aku siap menemanimu kapanpun kamu butuh.`,
    `Halo, aku ${name}. Cerita aja ya, aku siap dengerin kamu.`,
  ] : [
    `Halo! Aku ${name}, senang bisa menemanimu hari ini.`,
    `Hai, aku ${name}! Siap menemani dan ngobrol bareng kamu.`,
    `Halo, aku ${name}. Santai aja, aku di sini buat kamu.`,
  ];
  const text  = texts[Math.floor(Math.random() * texts.length)];
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = 'id-ID';
  utter.rate   = 0.92;
  utter.pitch  = gender === 'female' ? 1.25 : 0.85;
  utter.volume = 1;
  const voices   = window.speechSynthesis.getVoices();
  const idVoices = voices.filter(v => v.lang.startsWith('id'));
  if (idVoices.length) utter.voice = idVoices[0];
  btn.innerHTML = '⏹ Stop';
  btn.classList.add('playing');
  _activeSpeech = utter;
  utter.onend = utter.onerror = () => {
    btn.innerHTML = '▶ Sample Suara';
    btn.classList.remove('playing');
    _activeSpeech = null;
  };
  window.speechSynthesis.speak(utter);
};
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// ============================================================
//  SCROLL ANIMATIONS
// ============================================================
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

// ============================================================
//  SECRET ADMIN ACCESS
// ============================================================
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

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await DB.getSettingsAsync();
  renderTalents();
  const allBtn = document.querySelector('.filter-btn');
  if (allBtn) allBtn.classList.add('fa');
  const bd = document.getElementById('talent-modal');
  if (bd) bd.addEventListener('click', e => { if(e.target===bd) closeModal(); });
  const qm = document.getElementById('quick-modal');
  if (qm) qm.addEventListener('click', e => { if(e.target===qm) closeQuickOrder(); });
  initScrollAnimations();
});