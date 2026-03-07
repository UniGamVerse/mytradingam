// ============================================================
//  FORMAT — funzioni di formattazione numeri/valute
// ============================================================
function f(n, d) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  d = (d === undefined) ? 2 : d;
  return n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fe(n) { return '€\u00a0' + f(n); }
function fp(n) { return f(n) + '%'; }
function cc(n) { return n > 0.001 ? 'pos' : n < -0.001 ? 'neg' : 'dmc'; }
