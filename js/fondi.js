// ============================================================
//  FONDI — engine FIFO, CAGR, render pannello fondi comuni
// ============================================================

// ---------- FIFO Fondi ----------
function buildFondiFIFO() {
  var state = {};
  for (var i = 0; i < fondi.length; i++) {
    state[fondi[i].id] = { lots: [], realized: 0, comm: 0 };
  }
  var sorted = fnMovs.slice().sort(function(a,b){ return a.data < b.data ? -1 : 1; });
  for (var i = 0; i < sorted.length; i++) {
    var m = sorted[i];
    if (!state[m.fondoId]) continue;
    state[m.fondoId].comm += (m.comm || 0);
    if (m.tipo === 'sub') {
      state[m.fondoId].lots.push({ qty: m.quote, nav: m.nav });
    } else {
      var rem = m.quote, cost = 0, lots = state[m.fondoId].lots;
      while (rem > 0 && lots.length > 0) {
        var lot = lots[0];
        var take = Math.min(lot.qty, rem);
        cost += take * lot.nav;
        lot.qty -= take; rem -= take;
        if (lot.qty < 0.00001) lots.shift();
      }
      var proceeds = m.quote * m.nav - (m.comm || 0);
      var pl = proceeds - cost;
      state[m.fondoId].realized += pl;
      m._pl       = pl;
      m._navMedio = m.quote > 0 ? cost / m.quote : 0;
    }
  }
  return state;
}

function getFondiPortfolio() {
  var fifo = buildFondiFIFO();
  var res = [];
  for (var i = 0; i < fondi.length; i++) {
    var fd = fondi[i], d = fifo[fd.id];
    if (!d) continue;
    var qty = 0, cost = 0;
    for (var j = 0; j < d.lots.length; j++) { qty += d.lots[j].qty; cost += d.lots[j].qty * d.lots[j].nav; }
    if (qty < 0.00001 && d.realized === 0 && d.comm === 0) continue;
    var navCorr = fnNavs[fd.id]
      ? (typeof fnNavs[fd.id] === 'object' ? fnNavs[fd.id].val : fnNavs[fd.id])
      : (qty > 0 ? cost / qty : 0);
    var navDate = fnNavs[fd.id] && typeof fnNavs[fd.id] === 'object' ? fnNavs[fd.id].date : null;
    res.push({ fondo: fd, qty: qty, navMedio: qty > 0 ? cost / qty : 0, cost: cost, navCorr: navCorr, navDate: navDate, realized: d.realized, comm: d.comm });
  }
  return res;
}

function cagrFondo(fondoId, cost, value) {
  var subs = fnMovs.filter(function(m){ return m.fondoId === fondoId && m.tipo === 'sub'; });
  if (subs.length === 0 || cost <= 0 || value <= 0) return null;
  subs.sort(function(a,b){ return a.data < b.data ? -1 : 1; });
  var totalCost = 0, weightedYrs = 0;
  for (var i = 0; i < subs.length; i++) {
    var lc = subs[i].quote * subs[i].nav, yrs = yearsFromDate(subs[i].data);
    if (yrs === null) continue;
    weightedYrs += lc * yrs; totalCost += lc;
  }
  if (totalCost <= 0) return null;
  return { cagr: calcCAGR(cost, value, weightedYrs / totalCost), years: weightedYrs / totalCost };
}

// ---------- Modals ----------
function openFondoModal(id) {
  var m = document.getElementById('fn-modal-fondo');
  document.getElementById('fn-modal-title').textContent = id ? 'Modifica fondo' : 'Nuovo fondo';
  if (id) {
    var fd = fondi.find(function(x){ return x.id === id; });
    if (fd) {
      document.getElementById('fn-nome').value    = fd.nome;
      document.getElementById('fn-isin').value    = fd.isin;
      document.getElementById('fn-societa').value = fd.societa || '';
      document.getElementById('fn-cat').value     = fd.cat     || 'azionario';
      document.getElementById('fn-valuta').value  = fd.valuta  || 'EUR';
      m._editId = id;
    }
  } else {
    document.getElementById('fn-nome').value    = '';
    document.getElementById('fn-isin').value    = '';
    document.getElementById('fn-societa').value = '';
    document.getElementById('fn-cat').value     = 'azionario';
    document.getElementById('fn-valuta').value  = 'EUR';
    m._editId = null;
  }
  m.classList.add('open');
}
function closeFondoModal() { document.getElementById('fn-modal-fondo').classList.remove('open'); }

function saveFondo() {
  var nome    = document.getElementById('fn-nome').value.trim();
  var isin    = document.getElementById('fn-isin').value.trim().toUpperCase();
  var societa = document.getElementById('fn-societa').value.trim();
  var cat     = document.getElementById('fn-cat').value;
  var valuta  = document.getElementById('fn-valuta').value;
  if (!nome || !isin) { alert('Nome e ISIN obbligatori.'); return; }
  var m = document.getElementById('fn-modal-fondo');
  if (m._editId) {
    var fd = fondi.find(function(x){ return x.id === m._editId; });
    if (fd) { fd.nome = nome; fd.isin = isin; fd.societa = societa; fd.cat = cat; fd.valuta = valuta; }
  } else {
    fondi.push({ id: Date.now(), nome: nome, isin: isin, societa: societa, cat: cat, valuta: valuta });
  }
  saveFondi(); closeFondoModal(); renderFnPanel();
}

function delFondo(id) {
  if (!confirm('Eliminare il fondo e tutti i suoi movimenti?')) return;
  fondi  = fondi.filter(function(x){ return x.id !== id; });
  fnMovs = fnMovs.filter(function(x){ return x.fondoId !== id; });
  delete fnNavs[id];
  saveFondi(); renderFnPanel();
}

function delSub(id) {
  if (!confirm('Eliminare questo movimento?')) return;
  fnMovs = fnMovs.filter(function(m){ return m.id !== id; });
  saveFondi(); renderFnPanel();
}

function openSubModal(fondoId) {
  populateFondoSelect('fn-sub-fondo', fondoId);
  document.getElementById('fn-sub-data').value  = new Date().toISOString().slice(0,10);
  document.getElementById('fn-sub-quote').value = '';
  document.getElementById('fn-sub-nav').value   = '';
  document.getElementById('fn-sub-comm').value  = '0';
  document.getElementById('fn-sub-tipo').value  = 'sub';
  document.getElementById('fn-sub-warn').style.display = 'none';
  document.getElementById('fn-modal-sub').classList.add('open');
}
function closeSubModal() { document.getElementById('fn-modal-sub').classList.remove('open'); }

function saveSub() {
  var fondoId = parseInt(document.getElementById('fn-sub-fondo').value);
  var tipo    = document.getElementById('fn-sub-tipo').value;
  var data    = document.getElementById('fn-sub-data').value;
  var quote   = parseFloat(document.getElementById('fn-sub-quote').value);
  var nav     = parseFloat(document.getElementById('fn-sub-nav').value);
  var comm    = parseFloat(document.getElementById('fn-sub-comm').value) || 0;
  if (!fondoId || !data || isNaN(quote) || isNaN(nav) || quote <= 0 || nav <= 0) { alert('Compila tutti i campi.'); return; }
  if (tipo === 'rim') {
    var pf  = getFondiPortfolio();
    var pos = pf.find(function(p){ return p.fondo.id === fondoId; });
    if (!pos || pos.qty < quote - 0.00001) {
      document.getElementById('fn-sub-warn').style.display = 'block';
      setTimeout(function(){ document.getElementById('fn-sub-warn').style.display = 'none'; }, 4000);
      return;
    }
  }
  fnMovs.push({ id: Date.now(), fondoId: fondoId, tipo: tipo, data: data, quote: quote, nav: nav, comm: comm });
  saveFondi(); closeSubModal(); renderFnPanel();
}

function editSub(id) {
  var mv = fnMovs.find(function(m){ return m.id === id; });
  if (!mv) return;
  var em = document.getElementById('modal-edit-sub');
  em._editId = id;
  populateFondoSelect('esub-fondo', mv.fondoId);
  document.getElementById('esub-tipo').value  = mv.tipo;
  document.getElementById('esub-data').value  = mv.data;
  document.getElementById('esub-quote').value = mv.quote;
  document.getElementById('esub-nav').value   = mv.nav;
  document.getElementById('esub-comm').value  = mv.comm || 0;
  document.getElementById('esub-note').value  = mv.note || '';
  em.classList.add('open');
}
function closeEditSubModal() {
  var em = document.getElementById('modal-edit-sub');
  if (em) em.classList.remove('open');
}
function saveEditSub() {
  var em     = document.getElementById('modal-edit-sub');
  var id     = em._editId;
  var mv     = fnMovs.find(function(m){ return m.id === id; });
  if (!mv) return;
  var fondoId = parseInt(document.getElementById('esub-fondo').value);
  var tipo    = document.getElementById('esub-tipo').value;
  var data    = document.getElementById('esub-data').value;
  var quote   = parseFloat(document.getElementById('esub-quote').value);
  var nav     = parseFloat(document.getElementById('esub-nav').value);
  var comm    = parseFloat(document.getElementById('esub-comm').value) || 0;
  var note    = document.getElementById('esub-note').value.trim();
  if (!fondoId || !data || isNaN(quote) || quote <= 0 || isNaN(nav) || nav <= 0) { alert('Compila tutti i campi obbligatori.'); return; }
  mv.fondoId = fondoId;
  mv.tipo    = tipo;
  mv.data    = data;
  mv.quote   = quote;
  mv.nav     = nav;
  mv.comm    = comm;
  mv.note    = note || undefined;
  saveFondi(); closeEditSubModal(); renderFnPanel();
  if (typeof showToast === 'function') showToast('Movimento aggiornato ✓');
}

function openNavModal() {
  var pf = getFondiPortfolio().filter(function(p){ return p.qty > 0.00001; });
  var html = '';
  if (pf.length === 0) { html = '<div class="empty" style="padding:12px 0">Nessuna posizione aperta</div>'; }
  else {
    for (var i = 0; i < pf.length; i++) {
      var p = pf[i];
      html += '<div class="fg" style="margin-bottom:12px">';
      html += '<label>' + p.fondo.nome + ' <span style="color:var(--muted);font-size:9px">' + p.fondo.isin + '</span></label>';
      html += '<input type="number" step="any" data-fid="' + p.fondo.id + '" value="' + (p.navCorr || '') + '" placeholder="NAV corrente">';
      html += '</div>';
    }
  }
  document.getElementById('fn-nav-inputs').innerHTML = html;
  var inputs = document.querySelectorAll('#fn-nav-inputs input');
  for (var i = 0; i < inputs.length; i++) {
    inputs[i].style.cssText = 'background:var(--s2);border:1px solid var(--b2);color:var(--tx);font-family:var(--mono);font-size:12px;padding:7px 9px;border-radius:3px;outline:none;width:100%';
    inputs[i].addEventListener('focus', function(){ this.style.borderColor = 'var(--g)'; });
    inputs[i].addEventListener('blur',  function(){ this.style.borderColor = 'var(--b2)'; });
  }
  document.getElementById('fn-modal-nav').classList.add('open');
}
function closeNavModal() { document.getElementById('fn-modal-nav').classList.remove('open'); }

function saveNavs() {
  var inputs = document.querySelectorAll('#fn-nav-inputs input[data-fid]');
  for (var i = 0; i < inputs.length; i++) {
    var fid = parseInt(inputs[i].getAttribute('data-fid'));
    var v   = parseFloat(inputs[i].value);
    if (!isNaN(v) && v > 0) fnNavs[fid] = { val: v, date: new Date().toISOString().slice(0, 10) };
  }
  saveFondi(); closeNavModal(); renderFnPanel();
}

function populateFondoSelect(selId, selVal) {
  var sel  = document.getElementById(selId);
  var html = '<option value="">-- seleziona fondo --</option>';
  for (var i = 0; i < fondi.length; i++) {
    html += '<option value="' + fondi[i].id + '"' + (fondi[i].id === selVal ? ' selected' : '') + '>' + fondi[i].nome + '</option>';
  }
  sel.innerHTML = html;
}

// ---------- Render ----------
function renderFnPanel() {
  buildFondiFIFO();
  var pf = getFondiPortfolio();
  var totalMkt = 0, totalInv = 0, totalRel = 0, totalComm = 0;
  for (var i = 0; i < pf.length; i++) {
    if (pf[i].qty > 0) { totalMkt += pf[i].qty * pf[i].navCorr; totalInv += pf[i].cost; }
    totalRel  += pf[i].realized;
    totalComm += pf[i].comm;
  }
  var unr = totalMkt - totalInv, unrPct = totalInv > 0 ? (unr / totalInv) * 100 : 0;
  var openCount = pf.filter(function(p){ return p.qty > 0; }).length;

  document.getElementById('fn-kpi-mkt').textContent   = fe(totalMkt);
  document.getElementById('fn-kpi-mkt').className     = 'kpi-v ' + cc(totalMkt);
  document.getElementById('fn-kpi-mkt-s').textContent = openCount + ' fondi in portafoglio';
  document.getElementById('fn-kpi-inv').textContent   = fe(totalInv);
  var fu = document.getElementById('fn-kpi-unr'); fu.textContent = fe(unr); fu.className = 'kpi-v ' + cc(unr);
  document.getElementById('fn-kpi-unr-s').textContent = fp(unrPct);
  var fr = document.getElementById('fn-kpi-rel'); fr.textContent = fe(totalRel); fr.className = 'kpi-v ' + cc(totalRel);
  document.getElementById('fn-kpi-comm').textContent  = fe(totalComm);

  // Elenco fondi registrati
  var ltb = document.getElementById('fn-list-tbody');
  var catLabel = { azionario:'Azionario', obbligazionario:'Obbligaz.', bilanciato:'Bilanciato', monetario:'Monetario', flessibile:'Flessibile', altro:'Altro' };
  document.getElementById('fn-list-count').textContent = fondi.length + (fondi.length === 1 ? ' fondo' : ' fondi');
  if (fondi.length === 0) {
    ltb.innerHTML = '<tr><td colspan="6" class="empty">Nessun fondo registrato · clicca "+ Nuovo fondo" per aggiungerne uno</td></tr>';
  } else {
    var lrows = '';
    for (var i = 0; i < fondi.length; i++) {
      var fd = fondi[i];
      lrows += '<tr>';
      lrows += '<td style="font-weight:600;font-size:11px">' + fd.nome + '</td>';
      lrows += '<td><span style="font-family:var(--mono);font-size:9px;color:var(--dim);letter-spacing:.04em">' + fd.isin + '</span></td>';
      lrows += '<td style="font-size:10px;color:var(--dim)">' + (fd.societa || '—') + '</td>';
      lrows += '<td><span class="tag" style="background:var(--bld);color:var(--bl)">' + (catLabel[fd.cat] || fd.cat || '—') + '</span></td>';
      lrows += '<td style="font-size:10px;color:var(--dim)">' + (fd.valuta || 'EUR') + '</td>';
      lrows += '<td style="white-space:nowrap">';
      lrows += '<button class="btn btn-n btn-sm" style="padding:2px 7px;margin-right:3px" onclick="openFondoModal(' + fd.id + ')">✎</button>';
      lrows += '<button class="btn btn-n btn-sm" style="color:var(--r);padding:2px 7px" onclick="delFondo(' + fd.id + ')">🗑</button>';
      lrows += '</td></tr>';
    }
    ltb.innerHTML = lrows;
  }

  // Posizioni aperte
  var ptb = document.getElementById('fn-pos-tbody');
  var openPos = pf.filter(function(p){ return p.qty > 0.00001; });
  if (openPos.length === 0) {
    ptb.innerHTML = '<tr><td colspan="11" class="empty">Nessuna posizione aperta · aggiungi un fondo e registra una sottoscrizione</td></tr>';
  } else {
    var rows = '';
    var catLabel = { azionario:'Azionario', obbligazionario:'Obbligaz.', bilanciato:'Bilanciato', monetario:'Monetario', flessibile:'Flessibile', altro:'Altro' };
    for (var i = 0; i < openPos.length; i++) {
      var p = openPos[i];
      var mv  = p.qty * p.navCorr;
      var pl  = mv - p.cost;
      var plp = p.cost > 0 ? (pl / p.cost) * 100 : 0;
      var navStr = fnNavs[p.fondo.id]
        ? '<strong>' + fe4(p.navCorr) + '</strong><div style="font-size:9px;color:var(--g)">● ' + (p.navDate ? fmtDate(p.navDate) : 'aggiornato') + '</div>'
        : '<span class="dmc">' + fe4(p.navCorr) + '</span><div style="font-size:9px;color:var(--muted)">= nav medio</div>';
      var cagrR = cagrFondo(p.fondo.id, p.cost, mv);
      rows += '<tr>';
      rows += '<td><div style="font-weight:700;color:var(--tx);font-size:11px">' + p.fondo.nome + '</div>';
      if (p.fondo.societa) rows += '<div style="font-size:9px;color:var(--dim)">' + p.fondo.societa + '</div>';
      rows += '<div style="display:flex;gap:5px;margin-top:3px"><button class="btn btn-n btn-sm" style="padding:1px 6px;font-size:8px" onclick="openFondoModal(' + p.fondo.id + ')">✎</button><button class="btn btn-n btn-sm" style="padding:1px 6px;font-size:8px;color:var(--r)" onclick="delFondo(' + p.fondo.id + ')">✕</button></div></td>';
      rows += '<td><span style="font-family:var(--mono);font-size:9px;color:var(--dim);letter-spacing:.04em">' + p.fondo.isin + '</span></td>';
      rows += '<td><span class="tag" style="background:var(--bld);color:var(--bl)">' + (catLabel[p.fondo.cat] || p.fondo.cat) + '</span></td>';
      rows += '<td>' + f(p.qty, 3) + '</td>';
      rows += '<td class="dmc">' + fe4(p.navMedio) + '</td>';
      rows += '<td>' + navStr + '</td>';
      rows += '<td>' + fe(mv) + '</td>';
      rows += '<td><span class="' + cc(pl) + '">' + fe(pl) + '</span></td>';
      rows += '<td><span class="' + cc(plp) + '">' + fp(plp) + '</span></td>';
      rows += '<td>' + fmtCAGR(cagrR ? cagrR.cagr : null, cagrR ? cagrR.years : null) + '</td>';
      rows += '<td class="dmc">' + fe(p.comm) + '</td>';
      rows += '</tr>';
    }
    ptb.innerHTML = rows;
  }

  // Log movimenti
  var ltb    = document.getElementById('fn-log-tbody');
  var sorted = fnMovs.slice().sort(function(a,b){ return b.data < a.data ? -1 : 1; });
  document.getElementById('fn-log-count').textContent = sorted.length + ' movimenti';
  if (sorted.length === 0) { ltb.innerHTML = '<tr><td colspan="8" class="empty">Nessun movimento</td></tr>'; }
  else {
    var lrows = '';
    for (var i = 0; i < sorted.length; i++) {
      var m  = sorted[i];
      var fd = fondi.find(function(x){ return x.id === m.fondoId; });
      var fdName = fd ? fd.nome : '—';
      var isSub  = m.tipo === 'sub';
      var plHtml = (!isSub && m._pl !== undefined) ? '<span class="' + cc(m._pl) + '">' + fe(m._pl) + '</span>' : '<span class="dmc">—</span>';
      lrows += '<tr>';
      lrows += '<td class="dmc">' + fmtDate(m.data) + '</td>';
      lrows += '<td><span class="tag ' + (isSub ? 'buy' : 'sell') + '">' + (isSub ? '▲ SUB' : '▼ RIM') + '</span></td>';
      lrows += '<td style="max-width:200px;white-space:normal;font-size:10px">' + fdName + '</td>';
      lrows += '<td>' + f(m.quote, 3) + '</td><td>' + fe4(m.nav) + '</td><td>' + fe(m.quote * m.nav) + '</td>';
      var noteHtml = m.note ? '<span title="' + m.note.replace(/"/g,'&quot;') + '" style="cursor:default;color:var(--au);font-size:11px">💬</span>' : '';
      lrows += '<td class="dmc">' + fe(m.comm) + '</td><td>' + plHtml + ' ' + noteHtml + '</td>';
      lrows += '<td style="white-space:nowrap"><button class="btn btn-n btn-sm" style="padding:2px 7px;margin-right:3px" onclick="editSub(' + m.id + ')">✎</button><button class="btn btn-n btn-sm" style="color:var(--r);padding:2px 7px" onclick="delSub(' + m.id + ')">🗑</button></td>';
      lrows += '</tr>';
    }
    ltb.innerHTML = lrows;
  }
}

function exportFondiCSV() {
  buildFondiFIFO();
  var lines  = ['Data;Tipo;Fondo;ISIN;Quote;NAV;Controvalore;Commissioni;PL'];
  var sorted = fnMovs.slice().sort(function(a,b){ return b.data < a.data ? -1 : 1; });
  for (var i = 0; i < sorted.length; i++) {
    var m  = sorted[i];
    var fd = fondi.find(function(x){ return x.id === m.fondoId; });
    lines.push([m.data, m.tipo.toUpperCase(), fd ? fd.nome : '', fd ? fd.isin : '', m.quote, m.nav, m.quote * m.nav, m.comm, (m._pl !== undefined ? m._pl.toFixed(2) : '')].join(';'));
  }
  var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'fondi_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
}
