// ============================================================
//  RENDER — funzioni di rendering per tutti i pannelli
// ============================================================

// Colore stabile per ticker: stesso ticker → sempre stesso colore PALETTE
function tickerColor(ticker) {
  var hash = 0;
  for (var k = 0; k < ticker.length; k++) hash = ((hash << 5) - hash) + ticker.charCodeAt(k);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function renderAll() {
  buildFIFO();
  buildFondiFIFO();
  renderHeader();
  renderTtPanel();
  renderOvPanel();
  renderOpPanel();
  renderLogPanel();
  renderPfPanel();
  renderZnPanel();
  renderAlPanel();
  updateSmTickers();
}

// ---------- Header ----------
function renderHeader() {
  var g = grandTotals();
  var totEl = document.getElementById('h-tot'); totEl.textContent = fe(g.totMkt); totEl.className = 'hs-v pos';
  document.getElementById('h-mkt').textContent = fe(g.az.mkt);
  document.getElementById('h-fn').textContent  = fe(g.fnMkt);
  var hu = document.getElementById('h-unr'); hu.textContent = fe(g.totUnr); hu.className = 'hs-v ' + cc(g.totUnr);
  var hr = document.getElementById('h-rel'); hr.textContent = fe(g.totRel); hr.className = 'hs-v ' + cc(g.totRel);
}

// ---------- Pannello Totale ----------
function renderTtPanel() {
  var g   = grandTotals();
  var tot = g.totMkt, inv = g.totInv, unr = g.totUnr, rel = g.totRel;
  var unrPct = inv > 0 ? (unr / inv) * 100 : 0;

  var ttTot = document.getElementById('tt-tot'); ttTot.textContent = fe(tot); ttTot.className = 'kpi-v pos';
  document.getElementById('tt-tot-s').textContent = g.az.pf.length + ' azioni · ' + getFondiPortfolio().filter(function(p){ return p.qty > 0; }).length + ' fondi';
  document.getElementById('tt-inv').textContent   = fe(inv);
  var tu  = document.getElementById('tt-unr');  tu.textContent  = fe(unr);  tu.className  = 'kpi-v ' + cc(unr);
  var tus = document.getElementById('tt-unr-s'); tus.textContent = f(unrPct) + '% sul carico'; tus.className = 'kpi-s ' + cc(unr);
  var tr2 = document.getElementById('tt-rel');  tr2.textContent = fe(rel);  tr2.className = 'kpi-v ' + cc(rel);
  document.getElementById('tt-rel-s').textContent = 'Comm: ' + fe(g.totComm);

  // CAGR totale ponderato
  var cagrAz   = cagrPortfolio(g.az.pf);
  var fnPfOpen = getFondiPortfolio().filter(function(p){ return p.qty > 0; });
  var fnWtYrs  = 0, fnWtCost = 0;
  for (var i = 0; i < fnPfOpen.length; i++) {
    var cr = cagrFondo(fnPfOpen[i].fondo.id, fnPfOpen[i].cost, fnPfOpen[i].qty * fnPfOpen[i].navCorr);
    if (cr) { fnWtYrs += fnPfOpen[i].cost * cr.years; fnWtCost += fnPfOpen[i].cost; }
  }
  var cagrEl = document.getElementById('tt-cagr'), cagrSEl = document.getElementById('tt-cagr-s');
  var totCagrYrs = 0, totCagrCost = 0;
  if (cagrAz)       { totCagrYrs += g.az.inv * cagrAz.years; totCagrCost += g.az.inv; }
  if (fnWtCost > 0) { totCagrYrs += fnWtYrs; totCagrCost += fnWtCost; }
  if (totCagrCost > 0 && tot > 0 && inv > 0) {
    var avgYrs = totCagrYrs / totCagrCost;
    var cagr   = calcCAGR(inv, tot, avgYrs);
    if (cagr !== null) {
      cagrEl.textContent = (cagr >= 0 ? '+' : '') + f(cagr, 2) + '%/anno';
      cagrEl.className   = 'kpi-v ' + cc(cagr);
      cagrSEl.textContent = 'su ' + f(avgYrs, 1) + ' anni medi';
    } else { cagrEl.textContent = '—'; cagrEl.className = 'kpi-v dmc'; cagrSEl.textContent = 'dati insufficienti'; }
  } else { cagrEl.textContent = '—'; cagrEl.className = 'kpi-v dmc'; cagrSEl.textContent = 'nessuna posizione'; }

  // Mini KPI azioni
  document.getElementById('tt-az-mkt').textContent = fe(g.az.mkt);
  var azUnrEl = document.getElementById('tt-az-unr'); azUnrEl.textContent = fe(g.az.unr); azUnrEl.style.color = g.az.unr >= 0 ? 'var(--g)' : 'var(--r)';
  document.getElementById('tt-az-inv').textContent  = fe(g.az.inv);
  var azRelEl = document.getElementById('tt-az-rel'); azRelEl.textContent = fe(g.az.rel); azRelEl.style.color = g.az.rel >= 0 ? 'var(--g)' : 'var(--r)';

  // Mini KPI fondi
  document.getElementById('tt-fn-mkt').textContent  = fe(g.fnMkt);
  document.getElementById('tt-fn-inv').textContent  = fe(g.fnInv);
  var fnUnrEl = document.getElementById('tt-fn-unr'); fnUnrEl.textContent = fe(g.fnUnr); fnUnrEl.style.color = g.fnUnr >= 0 ? 'var(--g)' : 'var(--r)';
  var fnRelEl = document.getElementById('tt-fn-rel'); fnRelEl.textContent = fe(g.fnRel); fnRelEl.style.color = g.fnRel >= 0 ? 'var(--g)' : 'var(--r)';

  // Barre peso
  var azPct = tot > 0 ? (g.az.mkt / tot) * 100 : 50;
  var fnPct = tot > 0 ? (g.fnMkt  / tot) * 100 : 50;
  document.getElementById('tt-bar-az-w').style.width   = azPct + '%';
  document.getElementById('tt-bar-fn-w').style.width   = fnPct + '%';
  document.getElementById('tt-bar-az-lbl').textContent = 'Azioni ' + f(azPct, 1) + '%';
  document.getElementById('tt-bar-fn-lbl').textContent = 'Fondi ' + f(fnPct, 1) + '%';
  document.getElementById('tt-bar-az-pct').textContent = f(azPct, 1) + '%';
  document.getElementById('tt-bar-fn-pct').textContent = f(fnPct, 1) + '%';

  drawTtBar(g.az.mkt, g.fnMkt, g.az.inv, g.fnInv);
  renderHistChart();

  // Tabella unificata
  var tb = document.getElementById('tt-tbody');
  var azPf = g.az.pf, fnPfAll = getFondiPortfolio().filter(function(p){ return p.qty > 0; });
  var allCount = azPf.length + fnPfAll.length;
  document.getElementById('tt-pos-count').textContent = azPf.length + ' azioni + ' + fnPfAll.length + ' fondi';

  if (allCount === 0) { tb.innerHTML = '<tr><td colspan="10" class="empty-state"><div class="es-icon">📊</div><div class="es-title">Portafoglio vuoto</div><div class="es-sub">Registra il tuo primo acquisto per iniziare a tracciare il patrimonio</div><br><button class="btn btn-g btn-sm" style="margin-top:10px" onclick="goTab(\'op\')">+ Registra operazione</button></td></tr>'; return; }

  var rows = '';
  for (var i = 0; i < azPf.length; i++) {
    var p = azPf[i], cp = curPrices[p.ticker] || p.pmc;
    var mv = p.qty * cp, pl = mv - p.cost, plp = p.cost > 0 ? (pl/p.cost)*100 : 0;
    var cagrR = cagrForPosition(p.ticker, p.cost, mv);
    rows += '<tr><td><span class="tag buy">▪ AZ</span></td>' + tkCellSm(p.ticker);
    rows += '<td class="dmc">—</td><td class="dmc">' + f(p.qty, p.qty%1===0?0:3) + '</td>';
    rows += '<td class="dmc">' + fe(p.pmc) + '</td><td><strong>' + fe(cp) + '</strong></td>';
    rows += '<td>' + fe(mv) + '</td><td><span class="' + cc(pl) + '">' + fe(pl) + '</span></td>';
    rows += '<td><span class="' + cc(plp) + '">' + fp(plp) + '</span></td>';
    rows += '<td>' + fmtCAGR(cagrR ? cagrR.cagr : null, cagrR ? cagrR.years : null) + '</td></tr>';
  }
  for (var i = 0; i < fnPfAll.length; i++) {
    var p = fnPfAll[i];
    var mv = p.qty * p.navCorr, pl = mv - p.cost, plp = p.cost > 0 ? (pl/p.cost)*100 : 0;
    var cagrR = cagrFondo(p.fondo.id, p.cost, mv);
    rows += '<tr><td><span class="tag" style="background:var(--bld);color:var(--ac)">◈ FD</span></td>';
    rows += '<td>' + p.fondo.nome + '</td><td class="dmc">' + p.fondo.isin + '</td>';
    rows += '<td class="dmc">' + f(p.qty, 3) + '</td><td class="dmc">' + fe(p.navMedio) + '</td>';
    rows += '<td>' + fe(p.navCorr) + (fnNavs[p.fondo.id] ? ' <span style="color:var(--g)">●</span>' : '') + '</td>';
    rows += '<td>' + fe(mv) + '</td><td><span class="' + cc(pl) + '">' + fe(pl) + '</span></td>';
    rows += '<td><span class="' + cc(plp) + '">' + fp(plp) + '</span></td>';
    rows += '<td>' + fmtCAGR(cagrR ? cagrR.cagr : null, cagrR ? cagrR.years : null) + '</td></tr>';
  }
  tb.innerHTML = rows;
}

function drawTtBar(azMkt, fnMkt, azInv, fnInv) {
  var maxVal = Math.max(azMkt, fnMkt, azInv, fnInv, 1);
  function pct(v) { return Math.max(0, Math.min(100, (v / maxVal) * 100)).toFixed(1) + '%'; }

  var elAzMkt = document.getElementById('cc-az-mkt-bar');
  var elAzInv = document.getElementById('cc-az-inv-bar');
  var elFnMkt = document.getElementById('cc-fn-mkt-bar');
  var elFnInv = document.getElementById('cc-fn-inv-bar');
  var elAzVal = document.getElementById('cc-az-mkt');
  var elFnVal = document.getElementById('cc-fn-mkt');

  if (elAzMkt) elAzMkt.style.width = pct(azMkt);
  if (elAzInv) elAzInv.style.width = pct(azInv);
  if (elFnMkt) elFnMkt.style.width = pct(fnMkt);
  if (elFnInv) elFnInv.style.width = pct(fnInv);
  if (elAzVal) elAzVal.textContent = fe(azMkt);
  if (elFnVal) elFnVal.textContent = fe(fnMkt);
}

// ---------- Pannello Overview Azioni ----------
function renderOvPanel() {
  var t = totals(), pf = t.pf;
  var unrPct = t.inv > 0 ? (t.unr / t.inv) * 100 : 0;
  document.getElementById('ov-mkt').textContent    = fe(t.mkt);
  document.getElementById('ov-mkt').className      = 'kpi-v ' + cc(t.mkt);
  document.getElementById('ov-mkt-s').textContent  = pf.length + ' posizioni aperte';
  document.getElementById('ov-inv').textContent    = fe(t.inv);
  var ou  = document.getElementById('ov-unr');  ou.textContent  = fe(t.unr);  ou.className  = 'kpi-v ' + cc(t.unr);
  var ous = document.getElementById('ov-unr-s'); ous.textContent = f(unrPct) + '% sul carico'; ous.className = 'kpi-s ' + cc(t.unr);
  var or2 = document.getElementById('ov-rel');  or2.textContent = fe(t.rel);  or2.className = 'kpi-v ' + cc(t.rel);
  document.getElementById('ov-comm-s').textContent = 'Comm: ' + fe(t.comm);
  document.getElementById('ov-ops').textContent    = ops.length;
  var buys = 0, sells = 0;
  for (var i = 0; i < ops.length; i++) { if (ops[i].type === 'buy') buys++; else sells++; }
  document.getElementById('ov-ops-s').textContent = buys + ' acq · ' + sells + ' ven';
  drawDonut(pf, t.mkt);

  var pb = document.getElementById('ov-pos');
  if (pf.length === 0) { pb.innerHTML = '<tr><td colspan="11" class="empty-state"><div class="es-icon">📈</div><div class="es-title">Nessuna posizione aperta</div><div class="es-sub">Le posizioni appaiono qui dopo il primo acquisto</div><br><button class="btn btn-g btn-sm" style="margin-top:10px" onclick="goTab(\'op\')">+ Registra acquisto</button></td></tr>'; }
  else {
    // Sorting colonne
    var stOv = (typeof sortState !== 'undefined' && sortState.ov) ? sortState.ov : { col: 'val', dir: 'desc' };
    pf = pf.slice().sort(function(a, b) {
      var cp_a = curPrices[a.ticker] || a.pmc, cp_b = curPrices[b.ticker] || b.pmc;
      var get = function(p, cp) { return {
        qty: p.qty, val: p.qty * cp,
        pl: p.qty * cp - p.cost,
        plp: p.cost > 0 ? (p.qty * cp - p.cost) / p.cost : 0,
        cagr: (function(){ var r = cagrForPosition(p.ticker, p.cost, p.qty * cp); return r ? r.cagr : -9999; })()
      }; };
      var va = get(a, cp_a), vb = get(b, cp_b);
      var va_v = va[stOv.col] !== undefined ? va[stOv.col] : va.val;
      var vb_v = vb[stOv.col] !== undefined ? vb[stOv.col] : vb.val;
      return stOv.dir === 'asc' ? va_v - vb_v : vb_v - va_v;
    });
    var rows = '';
    for (var i = 0; i < pf.length; i++) {
      var p = pf[i], cp = curPrices[p.ticker] || p.pmc;
      var mv = p.qty * cp, pl = mv - p.cost, plp = p.cost > 0 ? (pl / p.cost) * 100 : 0;
      var lv = prices[p.ticker];
      var chgHtml = lv ? '<span class="' + cc(lv.change) + '">' + (lv.change >= 0 ? '+' : '') + f(lv.changePct) + '%</span>' : '<span class="dmc">—</span>';
      var col = tickerColor(p.ticker);
      var alStatus = getAlertStatus(p.ticker, cp);
      var ovCagr   = cagrForPosition(p.ticker, p.cost, mv);
      rows += '<tr><td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + col + '"></span></td>';
      rows += tkCellSm(p.ticker) + '<td class="dmc">' + f(p.qty, p.qty % 1 === 0 ? 0 : 3) + '</td>';
      rows += '<td class="dmc">' + fe(p.pmc) + '</td><td><strong>' + fe(cp) + '</strong></td>';
      rows += '<td>' + fe(mv) + '</td><td><span class="' + cc(pl) + '">' + fe(pl) + '</span></td>';
      rows += '<td><span class="' + cc(plp) + '">' + fp(plp) + '</span></td>';
      rows += '<td>' + fmtCAGR(ovCagr ? ovCagr.cagr : null, ovCagr ? ovCagr.years : null) + '</td>';
      rows += '<td>' + chgHtml + '</td><td>' + alStatus + '</td></tr>';
    }
    pb.innerHTML = rows;
  }

  var rb     = document.getElementById('ov-rec');
  var sorted = ops.slice().sort(function(a,b){ return b.date < a.date ? -1 : 1; }).slice(0, 6);
  if (sorted.length === 0) { rb.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="es-icon">📝</div><div class="es-title">Nessuna operazione</div><div class="es-sub">Le ultime operazioni registrate appariranno qui</div></td></tr>'; }
  else {
    var rrows = '';
    for (var i = 0; i < sorted.length; i++) {
      var op = sorted[i], ctv = op.qty * op.price;
      var plHtml = (op.type === 'sell' && op._pl !== undefined) ? '<span class="' + cc(op._pl) + '">' + fe(op._pl) + '</span>' : '<span class="dmc">—</span>';
      rrows += '<tr><td class="dmc">' + fmtDate(op.date) + '</td><td><span class="tag ' + op.type + '">' + (op.type === 'buy' ? '▲ ACQ' : op.type === 'split' ? '⇄ SPLIT' : '▼ VEN') + '</span></td>';
      rrows += tkCellSm(op.ticker) + '<td class="dmc">' + f(op.qty, op.qty % 1 === 0 ? 0 : 4) + '</td>';
      rrows += '<td>' + fe(op.price) + '</td><td>' + fe(ctv) + '</td><td>' + plHtml + '</td></tr>';
    }
    rb.innerHTML = rrows;
  }
}

function drawDonut(pf, totalMkt) {
  var canvas = document.getElementById('donut'); if (!canvas) return;
  var ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, 200, 200);
  document.getElementById('dc-v').textContent = pf.length || '0';
  var holeFill  = isDark ? '#111418' : isWarm ? '#1a1208' : '#ffffff';
  var emptyFill = isDark ? '#1e2530' : isWarm ? '#2c1f08' : '#dde2ea';
  if (pf.length === 0 || totalMkt <= 0) {
    ctx.beginPath(); ctx.arc(100,100,80,0,Math.PI*2); ctx.arc(100,100,50,Math.PI*2,0,true);
    ctx.fillStyle = emptyFill; ctx.fill();
    document.getElementById('donut-leg').innerHTML = '<div class="empty-state" style="padding:12px 0;text-align:center"><div class="es-icon">📊</div><div class="es-sub">Nessuna posizione</div></div>'; return;
  }
  var angle = -Math.PI / 2, items = [];
  for (var i = 0; i < pf.length; i++) {
    var cp = curPrices[pf[i].ticker] || pf[i].pmc, val = pf[i].qty * cp;
    var slice = (val / totalMkt) * Math.PI * 2, color = tickerColor(pf[i].ticker);
    ctx.beginPath(); ctx.arc(100,100,80,angle,angle+slice); ctx.arc(100,100,78,angle+slice,angle,true);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    items.push({ ticker: pf[i].ticker, color: color, pct: (val / totalMkt) * 100, val: val });
    angle += slice;
  }
  ctx.beginPath(); ctx.arc(100,100,50,0,Math.PI*2); ctx.fillStyle = holeFill; ctx.fill();
  var leg = '';
  for (var i = 0; i < items.length; i++) {
    var nm = tickerName(items[i].ticker);
    var tkHtml = '<span class="lt">' + items[i].ticker + (nm ? '<br><span style="font-size:10px;color:var(--dim);font-weight:400">' + nm + '</span>' : '') + '</span>';
    leg += '<div class="li"><span class="ld" style="background:' + items[i].color + '"></span>' + tkHtml + '<span class="lt-val">' + fe(items[i].val) + '</span><span class="lp">' + f(items[i].pct,1) + '%</span></div>';
  }
  document.getElementById('donut-leg').innerHTML = leg;
}

// ---------- Pannello Operazioni ----------
function renderOpPanel() {
  var sorted = ops.slice().sort(function(a,b){ return b.date < a.date ? -1 : 1; });
  document.getElementById('op-count').textContent = ops.length + ' operazioni';
  var tb = document.getElementById('op-tbody');
  if (sorted.length === 0) { tb.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="es-icon">✏️</div><div class="es-title">Nessuna operazione registrata</div><div class="es-sub">Usa il modulo sopra per aggiungere acquisti, vendite o split</div></td></tr>'; return; }
  var rows = '';
  for (var i = 0; i < Math.min(sorted.length, 10); i++) {
    var op = sorted[i];
    var plHtml = (op.type === 'sell' && op._pl !== undefined) ? '<span class="' + cc(op._pl) + '">' + fe(op._pl) + '</span>' : '<span class="dmc">—</span>';
    var opTag1   = op.type==='split' ? '<span class="tag" style="background:var(--aud);color:var(--au)">⇄ SPLIT</span>' : '<span class="tag ' + op.type + '">' + (op.type==='buy'?'▲ ACQ':'▼ VEN') + '</span>';
    var opQty1   = op.type==='split' ? 'x' + op.qty : f(op.qty, op.qty%1===0?0:4);
    var opPrice1 = op.type==='split' ? '<span class="dmc">—</span>' : fe(op.price);
    var opCtv1   = op.type==='split' ? '<span class="dmc">—</span>' : fe(op.qty*op.price);
    rows += '<tr><td class="dmc">' + fmtDate(op.date) + '</td><td>' + opTag1 + '</td>';
    rows += tkCellSm(op.ticker) + '<td>' + opQty1 + '</td><td>' + opPrice1 + '</td>';
    rows += '<td>' + opCtv1 + '</td><td class="dmc">' + fe(op.comm) + '</td><td>' + plHtml + '</td>';
    rows += '<td style="white-space:nowrap"><button class="btn btn-n btn-sm" style="padding:2px 7px;margin-right:3px" onclick="editOp(' + op.id + ')">✎</button><button class="btn btn-n btn-sm" style="color:var(--r);padding:2px 7px" onclick="delOp(' + op.id + ')">🗑</button></td></tr>';
  }
  tb.innerHTML = rows;
}

// ---------- Log ----------
function renderLogPanel() {
  var sorted = ops.slice().sort(function(a,b){ return b.date < a.date ? -1 : 1; });

  // Popola select ticker
  var sel = document.getElementById('lg-filter');
  var cur = sel ? sel.value : '';
  if (sel) {
    var tickers = [];
    for (var k = 0; k < ops.length; k++) {
      if (tickers.indexOf(ops[k].ticker) === -1) tickers.push(ops[k].ticker);
    }
    tickers.sort();
    var opts = '<option value="">Tutti i ticker</option>';
    for (var t = 0; t < tickers.length; t++) {
      opts += '<option value="' + tickers[t] + '"' + (tickers[t] === cur ? ' selected' : '') + '>' + tickers[t] + '</option>';
    }
    sel.innerHTML = opts;
  }

  // Filtra se selezionato
  if (cur) sorted = sorted.filter(function(o){ return o.ticker === cur; });

  var tb = document.getElementById('lg-tbody');
  if (sorted.length === 0) { tb.innerHTML = '<tr><td colspan="10" class="empty-state"><div class="es-icon">📋</div><div class="es-title">Log vuoto</div><div class="es-sub">Tutte le operazioni registrate appariranno qui in ordine cronologico</div><br><button class="btn btn-g btn-sm" style="margin-top:10px" onclick="goTab(\'op\')">+ Prima operazione</button></td></tr>'; return; }
  var rows = '';
  for (var i = 0; i < sorted.length; i++) {
    var op = sorted[i];
    var plHtml  = (op.type === 'sell' && op._pl !== undefined) ? '<span class="' + cc(op._pl) + '">' + fe(op._pl) + '</span>' : '<span class="dmc">—</span>';
    var pmcHtml = op.type === 'buy' ? fe4(op.price) : (op._pmc ? fe4(op._pmc) : '<span class="dmc">—</span>');
    var opTag2   = op.type==='split' ? '<span class="tag" style="background:var(--aud);color:var(--au)">⇄ SPLIT</span>' : '<span class="tag ' + op.type + '">' + (op.type==='buy'?'▲ ACQ':'▼ VEN') + '</span>';
    var opQty2   = op.type==='split' ? 'x' + op.qty : f(op.qty, op.qty%1===0?0:4);
    var opPrice2 = op.type==='split' ? '<span class="dmc">—</span>' : fe4(op.price);
    var opCtv2   = op.type==='split' ? '<span class="dmc">rapporto ' + op.qty + ':1</span>' : fe(op.qty*op.price);
    var noteHtml = op.note ? '<span title="' + op.note.replace(/"/g,'&quot;') + '" style="cursor:default;color:var(--au);font-size:11px" >💬</span>' : '';
    rows += '<tr><td class="dmc">' + (sorted.length-i) + '</td><td class="dmc">' + fmtDate(op.date) + '</td>';
    rows += '<td>' + opTag2 + '</td>' + tkCellSm(op.ticker);
    rows += '<td>' + opQty2 + '</td><td>' + opPrice2 + '</td>';
    rows += '<td>' + opCtv2 + '</td><td class="dmc">' + fe(op.comm) + '</td>';
    rows += '<td>' + plHtml + '</td><td class="dmc">' + pmcHtml + ' ' + noteHtml + '</td>';
    rows += '<td style="white-space:nowrap"><button class="btn btn-n btn-sm" style="padding:2px 7px;margin-right:3px" onclick="editOp(' + op.id + ')">✎</button><button class="btn btn-n btn-sm" style="color:var(--r);padding:2px 7px" onclick="delOp(' + op.id + ')">🗑</button></td></tr>';
  }
  tb.innerHTML = rows;
}

// ---------- Portafoglio ----------
function renderPfPanel() {
  var t = totals(), pf = t.pf, unrPct = t.inv > 0 ? (t.unr/t.inv)*100 : 0;
  document.getElementById('pf-mkt').textContent = fe(t.mkt);
  document.getElementById('pf-inv').textContent = fe(t.inv);
  var pu = document.getElementById('pf-unr'); pu.textContent = fe(t.unr); pu.className = 'kpi-v ' + cc(t.unr);
  document.getElementById('pf-unr-s').textContent = fp(unrPct);
  var pr = document.getElementById('pf-rel'); pr.textContent = fe(t.rel); pr.className = 'kpi-v ' + cc(t.rel);
  document.getElementById('pf-comm-s').textContent = 'Comm: ' + fe(t.comm);

  var cagrPf = cagrPortfolio(pf);
  var cagrEl = document.getElementById('pf-cagr'), cagrSEl = document.getElementById('pf-cagr-s');
  if (cagrPf && cagrPf.cagr !== null) {
    var cagrCls  = cagrPf.cagr > 0.05 ? 'pos' : cagrPf.cagr < -0.05 ? 'neg' : 'dmc';
    var cagrSign = cagrPf.cagr >= 0 ? '+' : '';
    cagrEl.textContent  = cagrSign + f(cagrPf.cagr, 2) + '%/anno';
    cagrEl.className    = 'kpi-v ' + cagrCls;
    cagrSEl.textContent = 'su ' + f(cagrPf.years, 1) + ' anni medi ponderati';
  } else { cagrEl.textContent = '—'; cagrEl.className = 'kpi-v dmc'; cagrSEl.textContent = 'inserisci date di acquisto'; }

  var tb = document.getElementById('pf-tbody');
  if (pf.length === 0) { tb.innerHTML = '<tr><td colspan="11" class="empty-state"><div class="es-icon">💼</div><div class="es-title">Portafoglio vuoto</div><div class="es-sub">Registra un acquisto per vedere i prezzi live e il dettaglio del portafoglio</div><br><button class="btn btn-g btn-sm" style="margin-top:10px" onclick="goTab(\'op\')">+ Registra acquisto</button></td></tr>'; return; }

  // Sorting colonne
  var st = (typeof sortState !== 'undefined' && sortState.pf) ? sortState.pf : { col: 'val', dir: 'desc' };
  pf = pf.slice().sort(function(a, b) {
    var cp_a = curPrices[a.ticker] || a.pmc, cp_b = curPrices[b.ticker] || b.pmc;
    var get = function(p, cp) { return {
      qty: p.qty, price: cp, val: p.qty * cp,
      pl: p.qty * cp - p.cost,
      plp: p.cost > 0 ? (p.qty * cp - p.cost) / p.cost : 0,
      wt: p.qty * cp,
      cagr: (function(){ var r = cagrForPosition(p.ticker, p.cost, p.qty * cp); return r ? r.cagr : -9999; })()
    }; };
    var va = get(a, cp_a), vb = get(b, cp_b);
    var va_v = va[st.col] !== undefined ? va[st.col] : va.val;
    var vb_v = vb[st.col] !== undefined ? vb[st.col] : vb.val;
    return st.dir === 'asc' ? va_v - vb_v : vb_v - va_v;
  });

  var rows = '';
  for (var i = 0; i < pf.length; i++) {
    var p = pf[i], cp = curPrices[p.ticker] || p.pmc;
    var mv = p.qty * cp, pl = mv - p.cost, plp = p.cost>0?(pl/p.cost)*100:0, wt = t.mkt>0?(mv/t.mkt)*100:0;
    var lv = prices[p.ticker];
    var priceCell, chgCell;
    if (lv) {
      priceCell = '<strong>' + fe(lv.price) + '</strong><div style="font-size:9px;color:var(--muted)">' + lv.sym + ' · ' + lv.currency + '</div>';
      var sign  = lv.change >= 0 ? '+' : '';
      chgCell   = '<span class="' + cc(lv.change) + '">' + sign + f(lv.change) + ' (' + sign + f(lv.changePct) + '%)</span>';
    } else {
      priceCell = '<input type="number" value="' + cp.toFixed(4) + '" step="any" style="background:var(--s2);border:1px solid var(--b2);color:var(--tx);font-family:var(--mono);font-size:11px;padding:4px 7px;border-radius:3px;width:88px;outline:none" onchange="setPx(\'' + p.ticker + '\',this.value)" onfocus="this.style.borderColor=\'var(--g)\'" onblur="this.style.borderColor=\'var(--b2)\'">';
      chgCell   = '<span class="dmc">—</span>';
    }
    rows += '<tr id="row-' + p.ticker + '">' + tkCell(p.ticker);
    rows += '<td>' + f(p.qty,p.qty%1===0?0:4) + '</td><td>' + fe(p.pmc) + '</td><td>' + priceCell + '</td><td>' + chgCell + '</td>';
    rows += '<td>' + fe(mv) + '</td><td><span class="' + cc(pl) + '">' + fe(pl) + '</span></td><td><span class="' + cc(plp) + '">' + fp(plp) + '</span></td>';
    var cagrRes = cagrForPosition(p.ticker, p.cost, mv);
    rows += '<td>' + fmtCAGR(cagrRes ? cagrRes.cagr : null, cagrRes ? cagrRes.years : null) + '</td>';
    rows += '<td><div>' + fp(wt) + '</div><div class="pb"><div class="pf" style="width:' + Math.min(wt,100) + '%;background:var(--g)"></div></div></td>';
    rows += '<td class="dmc">' + fe(p.comm) + '</td></tr>';
  }
  tb.innerHTML = rows;
}

function setPx(ticker, val) {
  var v = parseFloat(val);
  if (!isNaN(v) && v > 0) { curPrices[ticker] = v; save(); renderAll(); }
}

// ---------- Zainetto fiscale ----------
function renderZnPanel() {
  buildFIFO();
  var sells = ops.filter(function(o){ return o.type === 'sell' && o._pl !== undefined; });
  var totalPlus = 0, totalMinus = 0, byYear = {};
  for (var i = 0; i < sells.length; i++) {
    var s  = sells[i];
    var yr = s.date ? s.date.slice(0, 4) : '?';
    if (!byYear[yr]) byYear[yr] = { plus: 0, minus: 0 };
    if (s._pl >= 0) { totalPlus  += s._pl;            byYear[yr].plus  += s._pl; }
    else            { totalMinus += Math.abs(s._pl);   byYear[yr].minus += Math.abs(s._pl); }
  }
  var saldo = totalPlus - totalMinus;
  document.getElementById('zn-plus').textContent  = fe(totalPlus);
  document.getElementById('zn-minus').textContent = fe(totalMinus);
  var sv = document.getElementById('zn-saldo');  sv.textContent = fe(saldo); sv.className = 'zn-v ' + cc(saldo);
  var sc = document.getElementById('zn-saldo-card'); sc.className = 'zn-card ' + (saldo >= 0 ? 'ok' : '');
  var ss = document.getElementById('zn-saldo-s');
  if (saldo > 0)      ss.textContent = 'Imposta stimata: ' + fe(saldo * 0.26) + ' (al 26%)';
  else if (saldo < 0) ss.textContent = 'Credito compensabile: ' + fe(Math.abs(saldo));
  else                ss.textContent = 'In pari';

  var tb      = document.getElementById('zn-tbody');
  var years   = Object.keys(byYear).sort();
  var curYear = new Date().getFullYear();
  if (years.length === 0) { tb.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="es-icon">🎒</div><div class="es-title">Nessuna vendita registrata</div><div class="es-sub">Il saldo delle plusvalenze e minusvalenze per anno apparirà qui</div></td></tr>'; }
  else {
    var rows = '';
    for (var i = 0; i < years.length; i++) {
      var yr = years[i], d = byYear[yr], yrNum = parseInt(yr);
      var expiry  = yrNum + 4;
      var salYr   = d.plus - d.minus;
      var expired = expiry <= curYear;
      var stato   = expired ? '<span class="neg">Scaduta</span>' : (salYr < 0 ? '<span class="neu">Compensabile</span>' : '<span class="pos">In utile</span>');
      rows += '<tr><td>' + yr + '</td><td class="pos">' + fe(d.plus) + '</td><td class="neg">' + fe(d.minus) + '</td>';
      rows += '<td><span class="' + cc(salYr) + '">' + fe(salYr) + '</span></td>';
      rows += '<td class="dmc">31/12/' + expiry + '</td><td>' + stato + '</td></tr>';
    }
    tb.innerHTML = rows;
  }

  var otb         = document.getElementById('zn-ops-tbody');
  var sellsSorted = sells.slice().sort(function(a,b){ return b.date < a.date ? -1 : 1; });
  if (sellsSorted.length === 0) { otb.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="es-icon">📑</div><div class="es-title">Nessuna vendita</div><div class="es-sub">Il dettaglio fiscale di ogni vendita apparirà qui</div></td></tr>'; }
  else {
    var orows = '';
    for (var i = 0; i < sellsSorted.length; i++) {
      var s = sellsSorted[i], plNetto = s._pl;
      var tipo    = plNetto >= 0 ? '<span class="pos">Plusvalenza</span>' : '<span class="neg">Minusvalenza</span>';
      var plLordo = s.qty * s.price - (s._cost || 0);
      orows += '<tr><td class="dmc">' + fmtDate(s.date) + '</td>' + tkCellSm(s.ticker);
      orows += '<td>' + f(s.qty, s.qty%1===0?0:4) + '</td><td>' + fe(s.price) + '</td>';
      orows += '<td class="dmc">' + (s._pmc ? fe(s._pmc) : '—') + '</td>';
      orows += '<td><span class="' + cc(plLordo) + '">' + fe(plLordo) + '</span></td>';
      orows += '<td class="dmc">' + fe(s.comm) + '</td>';
      orows += '<td><span class="' + cc(plNetto) + '">' + fe(plNetto) + '</span></td><td>' + tipo + '</td></tr>';
    }
    otb.innerHTML = orows;
  }
}

// ---------- Alert ----------
function getAlertStatus(ticker, price) {
  var al = alerts[ticker];
  if (!al || (!al.target && !al.stop)) return '<span class="al-none">—</span>';
  var parts = [];
  if (al.target) {
    var cls  = price >= al.target ? 'al-hit-t' : 'al-ok';
    var icon = price >= al.target ? '🎯' : '▲';
    parts.push('<span class="al-indicator ' + cls + '">' + icon + ' ' + fe(al.target) + '</span>');
  }
  if (al.stop) {
    var cls2  = price <= al.stop ? 'al-hit-s' : 'al-warn';
    var icon2 = price <= al.stop ? '🛑' : '▼';
    parts.push('<span class="al-indicator ' + cls2 + '">' + icon2 + ' ' + fe(al.stop) + '</span>');
  }
  return parts.join(' ');
}

function setAlert(ticker, field, val) {
  if (!alerts[ticker]) alerts[ticker] = { target: null, stop: null };
  alerts[ticker][field] = val ? parseFloat(val) : null;
  save(); renderAll();
}

function renderAlPanel() {
  var pf    = getPortfolio();
  var cards = document.getElementById('al-cards');
  if (pf.length === 0) { cards.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center"><div class="es-icon">🔔</div><div class="es-title">Nessuna posizione</div><div class="es-sub">Gli alert si impostano sulle posizioni aperte. Registra prima un acquisto.</div><br><button class="btn btn-g btn-sm" style="margin-top:10px" onclick="goTab(\'op\')">+ Registra acquisto</button></div>'; }
  else {
    var html = '<div class="alert-grid">';
    for (var i = 0; i < pf.length; i++) {
      var p  = pf[i], cp = curPrices[p.ticker] || p.pmc;
      var al = alerts[p.ticker] || { target: null, stop: null };
      var status = getAlertStatus(p.ticker, cp);
      html += '<div class="alert-card">';
      html += '<h4><span class="tkb">' + p.ticker + '</span> &nbsp; <span class="dmc" style="font-family:var(--mono);font-size:11px">Prezzo: ' + fe(cp) + '</span> &nbsp;' + status + '</h4>';
      html += '<div class="alert-row"><label>Target €</label><input type="number" step="any" placeholder="es. 25.00" value="' + (al.target || '') + '" onchange="setAlert(\'' + p.ticker + '\',\'target\',this.value)" onfocus="this.style.borderColor=\'var(--g)\'" onblur="this.style.borderColor=\'var(--b2)\'"><span style="font-size:10px;color:var(--dim)">↑ notifica se sale sopra</span></div>';
      html += '<div class="alert-row"><label>Stop €</label><input type="number" step="any" placeholder="es. 18.00" value="' + (al.stop || '') + '" onchange="setAlert(\'' + p.ticker + '\',\'stop\',this.value)" onfocus="this.style.borderColor=\'var(--r)\'" onblur="this.style.borderColor=\'var(--b2)\'"><span style="font-size:10px;color:var(--dim)">↓ notifica se scende sotto</span></div>';
      html += '</div>';
    }
    html += '</div>';
    cards.innerHTML = html;
  }

  var ltb = document.getElementById('al-log-tbody');
  document.getElementById('al-log-count').textContent = alertLog.length + ' notifiche';
  if (alertLog.length === 0) { ltb.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="es-icon">🟢</div><div class="es-title">Nessun alert scattato</div><div class="es-sub">Lo storico degli alert target e stop loss apparirà qui</div></td></tr>'; }
  else {
    var lrows = '';
    for (var i = 0; i < alertLog.length; i++) {
      var a = alertLog[i], tCls = a.type === 'TARGET' ? 'pos' : 'neg';
      lrows += '<tr><td class="dmc">' + a.time + '</td>' + tkCellSm(a.ticker);
      lrows += '<td><span class="' + tCls + '">' + a.type + '</span></td>';
      lrows += '<td>' + fe(a.threshold) + '</td><td>' + fe(a.price) + '</td></tr>';
    }
    ltb.innerHTML = lrows;
  }
}

// ---------- Grafico storico patrimonio ----------
var histPeriod = '1M';
var histResizeObs = null;

function setHistPeriod(period, btn) {
  histPeriod = period;
  var btns = document.querySelectorAll('.hist-period-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  renderHistChart();
}

function renderHistChart() {
  var wrap  = document.getElementById('hist-chart');
  var empty = document.getElementById('hist-empty');
  if (!wrap) return;

  // Filtra per periodo
  var now    = new Date();
  var cutoff = new Date(now);
  if      (histPeriod === '1M')  cutoff.setMonth(now.getMonth() - 1);
  else if (histPeriod === '3M')  cutoff.setMonth(now.getMonth() - 3);
  else if (histPeriod === '6M')  cutoff.setMonth(now.getMonth() - 6);
  else if (histPeriod === '1A')  cutoff.setFullYear(now.getFullYear() - 1);
  else cutoff = new Date('2000-01-01');

  var cutStr = cutoff.toISOString().slice(0, 10);
  var data   = (patrimonyHistory || []).filter(function(s) { return s.date >= cutStr; });

  if (data.length < 2) {
    wrap.style.display = 'none';
    if (empty) { empty.style.display = 'block'; }
    return;
  }
  wrap.style.display = 'block';
  if (empty) empty.style.display = 'none';

  // Usa Canvas per evitare distorsioni di testo con SVG scalato
  var existingCanvas = wrap.querySelector('canvas');
  var canvas = existingCanvas || document.createElement('canvas');
  if (!existingCanvas) {
    canvas.style.width  = '100%';
    canvas.style.height = '160px';
    canvas.style.display = 'block';
    wrap.innerHTML = '';
    wrap.appendChild(canvas);
  }

  // DPR per retina
  var dpr = window.devicePixelRatio || 1;
  var W   = wrap.clientWidth  || wrap.offsetWidth || 600;
  var H   = 160;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var PAD = { top: 20, right: 20, bottom: 30, left: 64 };
  var cw  = W - PAD.left - PAD.right;
  var ch  = H - PAD.top  - PAD.bottom;

  var vals  = data.map(function(s) { return s.val; });
  var minV  = Math.min.apply(null, vals);
  var maxV  = Math.max.apply(null, vals);
  var range = maxV - minV || 1;
  var lo    = minV - range * 0.12;
  var hi    = maxV + range * 0.12;

  var color     = isDark ? '#00d4a0' : isWarm ? '#f59e0b' : '#00a878';
  var gridColor = isDark ? 'rgba(255,255,255,0.07)' : isWarm ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
  var textColor = isDark ? '#4d7490' : isWarm ? '#8a6830' : '#8099a8';
  var bgColor   = isDark ? '#111418' : isWarm ? '#1a1208' : '#ffffff';

  function xp(i) { return PAD.left + (data.length > 1 ? (i / (data.length - 1)) * cw : cw / 2); }
  function yp(v) { return PAD.top + ch - ((v - lo) / (hi - lo)) * ch; }

  // Background
  ctx.clearRect(0, 0, W, H);

  // Grid lines + Y labels (4 levels)
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  for (var j = 0; j <= 3; j++) {
    var gv  = lo + (hi - lo) * (j / 3);
    var gy  = yp(gv);
    var glb = gv >= 1000000 ? (gv/1000000).toFixed(1) + 'M'
            : gv >= 1000    ? (gv/1000).toFixed(1) + 'k'
            : gv.toFixed(0);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, gy);
    ctx.lineTo(PAD.left + cw, gy);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.fillText('€' + glb, PAD.left - 6, gy + 3.5);
  }

  // Area fill gradient
  var grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + ch);
  grad.addColorStop(0,   isDark ? 'rgba(0,212,160,0.20)' : isWarm ? 'rgba(245,158,11,0.18)' : 'rgba(0,168,120,0.15)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(xp(0), yp(data[0].val));
  for (var i = 1; i < data.length; i++) {
    // Smooth curve con bezier
    var x0 = xp(i-1), y0 = yp(data[i-1].val);
    var x1 = xp(i),   y1 = yp(data[i].val);
    var cpx = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
  }
  ctx.lineTo(xp(data.length - 1), PAD.top + ch);
  ctx.lineTo(xp(0), PAD.top + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xp(0), yp(data[0].val));
  for (var i = 1; i < data.length; i++) {
    var x0 = xp(i-1), y0 = yp(data[i-1].val);
    var x1 = xp(i),   y1 = yp(data[i].val);
    var cpx = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Last point dot
  var lastX = xp(data.length - 1), lastY = yp(data[data.length - 1].val);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // X axis labels (max 6)
  var step = Math.max(1, Math.floor(data.length / 6));
  ctx.font      = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = textColor;
  for (var k = 0; k < data.length; k += step) {
    ctx.fillText(data[k].date.slice(5).replace('-','/'), xp(k), H - 8);
  }
  // Always show last date
  ctx.fillText(data[data.length-1].date.slice(5).replace('-','/'), xp(data.length-1), H - 8);

  // Delta badge (top right)
  var first     = data[0].val, last = data[data.length-1].val;
  var delta     = last - first;
  var deltaPct  = first > 0 ? (delta / first) * 100 : 0;
  var deltaSign = delta >= 0 ? '+' : '';
  var dColor    = delta >= 0 ? color : '#ff4d6a';
  var dLabel    = deltaSign + deltaPct.toFixed(2) + '%';
  var dSub      = '(' + deltaSign + (Math.abs(delta) >= 1000 ? (delta/1000).toFixed(1)+'k' : Math.round(delta)) + '€)';

  ctx.font      = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = dColor;
  ctx.fillText(dLabel, W - PAD.right, PAD.top + 1);
  ctx.font      = '10px Inter, sans-serif';
  ctx.fillStyle = textColor;
  ctx.fillText(dSub, W - PAD.right, PAD.top + 14);

  // ResizeObserver per re-render al cambio larghezza
  if (!histResizeObs && window.ResizeObserver) {
    histResizeObs = new ResizeObserver(function() { renderHistChart(); });
    histResizeObs.observe(wrap);
  }
}
