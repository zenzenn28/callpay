// ============================================================
//  CALLPAY — SHARED DATA LAYER
//  Semua baca/tulis data terpusat di sini.
//  Nanti kalau upgrade backend, cukup ganti fungsi-fungsi ini.
// ============================================================

const DB = {
  // ── KEYS ──────────────────────────────────────────────────
  ORDERS_KEY   : 'cp_orders',
  SETTINGS_KEY : 'cp_settings',
  SESSION_KEY  : 'cp_admin',

  // ── DEFAULT SETTINGS ──────────────────────────────────────
  defaultSettings() {
    return {
      username    : 'admin',
      password    : 'callpay2021',
      waNumber    : '62895400709371',
      agencyName  : 'CallPay Agency',
      instagram   : '@callpay.id',
      agencyCut   : 40,   // persen potongan agency
    };
  },

  // ── SETTINGS ──────────────────────────────────────────────
  getSettings() {
    try {
      const s = localStorage.getItem(this.SETTINGS_KEY);
      const merged = s ? { ...this.defaultSettings(), ...JSON.parse(s) } : this.defaultSettings();
      // Force-update jika nomor WA masih placeholder lama
      if (!merged.waNumber || merged.waNumber.includes('xxxxxxxxxx')) {
        merged.waNumber = this.defaultSettings().waNumber;
        this.saveSettings(merged);
      }
      return merged;
    } catch { return this.defaultSettings(); }
  },
  saveSettings(obj) {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(obj));
  },

  // ── SESSION ───────────────────────────────────────────────
  isLoggedIn()   { return sessionStorage.getItem(this.SESSION_KEY) === '1'; },
  setLogin(v)    { v ? sessionStorage.setItem(this.SESSION_KEY,'1') : sessionStorage.removeItem(this.SESSION_KEY); },

  // ── ORDERS ────────────────────────────────────────────────
  getOrders() {
    try {
      const raw = localStorage.getItem(this.ORDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  saveOrders(arr) {
    localStorage.setItem(this.ORDERS_KEY, JSON.stringify(arr));
  },
  addOrder(order) {
    const orders = this.getOrders();
    order.id     = 'ORD-' + Date.now();
    order.date   = new Date().toISOString();
    order.status = 'baru';
    orders.unshift(order);
    this.saveOrders(orders);
    return order;
  },
  deleteOrder(id) {
    this.saveOrders(this.getOrders().filter(o => o.id !== id));
  },
  deleteAllOrders() {
    this.saveOrders([]);
  },
  updateOrderStatus(id, status) {
    const orders = this.getOrders();
    const o = orders.find(x => x.id === id);
    if (o) { o.status = status; this.saveOrders(orders); }
  },

  // ── AUTO STATUS ───────────────────────────────────────────
  // Hitung status otomatis berdasarkan waktu:
  // 0 - 5 mnt   → baru
  // 5 mnt - (5 + durasi) mnt → proses
  // setelah itu  → selesai
  // Jika admin sudah manual set 'batal', tidak diubah
  computeStatus(order) {
    if (order.status === 'batal') return 'batal';
    const now        = Date.now();
    const created    = new Date(order.date).getTime();
    const elapsedMin = (now - created) / 60000;
    const durMin     = Number(order.duration) || 60;
    if (elapsedMin < 5)              return 'baru';
    if (elapsedMin < 5 + durMin)     return 'proses';
    return 'selesai';
  },

  // Jalankan auto-status pada semua order & simpan jika ada perubahan
  syncStatuses() {
    const orders  = this.getOrders();
    let changed   = false;
    orders.forEach(o => {
      if (o.status === 'batal') return; // skip manual batal
      const computed = this.computeStatus(o);
      if (o.status !== computed) { o.status = computed; changed = true; }
    });
    if (changed) this.saveOrders(orders);
    return orders;
  },

  // ── HELPERS ───────────────────────────────────────────────
  formatRp(num) {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  },
  formatDate(iso) {
    return new Date(iso).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'});
  },
  // Sisa waktu dalam format string, e.g. "42 mnt lagi" atau "Selesai"
  timeRemaining(order) {
    if (order.status === 'batal') return '—';
    const now        = Date.now();
    const created    = new Date(order.date).getTime();
    const elapsedMin = (now - created) / 60000;
    const durMin     = Number(order.duration) || 60;
    if (elapsedMin < 5) {
      const secLeft = Math.ceil((5 - elapsedMin) * 60);
      return `Mulai dalam ${secLeft}d`;
    }
    if (elapsedMin < 5 + durMin) {
      const minLeft = Math.ceil((5 + durMin) - elapsedMin);
      return `${minLeft} mnt lagi`;
    }
    return 'Selesai';
  },
};

// ── TALENT MASTER DATA ────────────────────────────────────────
const TALENTS = [
  { id:1,  name:'Nadia',  age:21, gender:'female', img:'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80', services:['Temen Call','Sleepcall','Pacar Virtual'] },
  { id:2,  name:'Bella',  age:22, gender:'female', img:'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=400&q=80', services:['Temen Call','Temen Curhat','Sleepcall'] },
  { id:3,  name:'Citra',  age:20, gender:'female', img:'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', services:['Sleepcall','Pacar Virtual'] },
  { id:4,  name:'Salsa',  age:23, gender:'female', img:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80', services:['Temen Call','Temen Curhat','Pacar Virtual'] },
  { id:5,  name:'Putri',  age:21, gender:'female', img:'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80', services:['Temen Curhat','Sleepcall'] },
  { id:6,  name:'Rara',   age:24, gender:'female', img:'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=400&q=80', services:['Temen Call','Sleepcall','Pacar Virtual'] },
  { id:7,  name:'Dea',    age:20, gender:'female', img:'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&q=80', services:['Temen Call','Temen Curhat'] },
  { id:8,  name:'Vika',   age:22, gender:'female', img:'https://images.unsplash.com/photo-1515023115689-589c33041d3c?w=400&q=80', services:['Sleepcall','Pacar Virtual'] },
  { id:9,  name:'Rizky',  age:23, gender:'male',   img:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', services:['Temen Call','Sleepcall','Pacar Virtual'] },
  { id:10, name:'Dimas',  age:24, gender:'male',   img:'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', services:['Temen Call','Temen Curhat'] },
  { id:11, name:'Aldi',   age:21, gender:'male',   img:'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', services:['Sleepcall','Pacar Virtual'] },
  { id:12, name:'Fariz',  age:22, gender:'male',   img:'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80', services:['Temen Call','Temen Curhat','Sleepcall'] },
  { id:13, name:'Kevin',  age:23, gender:'male',   img:'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80', services:['Temen Call','Pacar Virtual'] },
  { id:14, name:'Aryo',   age:25, gender:'male',   img:'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&q=80', services:['Temen Curhat','Sleepcall'] },
  { id:15, name:'Bram',   age:22, gender:'male',   img:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', services:['Temen Call','Sleepcall','Pacar Virtual'] },
  { id:16, name:'Hendra', age:24, gender:'male',   img:'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80', services:['Temen Curhat','Pacar Virtual'] },
];

const PRICES = {
  'Temen Call':    {30:10000, 60:20000, 90:25000, 120:35000, 180:50000},
  'Sleepcall':     {30:13000, 60:22000, 90:30000, 120:40000, 180:55000},
  'Temen Curhat':  {30:15000, 60:25000, 90:35000, 120:50000},
  'Pacar Virtual': {30:20000, 60:30000, 90:40000, 120:50000},
};

const DUR_LABEL = {30:'30 menit', 60:'60 menit', 90:'90 menit', 120:'2 jam', 180:'3 jam'};

// Auth guard — panggil di tiap halaman admin
function requireAuth() {
  if (!DB.isLoggedIn()) window.location.href = 'index.html';
}