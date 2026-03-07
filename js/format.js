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
function fe(n) { return '€\u00a0' + f(n); }
function fp(n) { return f(n) + '%'; }
function cc(n) { return n > 0.001 ? 'pos' : n < -0.001 ? 'neg' : 'dmc'; }
