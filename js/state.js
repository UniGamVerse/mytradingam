// ============================================================
//  STATE — variabili globali condivise tra tutti i moduli
// ============================================================
var ops       = [];
var prices    = {};
var curPrices = {};
var alerts    = {};
var alertLog  = [];

var fondi  = [];
var fnMovs = [];
var fnNavs = {};

var portfolioTitle   = '';
var patrimonyHistory = []; // [ { date: 'YYYY-MM-DD', val: number } ]

var isDark = true;
var isWarm = false;
try {
  var _t = localStorage.getItem('pd3_theme');
  if (_t === 'light') { isDark = false; isWarm = false; }
  else if (_t === 'warm') { isDark = false; isWarm = true; }
  else { isDark = true; isWarm = false; }
} catch(e) {}

var PALETTE = ['#00d4a0','#4d9fff','#f0b429','#ff4d6a','#a78bfa','#fb923c','#34d399','#f472b6','#60a5fa','#fbbf24'];
