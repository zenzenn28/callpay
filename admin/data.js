// ============================================================
//  CALLPAY — DATA LAYER (Firebase Firestore)
//  Data tersimpan di cloud — sync realtime antar semua device
// ============================================================

// ── FIREBASE CONFIG ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey            : "AIzaSyBLPe_yx28LyefI856Ysxz3YEPnwA0ENFU",
  authDomain        : "callpay-28a28.firebaseapp.com",
  projectId         : "callpay-28a28",
  storageBucket     : "callpay-28a28.firebasestorage.app",
  messagingSenderId : "44722427776",
  appId             : "1:44722427776:web:29d1a297746cd83d685365",
  measurementId     : "G-9NMYP6KN0N"
};

// ── FIREBASE INIT ─────────────────────────────────────────────
import { initializeApp }                          from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, doc,
         addDoc, getDocs, getDoc, setDoc,
         updateDoc, deleteDoc, query,
         orderBy, onSnapshot, Timestamp,
         serverTimestamp }                        from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const _app = initializeApp(FIREBASE_CONFIG);
const _db  = getFirestore(_app);

// ── COLLECTIONS ───────────────────────────────────────────────
const COL_ORDERS   = "orders";
const COL_SETTINGS = "settings";
const SETTINGS_DOC = "config";

// ── SESSION (tetap pakai sessionStorage) ─────────────────────
const SESSION_KEY = 'cp_admin';

// ============================================================
//  DB OBJECT — sama persis API-nya dengan versi localStorage
//  sehingga semua halaman admin tidak perlu diubah banyak
// ============================================================
const DB = {

  // ── SESSION ───────────────────────────────────────────────
  isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === '1'; },
  setLogin(v)  { v ? sessionStorage.setItem(SESSION_KEY,'1') : sessionStorage.removeItem(SESSION_KEY); },

  // ── DEFAULT SETTINGS ──────────────────────────────────────
  defaultSettings() {
    return {
      username    : 'admin',
      password    : 'callpay2021',
      waNumber    : '62895400709371',
      agencyName  : 'CallPay Agency',
      instagram   : '@callpay.id',
      agencyCut   : 40,
    };
  },

  // ── SETTINGS (Firestore + local cache) ────────────────────
  _settingsCache: null,

  async getSettingsAsync() {
    try {
      const ref  = doc(_db, COL_SETTINGS, SETTINGS_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        this._settingsCache = { ...this.defaultSettings(), ...snap.data() };
      } else {
        // First time — save defaults to Firestore
        await setDoc(ref, this.defaultSettings());
        this._settingsCache = this.defaultSettings();
      }
    } catch(e) {
      this._settingsCache = this.defaultSettings();
    }
    return this._settingsCache;
  },

  // Sync version — returns cache (call getSettingsAsync first)
  getSettings() {
    return this._settingsCache || this.defaultSettings();
  },

  async saveSettings(obj) {
    this._settingsCache = obj;
    try {
      const ref = doc(_db, COL_SETTINGS, SETTINGS_DOC);
      await setDoc(ref, obj);
    } catch(e) { console.error('saveSettings error:', e); }
  },

  // ── ORDERS ────────────────────────────────────────────────

  async addOrder(order) {
    // Quick orders go to waiting_bid, talent orders go to baru
    const initStatus = (order.orderType === 'quick' && !order.talentId) ? 'waiting_bid' : 'baru';
    const newOrder = {
      ...order,
      id        : 'ORD-' + Date.now(),
      date      : new Date().toISOString(),
      status    : initStatus,
      bids      : [],
      createdAt : serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(_db, COL_ORDERS), newOrder);
      newOrder._docId = ref.id;
    } catch(e) { console.error('addOrder error:', e); }
    return newOrder;
  },

  async getOrders() {
    try {
      const q    = query(collection(_db, COL_ORDERS), orderBy('createdAt','desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    } catch(e) {
      console.error('getOrders error:', e);
      return [];
    }
  },

  async deleteOrder(id) {
    try {
      const orders = await this.getOrders();
      const o = orders.find(x => x.id === id);
      if (o?._docId) await deleteDoc(doc(_db, COL_ORDERS, o._docId));
    } catch(e) { console.error('deleteOrder error:', e); }
  },

  async deleteAllOrders() {
    try {
      const snap = await getDocs(collection(_db, COL_ORDERS));
      const dels = snap.docs.map(d => deleteDoc(doc(_db, COL_ORDERS, d.id)));
      await Promise.all(dels);
    } catch(e) { console.error('deleteAllOrders error:', e); }
  },

  async updateOrderStatus(id, status) {
    try {
      const orders = await this.getOrders();
      const o = orders.find(x => x.id === id);
      if (o?._docId) await updateDoc(doc(_db, COL_ORDERS, o._docId), { status });
    } catch(e) { console.error('updateOrderStatus error:', e); }
  },

  async assignTalent(orderId, talentId, talentName) {
    try {
      const orders = await this.getOrders();
      const o = orders.find(x => x.id === orderId);
      if (o?._docId) {
        await updateDoc(doc(_db, COL_ORDERS, o._docId), {
          talentId, talentName,
          assignedAt: new Date().toISOString()
        });
      }
    } catch(e) { console.error('assignTalent error:', e); }
  },

  // ── REALTIME LISTENER ─────────────────────────────────────
  // Gunakan ini untuk auto-refresh halaman admin
  onOrdersChange(callback) {
    const q = query(collection(_db, COL_ORDERS), orderBy('createdAt','desc'));
    return onSnapshot(q, (snap) => {
      const orders = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      callback(orders);
    });
  },

  // ── AUTO STATUS ───────────────────────────────────────────
  computeStatus(order) {
    if (order.status === 'batal') return 'batal';
    if (!order.talentId && !order.talentName) return order.status;
    const now        = Date.now();
    const created    = new Date(order.date).getTime();
    const elapsedMin = (now - created) / 60000;
    const durMin     = Number(order.duration) || 60;
    if (elapsedMin < 5)          return 'baru';
    if (elapsedMin < 5 + durMin) return 'proses';
    return 'selesai';
  },

  async syncStatuses() {
    const orders = await this.getOrders();
    const updates = [];
    orders.forEach(o => {
      if (o.status === 'batal') return;
      if (!o.talentId && !o.talentName) return;
      const computed = this.computeStatus(o);
      if (o.status !== computed && o._docId) {
        updates.push(updateDoc(doc(_db, COL_ORDERS, o._docId), { status: computed }));
        o.status = computed;
      }
    });
    if (updates.length) await Promise.all(updates);
    return orders;
  },

  // ── HELPERS ───────────────────────────────────────────────
  formatRp(num) {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  },
  formatDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  },
  timeRemaining(order) {
    if (order.status === 'batal') return '—';
    if (!order.talentId && !order.talentName) return 'Belum di-assign';
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

function requireAuth() {
  if (!DB.isLoggedIn()) window.location.href = 'index.html';
}

export { DB, TALENTS, PRICES, DUR_LABEL, requireAuth };