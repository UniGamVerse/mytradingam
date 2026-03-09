// ============================================================
//  FIREBASE — configurazione, autenticazione, salvataggio
// ============================================================
var firebaseConfig = {
  apiKey: "AIzaSyC6xl0_B8zV-prM_4b-ukbRYifwHccPpi4",
  authDomain: "mytradingam.firebaseapp.com",
  projectId: "mytradingam",
  storageBucket: "mytradingam.firebasestorage.app",
  messagingSenderId: "299276825677",
  appId: "1:299276825677:web:dfb4f7990bd5a1017a5804"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var auth = firebase.auth();
var currentUser = null;
var saveTimer  = null;
var saveFondiTimer = null;   // timer separato per fondi

var isSigningIn = false;

function signInWithGoogle() {
  if (isSigningIn) return;
  isSigningIn = true;
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  auth.signInWithPopup(provider).catch(function(e) {
    if (e.code !== 'auth/cancelled-popup-request' && e.code !== 'auth/popup-closed-by-user') {
      var el = document.getElementById('login-err');
      el.textContent = 'Errore: ' + e.message;
      el.style.display = 'block';
    }
  }).finally(function() {
    isSigningIn = false;
  });
}

function signOut() {
  if (!confirm('Uscire?')) return;
  auth.signOut();
}

auth.onAuthStateChanged(function(user) {
  if (user) {
    currentUser = user;
    document.getElementById('modal-login').style.display = 'none';
    var ui = document.getElementById('user-info');
    ui.style.display = 'flex';
    document.getElementById('user-name').textContent = user.displayName || user.email;
    loadFromFirebase();
  } else {
    currentUser = null;
    document.getElementById('modal-login').style.display = 'flex';
    document.getElementById('user-info').style.display = 'none';
  }
});

function loadFromFirebase() {
  if (!currentUser) return;
  db.collection('portfolios').doc(currentUser.uid).get().then(function(doc) {
    var dirty = false;
    try { dirty = localStorage.getItem('pd3_dirty') === '1'; } catch(e) {}

    if (doc.exists) {
      var d = doc.data();

      // Se c'è il flag dirty, confronta timestamp Firebase con localStorage
      // e usa i dati più recenti
      if (dirty) {
        var fbTime = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
        var lsTime = 0;
        try {
          var lsUpdated = localStorage.getItem('pd3_updated');
          if (lsUpdated) lsTime = new Date(lsUpdated).getTime();
        } catch(e) {}

        if (lsTime > fbTime) {
          console.warn('[Firebase] localStorage più recente di Firebase - ripristino da localStorage');
          restoreFromLocalStorage();
          // Risalva subito su Firebase con i dati locali
          saveToFirebase();
          try { localStorage.removeItem('pd3_dirty'); } catch(e) {}
          renderAll(); startLoop(); saveSnapshot();
          return;
        }
      }

      ops              = d.ops              || [];
      curPrices        = d.curPrices        || {};
      alerts           = d.alerts           || {};
      alertLog         = d.alertLog         || [];
      fondi            = d.fondi            || [];
      fnMovs           = d.fnMovs           || [];
      fnNavs           = d.fnNavs           || {};
      portfolioTitle   = d.title            || '';
      patrimonyHistory = d.patrimonyHistory || [];
      try { localStorage.removeItem('pd3_dirty'); } catch(e) {}
    } else {
      // Nessun documento Firebase: prova localStorage come fallback
      if (dirty) {
        console.warn('[Firebase] Nessun documento Firebase, ripristino da localStorage');
        restoreFromLocalStorage();
        saveToFirebase();
        try { localStorage.removeItem('pd3_dirty'); } catch(e) {}
      }
      if (!portfolioTitle) {
        document.getElementById('modal-setup').classList.add('open');
      }
    }
    applyTitle();
    if (!portfolioTitle) {
      document.getElementById('modal-setup').classList.add('open');
    }
    renderAll();
    startLoop();
    saveSnapshot();
  }).catch(function(e) {
    console.error('Errore caricamento Firebase:', e);
    // Fallback totale su localStorage
    restoreFromLocalStorage();
    renderAll();
    startLoop();
  });
}

function restoreFromLocalStorage() {
  try {
    var _ops   = localStorage.getItem('pd3_ops');   if (_ops)   ops      = JSON.parse(_ops);
    var _cp    = localStorage.getItem('pd3_cp');    if (_cp)    curPrices= JSON.parse(_cp);
    var _al    = localStorage.getItem('pd3_al');    if (_al)    alerts   = JSON.parse(_al);
    var _all   = localStorage.getItem('pd3_allog'); if (_all)   alertLog = JSON.parse(_all);
    var _fn    = localStorage.getItem('pd3_fondi'); if (_fn)    fondi    = JSON.parse(_fn);
    var _fnm   = localStorage.getItem('pd3_fnmovs');if (_fnm)   fnMovs   = JSON.parse(_fnm);
    var _fnn   = localStorage.getItem('pd3_fnnav'); if (_fnn)   fnNavs   = JSON.parse(_fnn);
    var _title = localStorage.getItem('pd3_title'); if (_title) portfolioTitle = _title;
    applyTitle();
    console.log('[localStorage] Ripristino: ops=' + ops.length + ' fnMovs=' + fnMovs.length);
  } catch(e) {
    console.error('[localStorage] Errore ripristino:', e);
  }
}

var saveSnapshotTimer = null;

// ---------- Snapshot giornaliero patrimonio ----------
function saveSnapshot() {
  var today = new Date().toISOString().slice(0, 10);
  var g     = grandTotals();
  var val   = g.totMkt;
  if (val <= 0) return; // non salvare se portafoglio vuoto
  patrimonyHistory = patrimonyHistory.filter(function(s) { return s.date !== today; });
  patrimonyHistory.push({ date: today, val: Math.round(val * 100) / 100 });
  patrimonyHistory.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  if (patrimonyHistory.length > 730) patrimonyHistory = patrimonyHistory.slice(-730);
  // Usa un timer separato per non annullare saveTimer/saveFondiTimer in volo
  clearTimeout(saveSnapshotTimer);
  saveSnapshotTimer = setTimeout(saveToFirebase, 1200);
}

// ---------- Indicatore stato salvataggio ----------
var saveStatusTimer = null;
function setSaveStatus(state) {
  var el = document.getElementById('save-status');
  if (!el) return;
  clearTimeout(saveStatusTimer);
  if (state === 'saving') {
    el.textContent = '⏳ salvataggio...';
    el.style.color = 'var(--au)';
  } else if (state === 'ok') {
    el.textContent = '✓ salvato';
    el.style.color = 'var(--g)';
    saveStatusTimer = setTimeout(function() { el.textContent = ''; }, 2000);
  } else if (state === 'err') {
    el.textContent = '✕ errore salvataggio';
    el.style.color = 'var(--r)';
  }
}

function save() {
  setSaveStatus('saving');
  try {
    localStorage.setItem('pd3_ops',     JSON.stringify(ops));
    localStorage.setItem('pd3_cp',      JSON.stringify(curPrices));
    localStorage.setItem('pd3_al',      JSON.stringify(alerts));
    localStorage.setItem('pd3_allog',   JSON.stringify(alertLog));
    localStorage.setItem('pd3_updated', new Date().toISOString());
  } catch(e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToFirebase, 800);
}

function saveFondi() {
  setSaveStatus('saving');
  try {
    localStorage.setItem('pd3_fondi',   JSON.stringify(fondi));
    localStorage.setItem('pd3_fnmovs',  JSON.stringify(fnMovs));
    localStorage.setItem('pd3_fnnav',   JSON.stringify(fnNavs));
    localStorage.setItem('pd3_updated', new Date().toISOString());
  } catch(e) {}
  clearTimeout(saveFondiTimer);
  saveFondiTimer = setTimeout(saveToFirebase, 800);
}

// Rimuove campi undefined o con prefisso _ (calcolati dall'engine) prima del salvataggio
function cleanForFirestore(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var clean = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = obj[key];
      if (key[0] === '_') continue;          // salta campi calcolati _pl, _pmc, ecc.
      if (val === undefined) continue;       // salta undefined (Firestore crasha)
      if (val === null) { clean[key] = ''; continue; }
      clean[key] = val;
    }
    return clean;
  });
}

// Pulisce un oggetto flat (non array) da undefined e campi _
function cleanObjForFirestore(obj) {
  if (!obj || typeof obj !== 'object') return {};
  var clean = {};
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = obj[key];
    if (key[0] === '_') continue;
    if (val === undefined) continue;
    clean[key] = (val === null ? '' : val);
  }
  return clean;
}

function saveToFirebase() {
  if (!currentUser) return;
  // Annulla tutti i timer pendenti
  clearTimeout(saveTimer);
  clearTimeout(saveFondiTimer);
  clearTimeout(saveSnapshotTimer);
  saveTimer = null;
  saveFondiTimer = null;
  saveSnapshotTimer = null;

  var snap = {
    ops:              cleanForFirestore(ops),
    curPrices:        cleanObjForFirestore(curPrices),
    alerts:           cleanObjForFirestore(alerts),
    alertLog:         cleanForFirestore(alertLog),
    fondi:            cleanForFirestore(fondi),
    fnMovs:           cleanForFirestore(fnMovs),
    fnNavs:           cleanObjForFirestore(fnNavs),
    title:            portfolioTitle || '',
    patrimonyHistory: Array.isArray(patrimonyHistory) ? patrimonyHistory : [],
    updatedAt:        new Date().toISOString()
  };
  db.collection('portfolios').doc(currentUser.uid).set(snap)
    .then(function() {
      setSaveStatus('ok');
      console.log('[Firebase] Salvato alle', new Date().toLocaleTimeString('it-IT'));
    })
    .catch(function(e) {
      setSaveStatus('err');
      console.error('[Firebase] Errore salvataggio:', e);
    });
}

// ---------- Salvataggio su chiusura / cambio tab ----------
// NOTA: db.collection(...).set() è asincrono - il browser NON aspetta le Promise in beforeunload.
// Strategia: salviamo SEMPRE su localStorage (sincrono, garantito), poi tentiamo Firebase.
// Al successivo caricamento, se Firebase è vuoto/vecchio, ripristiniamo da localStorage.

function flushToLocalStorage() {
  try {
    localStorage.setItem('pd3_ops',    JSON.stringify(ops));
    localStorage.setItem('pd3_cp',     JSON.stringify(curPrices));
    localStorage.setItem('pd3_al',     JSON.stringify(alerts));
    localStorage.setItem('pd3_allog',  JSON.stringify(alertLog));
    localStorage.setItem('pd3_fondi',  JSON.stringify(fondi));
    localStorage.setItem('pd3_fnmovs', JSON.stringify(fnMovs));
    localStorage.setItem('pd3_fnnav',  JSON.stringify(fnNavs));
    localStorage.setItem('pd3_title',  portfolioTitle || '');
    localStorage.setItem('pd3_updated', new Date().toISOString());
    localStorage.setItem('pd3_dirty',  '1');  // flag: "Firebase non è aggiornato"
  } catch(e) {}
}

window.addEventListener('beforeunload', function() {
  // 1. Scrivi su localStorage (sincrono, garantito)
  flushToLocalStorage();
  // 2. Tenta sempre Firebase - annulla eventuali timer pendenti e salva subito
  clearTimeout(saveTimer);
  clearTimeout(saveFondiTimer);
  saveTimer = null;
  saveFondiTimer = null;
  saveToFirebase();
});

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') {
    // Tab nascosta: flush localStorage immediato + Firebase (ha più tempo qui)
    flushToLocalStorage();
    clearTimeout(saveTimer);
    clearTimeout(saveFondiTimer);
    saveTimer = null;
    saveFondiTimer = null;
    saveToFirebase();
  }
});
