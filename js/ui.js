// ============================================================
//  UI — tabs, toast, theme, operazioni, simulatore, import/export
// ============================================================

// ---------- Toast ----------
var toastTimer  = null;
var driveFileId = null;
try { driveFileId = localStorage.getItem('pd3_drive_fid') || null; } catch(e) {}
function showToast(msg, cls) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (cls || 'ta') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 4000);
}

// ---------- Theme ----------
function applyTheme() {
  var theme = isDark ? 'dark' : (isWarm ? 'warm' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  var btn = document.getElementById('theme-btn');
  if (theme === 'dark')  btn.textContent = '🟠 Warm';
  if (theme === 'warm')  btn.textContent = '☀ Light';
  if (theme === 'light') btn.textContent = '🌙 Dark';
  var t = totals(); drawDonut(t.pf, t.mkt);
  if (typeof renderHistChart === 'function') renderHistChart();
}
function toggleTheme() {
  if (isDark)       { isDark = false; isWarm = true; }
  else if (isWarm)  { isWarm = false; }
  else              { isDark = true; }
  try { localStorage.setItem('pd3_theme', isDark ? 'dark' : isWarm ? 'warm' : 'light'); } catch(e) {}
  applyTheme();
}

// ---------- Titolo portafoglio ----------
function applyTitle() {
  var t = portfolioTitle || 'Portfolio';
  document.getElementById('logo-title').textContent = t;
  document.title = t;
}
function editTitle() {
  var cur = portfolioTitle || 'PortfolioDesk';
  var n   = prompt('Nome portafoglio:', cur);
  if (n !== null && n.trim()) {
    portfolioTitle = n.trim();
    try { localStorage.setItem('pd3_title', portfolioTitle); } catch(e) {}
    applyTitle();
    saveToFirebase();
  }
}
function saveSetup() {
  var n = document.getElementById('setup-name').value.trim();
  if (!n) { alert('Inserisci un nome.'); return; }
  portfolioTitle = n;
  try { localStorage.setItem('pd3_title', portfolioTitle); } catch(e) {}
  applyTitle();
  document.getElementById('modal-setup').classList.remove('open');
  saveToFirebase();
}

// ---------- Tabs ----------
var TABS = ['tt','ov','pf','op','lg','sm','zn','al','fn'];
function goTab(name) {
  var btns   = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.panel');
  // Deactivate all
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove('active');
  // Activate by tab index (button order = TABS array)
  var idx = TABS.indexOf(name);
  if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');
  // Activate panel by id
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  if (name === 'sm') updateSmTickers();
  if (name === 'fn') renderFnPanel();
  if (name === 'tt') renderTtPanel();
}

// ---------- Form validazione ----------
function clearFieldErrors() {
  var inputs = document.querySelectorAll('.field-err');
  for (var i = 0; i < inputs.length; i++) inputs[i].classList.remove('field-err');
  var lbls = document.querySelectorAll('.field-err-lbl');
  for (var i = 0; i < lbls.length; i++) lbls[i].classList.remove('field-err-lbl');
}
function markField(id) {
  var el = document.getElementById(id); if (!el) return;
  el.classList.add('field-err');
  var lbl = el.closest('.fg') && el.closest('.fg').querySelector('label');
  if (lbl) lbl.classList.add('field-err-lbl');
  el.addEventListener('input', function(){ el.classList.remove('field-err'); if (lbl) lbl.classList.remove('field-err-lbl'); }, { once: true });
}

// ---------- Form split/raggruppamento ----------
function onTypeChange() {
  var type     = document.getElementById('f-type').value;
  var splitRow = document.getElementById('f-split-row');
  var priceRow = document.getElementById('f-price').parentElement;
  var commRow  = document.getElementById('f-comm').parentElement;
  var qtyRow   = document.getElementById('f-qty').parentElement;
  if (type === 'split') {
    splitRow.style.display = '';
    if (priceRow) priceRow.style.display = 'none';
    if (commRow)  commRow.style.display  = 'none';
    if (qtyRow)   qtyRow.style.display   = 'none'; // nasconde anche Quantità per split
  } else {
    splitRow.style.display = 'none';
    if (priceRow) priceRow.style.display = '';
    if (commRow)  commRow.style.display  = '';
    if (qtyRow)   qtyRow.style.display   = '';
  }
}

// ---------- Registra operazione (BUG FIX: split bypassa validazione qty/price) ----------
function addOp() {
  clearFieldErrors();
  document.getElementById('form-err-msg').style.display = 'none';
  var type   = document.getElementById('f-type').value;
  var ticker = document.getElementById('f-ticker').value.trim().toUpperCase();
  var date   = document.getElementById('f-date').value;
  var ok     = true;

  if (!ticker) { markField('f-ticker'); ok = false; }
  if (!date)   { markField('f-date');   ok = false; }

  // ── SPLIT / RAGGRUPPAMENTO ──────────────────────────────────
  // Gestito prima della validazione qty/price (che non si applicano allo split)
  if (type === 'split') {
    if (!ok) {
      var msg = document.getElementById('form-err-msg');
      msg.style.display = 'block';
      setTimeout(function(){ msg.style.display = 'none'; }, 5000);
      return;
    }
    var ratio = parseFloat(document.getElementById('f-ratio').value);
    if (isNaN(ratio) || ratio <= 0) { markField('f-ratio'); return; }
    // Prima controlla duplicati, poi registra
    var count = applySplit(ticker, ratio, date);
    if (count === -1) {
      showToast('⚠ Split già applicato per ' + ticker + ' in questa data');
      return;
    }
    ops.push({ id: Date.now(), type: 'split', ticker: ticker, date: date, qty: ratio, price: 0, comm: 0 });
    save();
    document.getElementById('f-ratio').value = '';
    document.getElementById('f-type').value  = 'buy';
    onTypeChange();
    // Messaggio differenziato: split (ratio>1) vs raggruppamento (ratio<1)
    var opLabel = ratio >= 1 ? 'Split' : 'Raggruppamento';
    showToast(opLabel + ' ' + ticker + ' (×' + ratio + ') applicato a ' + count + ' operazioni ✓');
    renderAll(); fetchAll(false);
    return;
  }

  // ── ACQUISTO / VENDITA ──────────────────────────────────────
  var qty   = parseFloat(document.getElementById('f-qty').value);
  var price = parseFloat(document.getElementById('f-price').value);
  var comm  = parseFloat(document.getElementById('f-comm').value) || 0;
  if (isNaN(qty)   || qty   <= 0) { markField('f-qty');   ok = false; }
  if (isNaN(price) || price <= 0) { markField('f-price'); ok = false; }
  if (!ok) {
    var msg = document.getElementById('form-err-msg');
    msg.style.display = 'block';
    setTimeout(function(){ msg.style.display = 'none'; }, 5000);
    return;
  }

  if (type === 'sell') {
    var pf = getPortfolio(), pos = null;
    for (var i = 0; i < pf.length; i++) { if (pf[i].ticker === ticker) { pos = pf[i]; break; } }
    if ((pos ? pos.qty : 0) < qty - 0.00001) {
      var w = document.getElementById('sell-warn'); w.style.display = 'block';
      setTimeout(function(){ w.style.display = 'none'; }, 4000); return;
    }
  }

  ops.push({ id: Date.now(), type: type, ticker: ticker, date: date, qty: qty, price: price, comm: comm });
  save();
  document.getElementById('f-qty').value   = '';
  document.getElementById('f-price').value = '';
  document.getElementById('f-comm').value  = '0';
  if (Object.keys(gsheetCache).length > 0 && !gsheetCache[ticker]) {
    showToast('⚠ ' + ticker + ' non è nel foglio prezzi — il prezzo non si aggiornerà in tempo reale.', 'ta');
  }
  renderAll(); fetchAll(false);
}

function delOp(id)  { ops = ops.filter(function(o){ return o.id !== id; }); save(); renderAll(); }

function editOp(id) {
  var op = ops.find(function(o){ return o.id === id; });
  if (!op) return;
  var m = document.getElementById('modal-edit-op');
  m._editId = id;
  document.getElementById('eop-type').value   = op.type;
  document.getElementById('eop-ticker').value = op.ticker;
  document.getElementById('eop-date-edit').value   = op.date;
  document.getElementById('eop-qty').value    = op.qty;
  document.getElementById('eop-price').value  = op.price;
  document.getElementById('eop-comm').value   = op.comm || 0;
  document.getElementById('eop-note').value   = op.note || '';
  onEditOpTypeChange();
  m.classList.add('open');
}
function onEditOpTypeChange() {
  var isSplit = document.getElementById('eop-type').value === 'split';
  document.getElementById('eop-price-row').style.display = isSplit ? 'none' : '';
  document.getElementById('eop-comm-row').style.display  = isSplit ? 'none' : '';
}
function closeEditOpModal() {
  document.getElementById('modal-edit-op').classList.remove('open');
}
function saveEditOp() {
  var m  = document.getElementById('modal-edit-op');
  var op = ops.find(function(o){ return o.id === m._editId; });
  if (!op) return;
  var type   = document.getElementById('eop-type').value;
  var ticker = document.getElementById('eop-ticker').value.trim().toUpperCase();
  var date   = document.getElementById('eop-date-edit').value;
  var qty    = parseFloat(document.getElementById('eop-qty').value);
  var price  = type === 'split' ? 0 : parseFloat(document.getElementById('eop-price').value);
  var comm   = type === 'split' ? 0 : (parseFloat(document.getElementById('eop-comm').value) || 0);
  var note   = document.getElementById('eop-note').value.trim();
  if (!ticker || !date || isNaN(qty) || qty <= 0) { alert('Compila tutti i campi obbligatori.'); return; }
  if (type !== 'split' && (isNaN(price) || price <= 0)) { alert('Inserisci un prezzo valido.'); return; }
  op.type = type; op.ticker = ticker; op.date = date;
  op.qty = qty; op.price = price; op.comm = comm;
  op.note = note || undefined;
  save(); closeEditOpModal(); renderAll();
  showToast('Operazione aggiornata ✓');
}
function clearAll() {
  if (!confirm('Eliminare TUTTO il portafoglio?\n\nVerranno cancellate operazioni, fondi, alert e storico prezzi.\nQuesta operazione non è reversibile.')) return;
  ops = []; prices = {}; curPrices = {}; alertLog = []; alerts = {};
  fondi = []; fnMovs = []; fnNavs = {};
  patrimonyHistory = [];
  save(); saveFondi();
  renderAll();
  showToast('Portafoglio azzerato ✓');
}

// ---------- Simulatore Capital Gain ----------
function updateSmTickers() {
  var pf  = getPortfolio(), sel = document.getElementById('sm-tk'), cur = sel.value;
  var html = '<option value="">-- seleziona --</option>';
  for (var i = 0; i < pf.length; i++) {
    html += '<option value="' + pf[i].ticker + '"' + (pf[i].ticker===cur?' selected':'') + '>' + pf[i].ticker + ' (' + f(pf[i].qty,pf[i].qty%1===0?0:3) + ' az.)</option>';
  }
  sel.innerHTML = html;
}

function smFromPortfolio() {
  var tk = document.getElementById('sm-tk').value, pf = getPortfolio(), pos = null;
  for (var i = 0; i < pf.length; i++) { if (pf[i].ticker === tk) { pos = pf[i]; break; } }
  if (pos) {
    document.getElementById('sm-hint').textContent  = 'Disp: ' + f(pos.qty,pos.qty%1===0?0:4) + ' az. · PMC FIFO: ' + fe(pos.pmc);
    document.getElementById('sm-price').value = (curPrices[tk] || pos.pmc).toFixed(4);
    document.getElementById('sm-qty').value   = Math.floor(pos.qty);
  }
  simulate();
}

function simulate() {
  var tk      = document.getElementById('sm-tk').value;
  var qty     = parseFloat(document.getElementById('sm-qty').value);
  var sp      = parseFloat(document.getElementById('sm-price').value);
  var comm    = parseFloat(document.getElementById('sm-comm').value) || 0;
  var taxSel  = document.getElementById('sm-tax').value;
  var taxRate = taxSel === 'custom' ? (parseFloat(document.getElementById('sm-tax-v').value)||26)/100 : parseFloat(taxSel)/100;
  document.getElementById('sm-custom-row').style.display = taxSel==='custom'?'block':'none';
  var out = document.getElementById('sm-out'), sw = document.getElementById('sm-scen-wrap');
  if (!tk || isNaN(qty) || isNaN(sp) || qty<=0 || sp<=0) {
    out.innerHTML = '<div class="empty" style="padding:20px 0">Inserisci tutti i parametri</div>';
    sw.style.display = 'none'; return;
  }
  var pf = getPortfolio(), pos = null;
  for (var i=0;i<pf.length;i++){if(pf[i].ticker===tk){pos=pf[i];break;}}
  if (!pos) { out.innerHTML='<div class="empty">Titolo non in portafoglio</div>'; return; }
  var q=Math.min(qty,pos.qty), cb=q*pos.pmc, gr=q*sp, nr=gr-comm, pl=nr-cb;
  var tax=Math.max(0,pl)*taxRate, net=nr-cb-tax, remQ=pos.qty-q, remV=remQ*sp;
  var r=function(lbl,val,cls){return '<div class="sim-row"><span class="sim-row-l">'+lbl+'</span><span class="sim-row-v '+(cls||'')+'">'+val+'</span></div>';};
  out.innerHTML = r('Ticker','<span class="tkb">'+tk+'</span>')+r('Quantità',f(q,q%1===0?0:4)+' az.')+r('PMC FIFO',fe(pos.pmc))+r('Prezzo vendita',fe(sp))+r('Ricavo lordo',fe(gr))+r('Commissioni',fe(comm),'dmc')+r('Ricavo netto',fe(nr))+r('Costo FIFO',fe(cb))+r('P&amp;L netto',fe(pl),cc(pl))+r('Aliquota',fp(taxRate*100))+r('Imponibile',fe(Math.max(0,pl)))+r('Residuo',f(remQ,remQ%1===0?0:4)+' az. · '+fe(remV),'dmc')+'<div class="cg-box"><div class="cg-l">Capital Gain da versare</div><div class="cg-v">'+fe(tax)+'</div><div class="cg-s">Netto in tasca: <strong style="color:'+(net>=0?'var(--g)':'var(--r)')+'">'+fe(net)+'</strong></div></div>';
  var scens=[-0.3,-0.2,-0.1,0,0.1,0.2,0.3], srows='';
  for(var i=0;i<scens.length;i++){var sc=1+scens[i],sc_sp=sp*sc,sc_gr=q*sc_sp,sc_nr=sc_gr-comm,sc_pl=sc_nr-cb,sc_tax=Math.max(0,sc_pl)*taxRate,sc_net=sc_nr-cb-sc_tax;var lbl=scens[i]===0?'Base':(scens[i]>0?'+':'')+(scens[i]*100)+'%';var cls=scens[i]>0?'pos':scens[i]<0?'neg':'dmc';srows+='<tr><td><span class="'+cls+'" style="font-weight:700">'+lbl+'</span></td><td>'+fe(sc_sp)+'</td><td>'+fe(sc_gr)+'</td><td><span class="'+cc(sc_pl)+'">'+fe(sc_pl)+'</span></td><td class="'+(sc_tax>0?'neg':'dmc')+'">'+fe(sc_tax)+'</td><td><strong class="'+cc(sc_net)+'">'+fe(sc_net)+'</strong></td></tr>';}
  document.getElementById('sm-scen').innerHTML = srows;
  sw.style.display = 'block';
}

// ---------- Export / Import JSON ----------
function buildSnapshot() {
  return { version: 1, title: portfolioTitle, exportedAt: new Date().toISOString(),
           ops: ops, fondi: fondi, fnMovs: fnMovs, fnNavs: fnNavs,
           alerts: alerts, curPrices: curPrices,
           patrimonyHistory: patrimonyHistory };
}

function exportJSON() {
  var snap = buildSnapshot();
  var name = (portfolioTitle || 'portfolio').replace(/[^a-zA-Z0-9_\-]/g,'_');
  var fileName = name + '_' + new Date().toISOString().slice(0,10) + '.json';
  var jsonStr  = JSON.stringify(snap, null, 2);

  if (currentUser && driveToken) {
    saveToDrive(jsonStr, fileName);
  } else {
    downloadJSON(jsonStr, fileName);
  }
}

function saveToDrive(jsonStr, fileName) {
  var blob = new Blob([jsonStr], { type: 'application/json' });
  if (driveFileId) {
    updateDriveFile(driveToken, driveFileId, blob, jsonStr, fileName);
  } else {
    createDriveFile(driveToken, blob, jsonStr, fileName);
  }
}

function createDriveFile(token, blob, jsonStr, fileName) {
  var metadata = { name: fileName, mimeType: 'application/json' };
  var form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  }).then(function(r) {
    if (r.status === 401) { driveToken = null; try { localStorage.removeItem('pd3_drive_token'); } catch(e) {} throw new Error('token scaduto'); }
    return r.json();
  }).then(function(data) {
    if (data.id) {
      driveFileId = data.id;
      try { localStorage.setItem('pd3_drive_fid', driveFileId); } catch(e) {}
      showToast('Salvato su Drive ✓');
    } else {
      throw new Error('no id: ' + JSON.stringify(data));
    }
  }).catch(function(e) {
    console.error('Drive create error:', e);
    showToast('Errore Drive — scarico in locale', 'tr');
    downloadJSON(jsonStr, fileName);
  });
}

function updateDriveFile(token, fileId, blob, jsonStr, fileName) {
  fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: blob
  }).then(function(r) {
    if (r.status === 404) {
      driveFileId = null;
      try { localStorage.removeItem('pd3_drive_fid'); } catch(e) {}
      createDriveFile(token, blob, jsonStr, fileName);
      return;
    }
    if (r.status === 401) {
      driveToken = null;
      try { localStorage.removeItem('pd3_drive_token'); } catch(e) {}
      showToast('Token Drive scaduto — rieffettua il login', 'tr');
      downloadJSON(jsonStr, fileName);
      return;
    }
    showToast('Aggiornato su Drive ✓');
  }).catch(function(e) {
    console.error('Drive update error:', e);
    showToast('Errore Drive — scarico in locale', 'tr');
    downloadJSON(jsonStr, fileName);
  });
}

function downloadJSON(jsonStr, fileName) {
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = fileName; a.click();
  showToast('Backup scaricato ✓');
}

function openImport()  { document.getElementById('modal-import').classList.add('open'); document.getElementById('import-file').value = ''; }
function closeImport() { document.getElementById('modal-import').classList.remove('open'); }

function doImport() {
  var file = document.getElementById('import-file').files[0];
  if (!file) { alert('Seleziona un file JSON.'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var snap = JSON.parse(e.target.result);
      if (!snap.version || !Array.isArray(snap.ops)) throw new Error('Formato non valido');
      if (!confirm('Importare "' + (snap.title||'portafoglio') + '"?\nI dati attuali verranno sostituiti.')) return;
      ops   = snap.ops   || [];
      fondi = snap.fondi || [];
      fnMovs = snap.fnMovs || [];
      fnNavs = snap.fnNavs || {};
      alerts           = snap.alerts           || {};
      curPrices        = snap.curPrices        || {};
      patrimonyHistory = snap.patrimonyHistory || [];
      portfolioTitle = snap.title || '';
      save(); saveFondi();
      try { localStorage.setItem('pd3_title', portfolioTitle); } catch(e2) {}
      applyTitle(); closeImport(); renderAll(); saveToFirebase();
      showToast('Portafoglio importato: ' + (portfolioTitle||'OK') + ' ✓');
    } catch(err) { alert('Errore nel file: ' + err.message); }
  };
  reader.readAsText(file);
}

// ---------- Export CSV Log ----------
function exportCSV() {
  if(ops.length===0) return; buildFIFO();
  var lines=['Data;Tipo;Ticker;Quantita;Prezzo;Controvalore;Commissioni;PL_FIFO'];
  var sorted=ops.slice().sort(function(a,b){return b.date<a.date?-1:1;});
  for(var i=0;i<sorted.length;i++){var o=sorted[i];lines.push([o.date,o.type.toUpperCase(),o.ticker,o.qty,o.price,o.qty*o.price,o.comm,(o.type==='sell'&&o._pl!==undefined)?o._pl.toFixed(2):''].join(';'));}
  var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='portfolio_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}

// ---------- Sorting colonne tabelle ----------
var sortState = { pf: { col: 'val', dir: 'desc' }, ov: { col: 'val', dir: 'desc' } };

function initSortableHeaders() {
  var ths = document.querySelectorAll('th.sortable');
  for (var i = 0; i < ths.length; i++) {
    (function(th) {
      th.addEventListener('click', function() {
        var col   = th.getAttribute('data-sort');
        var table = th.getAttribute('data-table');
        var st    = sortState[table];
        if (st.col === col) {
          st.dir = st.dir === 'asc' ? 'desc' : 'asc';
        } else {
          st.col = col; st.dir = 'desc';
        }
        // Update header classes
        var allThs = document.querySelectorAll('th.sortable[data-table="' + table + '"]');
        for (var j = 0; j < allThs.length; j++) {
          allThs[j].classList.remove('sort-asc', 'sort-desc');
        }
        th.classList.add(st.dir === 'asc' ? 'sort-asc' : 'sort-desc');
        // Re-render
        if (table === 'pf') renderPfPanel();
        if (table === 'ov') renderOvPanel();
      });
    })(ths[i]);
  }
}

// Chiamata diretta: i script sono sincroni a fine body, DOM già completo
initSortableHeaders();
