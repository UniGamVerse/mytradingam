// ============================================================
//  STATE — variabili globali condivise tra tutti i moduli
// ============================================================
var ops       = [];
var prices    = {};
var curPrices = {};
var alerts    = {};
var alertLog  = [];

var fondi  = [];   // [ { id, nome, isin, societa, cat, valuta } ]
var fnMovs = [];   // [ { id, fondoId, tipo:'sub'|'rim', data, quote, nav, comm, _pl? } ]
var fnNavs = {};   // { fondoId: navCorrente }

var portfolioTitle = '';

var isDark = true;
try { isDark = localStorage.getItem('pd3_theme') !== 'light'; } catch(e) {}

var PALETTE = ['#00d4a0','#4d9fff','#f0b429','#ff4d6a','#a78bfa','#fb923c','#34d399','#f472b6','#60a5fa','#fbbf24'];
