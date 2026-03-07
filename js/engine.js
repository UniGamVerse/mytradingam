// ============================================================
//  ENGINE — FIFO, CAGR, portafoglio azioni
// ============================================================

// ---------- FIFO AZIONI ----------
function buildFIFO() {
  var state = {};
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    var t = op.ticker;
    if (!state[t]) state[t] = { lots: [], realized: 0, comm: 0 };
    state[t].comm += (op.comm || 0);
    if (op.type === 'split') continue; // già applicato alle op storiche
    if (op.type === 'buy') {
      state[t].lots.push({ qty: op.qty, price: op.price });
    } else {
      var rem = op.qty, cost = 0, lots = state[t].lots;
      while (rem > 0 && lots.length > 0) {
        var lot = lots[0];
        var take = Math.min(lot.qty, rem);
        cost += take * lot.price;
        lot.qty -= take; rem -= take;
        if (lot.qty < 0.00001) lots.shift();
      }
      var proceeds = op.qty * op.price - (op.comm || 0);
      var pl = proceeds - cost;
      state[t].realized += pl;
      op._pl   = pl;
      op._pmc  = op.qty > 0 ? cost / op.qty : 0;
      op._cost = cost;
    }
  }
  return state;
}

function getPortfolio() {
  var fifo = buildFIFO();
  var res = [], tickers = Object.keys(fifo);
  for (var i = 0; i < tickers.length; i++) {
    var t = tickers[i], d = fifo[t];
    var qty = 0, cost = 0;
    for (var j = 0; j < d.lots.length; j++) { qty += d.lots[j].qty; cost += d.lots[j].qty * d.lots[j].price; }
    if (qty < 0.00001) continue;
    res.push({ ticker: t, qty: qty, pmc: qty > 0 ? cost / qty : 0, cost: cost, realized: d.realized, comm: d.comm });
  }
  return res;
}

function totals() {
  var pf = getPortfolio(), fifo = buildFIFO();
  var mkt = 0, inv = 0, rel = 0, comm = 0;
  for (var i = 0; i < pf.length; i++) { var cp = curPrices[pf[i].ticker] || pf[i].pmc; mkt += pf[i].qty * cp; inv += pf[i].cost; }
  var tks = Object.keys(fifo);
  for (var j = 0; j < tks.length; j++) { rel += fifo[tks[j]].realized; comm += fifo[tks[j]].comm; }
  return { mkt: mkt, inv: inv, unr: mkt - inv, rel: rel, comm: comm, pf: pf };
}

function grandTotals() {
  var az = totals();
  var fnPf = getFondiPortfolio();
  var fnMkt = 0, fnInv = 0, fnRel = 0, fnComm = 0;
  for (var i = 0; i < fnPf.length; i++) {
    if (fnPf[i].qty > 0) { fnMkt += fnPf[i].qty * fnPf[i].navCorr; fnInv += fnPf[i].cost; }
    fnRel  += fnPf[i].realized;
    fnComm += fnPf[i].comm;
  }
  return {
    az: az, fnMkt: fnMkt, fnInv: fnInv, fnRel: fnRel, fnComm: fnComm,
    fnUnr:  fnMkt - fnInv,
    totMkt: az.mkt + fnMkt,
    totInv: az.inv + fnInv,
    totUnr: (az.mkt - az.inv) + (fnMkt - fnInv),
    totRel: az.rel + fnRel,
    totComm: az.comm + fnComm
  };
}

// ---------- SPLIT / RAGGRUPPAMENTO ----------
function applySplit(ticker, ratio, date) {
  // Guardia anti-doppio-split: verifica se esiste già uno split identico
  for (var j = 0; j < ops.length; j++) {
    var s = ops[j];
    if (s.type === 'split' && s.ticker === ticker && s.date === date && s.qty === ratio) {
      return -1; // segnala duplicato al chiamante
    }
  }
  var count = 0;
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (op.ticker !== ticker) continue;
    if (op.type === 'split') continue;
    if (op.date > date) continue;
    op.qty   = Math.round(op.qty   * ratio      * 1000000) / 1000000;
    op.price = Math.round(op.price / ratio       * 1000000) / 1000000;
    count++;
  }
  return count;
}

// ---------- CAGR ----------
function calcCAGR(cost, value, years) {
  if (cost <= 0 || value <= 0 || years < 0.01) return null;
  return (Math.pow(value / cost, 1 / years) - 1) * 100;
}

function yearsFromDate(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split('-');
  if (parts.length < 3) return null;
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return (new Date() - d) / (1000 * 60 * 60 * 24 * 365.25);
}

function cagrForPosition(ticker, cost, value) {
  var buys = ops.filter(function(o) { return o.type === 'buy' && o.ticker === ticker; });
  if (buys.length === 0 || cost <= 0 || value <= 0) return null;
  var totalCost = 0, weightedMs = 0;
  for (var i = 0; i < buys.length; i++) {
    var b = buys[i], lotCost = b.qty * b.price, yrs = yearsFromDate(b.date);
    if (yrs === null) continue;
    weightedMs += lotCost * yrs;
    totalCost  += lotCost;
  }
  if (totalCost <= 0) return null;
  var avgYears = weightedMs / totalCost;
  return { cagr: calcCAGR(cost, value, avgYears), years: avgYears };
}

function cagrPortfolio(pf) {
  if (pf.length === 0) return null;
  var totalInv = 0, totalMkt = 0, weightedYrs = 0;
  for (var i = 0; i < pf.length; i++) {
    var p = pf[i], cp = curPrices[p.ticker] || p.pmc, mv = p.qty * cp;
    var res = cagrForPosition(p.ticker, p.cost, mv);
    if (!res) continue;
    weightedYrs += p.cost * res.years;
    totalInv    += p.cost;
    totalMkt    += mv;
  }
  if (totalInv <= 0 || totalMkt <= 0) return null;
  return { cagr: calcCAGR(totalInv, totalMkt, weightedYrs / totalInv), years: weightedYrs / totalInv };
}

function fmtCAGR(val, years) {
  if (val === null || val === undefined || isNaN(val)) return '<span class="dmc">—</span>';
  var cls  = val > 0.05 ? 'cagr-pos' : val < -0.05 ? 'cagr-neg' : 'cagr-neu';
  var sign = val >= 0 ? '+' : '';
  var yStr = years ? ' · ' + f(years, 1) + ' anni' : '';
  return '<div><span class="cagr-chip ' + cls + '">' + sign + f(val, 2) + '%/a</span></div><div class="cagr-sub">' + yStr + '</div>';
}
