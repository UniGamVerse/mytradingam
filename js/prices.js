// ============================================================
//  PRICES — feed Google Sheet, alert prezzi, loop aggiornamento
// ============================================================
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwDQyLtQFtzbFEfP7kEqjQBdyPYjawudhp-gHy4RJQyDAOVf6CTTtd40jW11WDwsoBiwg/exec';

var gsheetCache      = {};
var gsheetLastUpdate = null;
var fetchTimer       = null;
var fetching         = false;

// ---------- Nome ticker dal foglio ----------
function tickerName(ticker) {
  var c = gsheetCache[ticker.toUpperCase()];
  return (c && c.name) ? c.name : '';
}
function tkCell(ticker) {
  var nm = tickerName(ticker);
  return '<td><span class="tkb">' + ticker + '</span>' + (nm ? '<br><span style="font-size:10px;color:var(--dim);font-weight:400">' + nm + '</span>' : '') + '</td>';
}
function tkCellSm(ticker) {
  var nm = tickerName(ticker);
  return '<td class="tk">' + ticker + (nm ? '<br><span style="font-size:10px;color:var(--dim);font-weight:400">' + nm + '</span>' : '') + '</td>';
}

// ---------- Carica tutta la cache JSONP ----------
function loadGSheetPrices() {
  return new Promise(function(resolve, reject) {
    var cbName = 'gsCb_' + Date.now();
    var script = document.createElement('script');
    var timeout = setTimeout(function() { cleanup(); reject(new Error('timeout')); }, 12000);
    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cbName] = function(data) {
      cleanup();
      var newCache = {};
      for (var i = 0; i < data.length; i++) {
        var d = data[i];
        if (d.ticker && d.price > 0) {
          newCache[d.ticker.toUpperCase()] = {
            price: d.price, prevClose: d.prevClose || d.price,
            currency: d.currency || 'EUR', name: d.name || '', ts: Date.now()
          };
        }
      }
      gsheetCache      = newCache;
      gsheetLastUpdate = new Date();
      var lupd = document.getElementById('lupd');
      if (lupd) {
        var timeStr = gsheetLastUpdate.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        var dateStr = gsheetLastUpdate.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
        lupd.textContent = 'agg. ' + timeStr + ' · ' + dateStr;
        lupd.title = 'Fonte: Google Sheet · ' + Object.keys(newCache).length + ' ticker: ' + Object.keys(newCache).join(', ');
        lupd.style.color = 'var(--dim)';
      }
      resolve(newCache);
    };
    script.onerror = function() { cleanup(); reject(new Error('script error')); };
    script.src = APPS_SCRIPT_URL + '?callback=' + cbName + '&t=' + Date.now();
    document.head.appendChild(script);
  });
}

// ---------- Prezzo singolo ticker ----------
function fetchPrice(ticker) {
  var sym = ticker.trim().toUpperCase();
  if (gsheetCache[sym] && (Date.now() - gsheetCache[sym].ts) < 90000) {
    var c = gsheetCache[sym];
    var chg = c.price - c.prevClose;
    var chgp = c.prevClose ? (chg / c.prevClose) * 100 : 0;
    return Promise.resolve({ price: c.price, prevClose: c.prevClose, change: chg, changePct: chgp, currency: c.currency, sym: sym, ts: c.ts });
  }
  return loadGSheetPrices().then(function() {
    var c = gsheetCache[sym];
    if (!c) throw new Error('Ticker ' + sym + ' non trovato nel foglio');
    var chg = c.price - c.prevClose;
    var chgp = c.prevClose ? (chg / c.prevClose) * 100 : 0;
    return { price: c.price, prevClose: c.prevClose, change: chg, changePct: chgp, currency: c.currency, sym: sym, ts: c.ts };
  });
}

// ---------- Controllo alert ----------
function checkAlerts(ticker, price) {
  var al = alerts[ticker]; if (!al) return;
  var now = new Date();
  var timeStr = now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  if (al.target && price >= al.target) {
    var already = alertLog.find(function(x){ return x.ticker === ticker && x.type === 'TARGET' && (Date.now() - new Date(x.rawTime).getTime()) < 300000; });
    if (!already) {
      alertLog.unshift({ time: timeStr, rawTime: now.toISOString(), ticker: ticker, type: 'TARGET', threshold: al.target, price: price });
      if (alertLog.length > 50) alertLog.pop();
      showToast('🎯 ' + ticker + ' ha raggiunto il target ' + fe(al.target), 'tg');
      save();
    }
  }
  if (al.stop && price <= al.stop) {
    var already2 = alertLog.find(function(x){ return x.ticker === ticker && x.type === 'STOP' && (Date.now() - new Date(x.rawTime).getTime()) < 300000; });
    if (!already2) {
      alertLog.unshift({ time: timeStr, rawTime: now.toISOString(), ticker: ticker, type: 'STOP', threshold: al.stop, price: price });
      if (alertLog.length > 50) alertLog.pop();
      showToast('🛑 ' + ticker + ' ha rotto lo stop ' + fe(al.stop), 'tr');
      save();
    }
  }
}

// ---------- Fetch tutti i ticker ----------
function fetchAll(force) {
  if (fetching) return;
  var safetyTimer = setTimeout(function() {
    if (fetching) { fetching = false; setBadge('err', '✕ timeout'); setDot('err'); }
  }, 15000);

  if (!navigator.onLine) {
    clearTimeout(safetyTimer);
    setBadge('err', '✕ offline'); setDot('err');
    var lupd = document.getElementById('lupd');
    if (lupd) { lupd.textContent = 'Nessuna connessione'; lupd.style.color = 'var(--r)'; }
    return;
  }

  var portfolio = getPortfolio();
  if (portfolio.length === 0) {
    clearTimeout(safetyTimer);
    setBadge('ok', '● nessun titolo'); setDot('ok');
    return;
  }

  fetching = true;
  setBadge('loading', '⟳ aggiornamento...'); setDot('loading');

  loadGSheetPrices().then(function() {
    var pending = portfolio.slice(), ok = 0, err = 0;

    function next() {
      if (pending.length === 0) {
        clearTimeout(safetyTimer);
        fetching = false;
        save();
        renderAll();
        var now = new Date();
        var dateStr = now.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
        var timeStr = now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        var lupd = document.getElementById('lupd');
        if (err === 0) {
          setBadge('ok', '● live'); setDot('ok');
          if (lupd) { lupd.textContent = 'agg. ' + timeStr + ' · ' + dateStr; lupd.style.color = 'var(--dim)'; }
        } else if (ok > 0) {
          setBadge('ok', '⚠ parziale'); setDot('ok');
          if (lupd) { lupd.textContent = 'parz. ' + timeStr + ' · ' + dateStr; lupd.style.color = 'var(--au)'; }
        } else {
          setBadge('err', '✕ no feed'); setDot('err');
          if (lupd) { lupd.textContent = 'errore · ' + timeStr; lupd.style.color = 'var(--r)'; }
        }
        return;
      }

      var pos = pending.shift();
      var cached = prices[pos.ticker];
      var stale = force ? true : (!cached || (Date.now() - cached.ts) > 55000);

      if (!stale) { ok++; next(); return; }

      fetchPrice(pos.ticker).then(function(data) {
        var prev = prices[pos.ticker];
        prices[pos.ticker]    = data;
        curPrices[pos.ticker] = data.price;
        checkAlerts(pos.ticker, data.price);
        if (prev && Math.abs(prev.price - data.price) > 0.0001) {
          var row = document.getElementById('row-' + pos.ticker);
          if (row) { row.classList.remove('fu','fd'); void row.offsetWidth; row.classList.add(data.price > prev.price ? 'fu' : 'fd'); }
        }
        ok++; next();
      }).catch(function(errTicker) {
        console.error('Errore ticker:', pos.ticker, errTicker);
        err++; next();
      });
    }
    next();

  }).catch(function(errFeed) {
    clearTimeout(safetyTimer);
    fetching = false;
    console.error('Errore feed Google Sheet:', errFeed);
    setBadge('err', '✕ no feed'); setDot('err');
    var lupd = document.getElementById('lupd');
    if (lupd) { lupd.textContent = errFeed.message || 'feed non disponibile'; lupd.style.color = 'var(--r)'; }
  });
}

function startLoop() {
  clearInterval(fetchTimer);
  fetchAll(true);
  fetchTimer = setInterval(function() { fetchAll(false); }, 60000);
}

function setBadge(state, txt) {
  var b = document.getElementById('pbadge'); if (!b) return;
  b.textContent = txt;
  b.className = 'badge' + (state === 'loading' ? ' loading' : state === 'err' ? ' err' : '');
}
function setDot(state) {
  var ldot = document.getElementById('ldot'); if (!ldot) return;
  ldot.className = state === 'loading' ? 'dot loading' : state === 'err' ? 'dot err' : 'dot';
}

window.addEventListener('online',  function() { fetchAll(true); });
window.addEventListener('offline', function() {
  setBadge('err', '✕ offline'); setDot('err');
  var lupd = document.getElementById('lupd');
  if (lupd) { lupd.textContent = 'Nessuna connessione'; lupd.style.color = 'var(--r)'; }
});
