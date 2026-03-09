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
var saveTimer = null;

var isSigningIn = false;

function signInWithGoogle() {
  if (isSigningIn) return;
  isSigningIn = true;
  var provider = new firebase.auth.GoogleAuthProvider();
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
    if (doc.exists) {
      var d = doc.data();
      ops              = d.ops              || [];
      curPrices        = d.curPrices        || {};
      alerts           = d.alerts           || {};
      alertLog         = d.alertLog         || [];
      fondi            = d.fondi            || [];
      fnMovs           = d.fnMovs           || [];
      fnNavs           = d.fnNavs           || {};
      portfolioTitle   = d.title            || '';
      patrimonyHistory = d.patrimonyHistory || [];
      applyTitle();
      if (!portfolioTitle) {
        document.getElementById('modal-setup').classList.add('open');
      }
    } else {
      document.getElementById('modal-setup').classList.add('open');
    }
    renderAll();
    startLoop();
    saveSnapshot();
  }).catch(function(e) {
    console.error('Errore caricamento:', e);
    renderAll();
    startLoop();
  });
}

// ---------- Snapshot giornaliero patrimonio ----------
function saveSnapshot() {
  var today = new Date().toISOString().slice(0, 10);
  var g     = grandTotals();
  var val   = g.totMkt;
  if (val <= 0) return; // non salvare se portafoglio vuoto
  // Rimuovi eventuale snapshot di oggi già presente e aggiorna
  patrimonyHistory = patrimonyHistory.filter(function(s) { return s.date !== today; });
  patrimonyHistory.push({ date: today, val: Math.round(val * 100) / 100 });
  // Tieni max 730 giorni (2 anni)
  patrimonyHistory.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  if (patrimonyHistory.length > 730) patrimonyHistory = patrimonyHistory.slice(-730);
  saveToFirebase();
}

function save() {
  try {
    localStorage.setItem('pd3_ops',   JSON.stringify(ops));
    localStorage.setItem('pd3_cp',    JSON.stringify(curPrices));
    localStorage.setItem('pd3_al',    JSON.stringify(alerts));
    localStorage.setItem('pd3_allog', JSON.stringify(alertLog));
  } catch(e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToFirebase, 800);
}

function saveFondi() {
  try {
    localStorage.setItem('pd3_fondi',  JSON.stringify(fondi));
    localStorage.setItem('pd3_fnmovs', JSON.stringify(fnMovs));
    localStorage.setItem('pd3_fnnav',  JSON.stringify(fnNavs));
  } catch(e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToFirebase, 800);
}

// Rimuove campi undefined o con prefisso _ (calcolati dall'engine) prima del salvataggio
function cleanForFirestore(arr) {
  return arr.map(function(obj) {
    var clean = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = obj[keys[i]];
      if (keys[i][0] === '_') continue;          // salta campi calcolati _pl, _pmc, ecc.
      if (k === undefined) continue;             // salta undefined
      clean[keys[i]] = (k === null ? '' : k);   // null → stringa vuota
    }
    return clean;
  });
}

function saveToFirebase() {
  if (!currentUser) return;
  var snap = {
    ops: cleanForFirestore(ops),
    curPrices: curPrices,
    alerts: alerts,
    alertLog: alertLog,
    fondi: cleanForFirestore(fondi),
    fnMovs: cleanForFirestore(fnMovs),
    fnNavs: fnNavs,
    title: portfolioTitle || '',
    patrimonyHistory: patrimonyHistory,
    updatedAt: new Date().toISOString()
  };
  db.collection('portfolios').doc(currentUser.uid).set(snap).catch(function(e) {
    console.error('Errore salvataggio Firebase:', e);
  });
}

// Salva immediatamente se la pagina viene chiusa o nascosta
window.addEventListener('beforeunload', function() {
  if (saveTimer) { clearTimeout(saveTimer); saveToFirebase(); }
});
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden' && saveTimer) {
    clearTimeout(saveTimer);
    saveToFirebase();
  }
});
