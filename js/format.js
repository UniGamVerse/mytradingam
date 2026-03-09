// ============================================================
//  FORMAT — funzioni di formattazione numeri/valute
// ============================================================
function f(n, d) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  d = (d === undefined) ? 2 : d;
  var fixed = Math.abs(n).toFixed(d);
  var parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var result = parts[0] + (d > 0 ? ',' + parts[1] : '');
  return (n < 0 ? '-' : '') + result;
}
function fe(n)  { return '€\u00a0' + f(n); }
function fe4(n) { return '€\u00a0' + f(n, 4); }  // prezzi unitari (azioni, NAV fondi)
function fp(n) { return f(n) + '%'; }
function cc(n) { return n > 0.001 ? 'pos' : n < -0.001 ? 'neg' : 'dmc'; }
function fmtDate(d) {
  if (!d) return '—';
  var p = d.split('-');
  if (p.length !== 3) return d;
  return p[2] + '-' + p[1] + '-' + p[0];
}
