// ============================================================
//  UI — tabs, toast, theme, operazioni, simulatore, import/export
// ============================================================

// ---------- Toast ----------
var toastTimer = null;
function showToast(msg, cls) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (cls || 'ta') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 4000);
}

// ---------- Theme ----------
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-btn').textContent = isDark ? '☀ Light' : '☾ Dark';
  var t = totals(); drawDonut(t.pf, t.mkt);
}
function toggleTheme() {
  isDark = !isDark;
  try { localStorage.setItem('pd3_theme', isDark ? 'dark' : 'light'); } catch(e) {}
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
var TABS = ['tt','ov','op','lg','pf','sm','zn','al','fn','gu'];
function goTab(name) {
  var btns   = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.panel');
  for (var i = 0; i < btns.length; i++) { btns[i].classList.remove('active'); panels[i].classList.remove('active'); }
  var idx = TABS.indexOf(name);
  if (idx >= 0) { btns[idx].classList.add('active'); panels[idx].classList.add('active'); }
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
    ops.push({ id: Date.now(), type: 'split', ticker: ticker, date: date, qty: ratio, price: 0, comm: 0 });
    var count = applySplit(ticker, ratio, date);
    if (count === -1) {
      ops.pop(); // annulla il push
      showToast('⚠ Split già applicato per ' + ticker + ' in questa data');
      return;
    }
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
function clearAll() {
  if (!confirm('Eliminare TUTTO il portafoglio?\n\nVerranno cancellate operazioni, fondi, alert e storico prezzi.\nQuesta operazione non è reversibile.')) return;
  ops = []; prices = {}; curPrices = {}; alertLog = []; alerts = {};
  fondi = []; fnMovs = []; fnNavs = {};
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
           ops: ops, fondi: fondi, fnMovs: fnMovs, fnNavs: fnNavs, alerts: alerts, curPrices: curPrices };
}

function exportJSON() {
  var snap = buildSnapshot();
  var name = (portfolioTitle || 'portfolio').replace(/[^a-zA-Z0-9_\-]/g,'_');
  var blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = name + '_' + new Date().toISOString().slice(0,10) + '.json'; a.click();
  showToast('Backup salvato ✓');
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
      alerts    = snap.alerts    || {};
      curPrices = snap.curPrices || {};
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
