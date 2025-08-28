/* =========================================================
   Currency Combobox + Flags (complete, full list + "show all" button)
   - Matches your HTML:
     #fromInput, #fromList, #fromFlag
     #toInput,   #toList,   #toFlag
   - Inputs start empty
   - Dropdown shows ALL currencies (scrollable), mouse + keyboard
   - Flags appear INSIDE the inputs (CSS handles padding/position)
   - "Show all" button inside the input reveals full list even if typed
   - Convert/Swap/Refresh + Theme toggle preserved
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
let CODES = [];
let RATES = {};

/* ---------------------------
   Currency -> Country/Region
--------------------------- */
const CURR_TO_CC = {
  AED:'AE', AFN:'AF', ALL:'AL', AMD:'AM', ANG:'CW', AOA:'AO', ARS:'AR', AUD:'AU', AWG:'AW', AZN:'AZ',
  BAM:'BA', BBD:'BB', BDT:'BD', BGN:'BG', BHD:'BH', BIF:'BI', BMD:'BM', BND:'BN', BOB:'BO', BRL:'BR',
  BSD:'BS', BTN:'BT', BWP:'BW', BYN:'BY', BZD:'BZ',
  CAD:'CA', CDF:'CD', CHF:'CH', CLP:'CL', CNY:'CN', COP:'CO', CRC:'CR', CUP:'CU', CVE:'CV', CZK:'CZ',
  DJF:'DJ', DKK:'DK', DOP:'DO', DZD:'DZ',
  EGP:'EG', ERN:'ER', ETB:'ET', EUR:'EU',
  FJD:'FJ', FKP:'FK',
  GBP:'GB', GEL:'GE', GGP:'GG', GHS:'GH', GIP:'GI', GMD:'GM', GNF:'GN', GTQ:'GT', GYD:'GY',
  HKD:'HK', HNL:'HN', HRK:'HR', HTG:'HT', HUF:'HU',
  IDR:'ID', ILS:'IL', IMP:'IM', INR:'IN', IQD:'IQ', IRR:'IR', ISK:'IS',
  JEP:'JE', JMD:'JM', JOD:'JO', JPY:'JP',
  KES:'KE', KGS:'KG', KHR:'KH', KID:'KI', KMF:'KM', KRW:'KR', KWD:'KW', KYD:'KY', KZT:'KZ',
  LAK:'LA', LBP:'LB', LKR:'LK', LRD:'LR', LSL:'LS', LYD:'LY',
  MAD:'MA', MDL:'MD', MGA:'MG', MKD:'MK', MMK:'MM', MNT:'MN', MOP:'MO', MRU:'MR', MUR:'MU',
  MVR:'MV', MWK:'MW', MXN:'MX', MYR:'MY', MZN:'MZ',
  NAD:'NA', NGN:'NG', NIO:'NI', NOK:'NO', NPR:'NP', NZD:'NZ',
  OMR:'OM',
  PAB:'PA', PEN:'PE', PGK:'PG', PHP:'PH', PKR:'PK', PLN:'PL', PYG:'PY',
  QAR:'QA',
  RON:'RO', RSD:'RS', RUB:'RU', RWF:'RW',
  SAR:'SA', SBD:'SB', SCR:'SC', SDG:'SD', SEK:'SE', SGD:'SG', SHP:'SH', SLE:'SL', SLL:'SL', SOS:'SO',
  SRD:'SR', SSP:'SS', STN:'ST', SYP:'SY', SZL:'SZ',
  THB:'TH', TJS:'TJ', TMT:'TM', TND:'TN', TOP:'TO', TRY:'TR', TTD:'TT', TVD:'TV', TWD:'TW', TZS:'TZ',
  UAH:'UA', UGX:'UG', USD:'US', UYU:'UY', UZS:'UZ',
  VES:'VE', VND:'VN', VUV:'VU',
  WST:'WS',
  XAF:'CM', XCD:'AG', XOF:'SN', XPF:'PF', XDR:'EU',
  YER:'YE',
  ZAR:'ZA', ZMW:'ZM', ZWL:'ZW'
};

// Metals / specials → icons (not flags)
const SPECIAL_ICON_BY_CUR = { XAU:'🪙', XAG:'🪙', XPT:'🪙', XPD:'🪙', XDR:'🌐' };

function ccToFlag(cc){
  if (!cc) return '🌐';
  if (cc === 'EU') return '🇪🇺';
  return cc.replace(/./g, c => String.fromCodePoint(127397 + c.toUpperCase().charCodeAt(0)));
}
function inferCountryCCFromCurrency(code){
  if (!code) return null;
  if (code.startsWith('X')) return null; // specials/metals -> icon
  let cc = code.slice(0,2);
  if (cc === 'UK') cc = 'GB';
  return cc;
}
function curToFlag(code){
  const c = (code || '').toUpperCase();
  if (SPECIAL_ICON_BY_CUR[c]) return SPECIAL_ICON_BY_CUR[c];
  const cc = CURR_TO_CC[c] || inferCountryCCFromCurrency(c);
  return ccToFlag(cc);
}

function pulse(el){
  if (!el) return;
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

function closeAllLists(){
  document.getElementById('fromList')?.classList.remove('open');
  document.getElementById('toList')?.classList.remove('open');
}

// --- iOS detection + list positioning (so dropdown sits above the keyboard)
const isIOS = (() => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
})();

function positionListForViewport(input, list) {
  const rect = input.getBoundingClientRect();
  const vv = window.visualViewport;
  const safeBottom = parseInt(getComputedStyle(document.documentElement)
                      .getPropertyValue('--safe-bottom') || '0', 10) || 0;

  if (isIOS && vv) {
    // rect.* is visual-viewport; fixed is layout-viewport → add vv offsets
    const left = Math.round(rect.left + (vv.offsetLeft || 0));
    const top  = Math.round(rect.bottom + (vv.offsetTop || 0) + 6);

    list.style.position = 'fixed';
    list.style.left = left + 'px';
    list.style.top  = top  + 'px';
    list.style.minWidth = rect.width + 'px';

    // height available below the input within the visible viewport (minus safe area)
    const avail = Math.round(vv.height - (rect.bottom + 6) - 8 - safeBottom);
    list.style.maxHeight = Math.max(160, avail) + 'px';
    list.classList.add('ios-fixed');
  } else {
    // revert to normal (CSS handles absolute positioning)
    list.style.position = '';
    list.style.left = '';
    list.style.top = '';
    list.style.minWidth = '';
    list.style.maxHeight = '';
    list.classList.remove('ios-fixed');
  }
}


// Make a fixed dropdown list reliably scroll on iOS (iOS 17/18)
function enableIOSInnerScroll(el){
  if (el._iosScrollEnabled) return;
  el._iosScrollEnabled = true;

  el.style.overflowY = 'auto';
  el.style.webkitOverflowScrolling = 'touch';  // momentum scroll

  let startY = 0;

  el.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length) startY = e.touches[0].clientY;

    // 1px nudge so we’re never exactly on an edge (prevents scroll handoff)
    if (el.scrollTop <= 0) el.scrollTop = 1;
    const max = el.scrollHeight - el.clientHeight;
    if (el.scrollTop >= max) el.scrollTop = max - 1;
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!e.touches || !e.touches.length) return;
    const y = e.touches[0].clientY;
    const deltaY = y - startY;

    const atTop = el.scrollTop <= 0;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;

    // If user tries to overscroll beyond the list’s bounds, keep the gesture here
    if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
      e.preventDefault(); // requires passive:false
    }
  }, { passive: false });
}



async function fetchJSONWithTimeout(url, { timeout = 6000, ...opts } = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const data = await res.json();
    return { ok: res.ok, data };
  } finally {
    clearTimeout(id);
  }
}

/* ---------------------------
   Build full code list (ALL)
--------------------------- */
function buildAllCodes() {
  const set = new Set([
    ...Object.keys(RATES || {}),
    ...Object.keys(CURR_TO_CC),
    ...Object.keys(SPECIAL_ICON_BY_CUR)
  ]);
  return Array.from(set).sort();
}

/* ---------------------------
   Rates / Codes loading
--------------------------- */
async function loadCodesAndAttribution() {
  const sourceEl = $('#source') || $('#attrib');
  const creditEl = $('#credit');
  let info = { live: false, count: 0, fallback: false };

  try {
    const { ok, data } = await fetchJSONWithTimeout('/api/rates', { timeout: 6000 });
    if (!ok) throw new Error('bad status');
    RATES = data.rates || {};
    CODES = buildAllCodes();       // union list so dropdown always full
    info.live = !!data.live;
    info.count = CODES.length;
    info.fallback = !data.live;
    if (sourceEl) sourceEl.textContent =
      (data.attribution || 'Rates') + (data.live ? ' · Live' : ' · Fallback');
  } catch (e) {
    // TIMEOUT / 5xx / JSON error → keep app usable with local list
    RATES = {};
    CODES = buildAllCodes();
    info.live = false;
    info.count = CODES.length;
    info.fallback = true;
    if (sourceEl) sourceEl.textContent = 'Rates timeout/unavailable · Fallback';
  }

  if (creditEl) creditEl.textContent = '© Ziyad — All rights reserved';
  return info;
}

/* ---------------------------
   Combobox wiring (your exact IDs)
--------------------------- */
function wireCombo({ input, list, flag }) {
  const combo = input.closest('.combo');
  if (combo) combo.style.position = 'relative';

  // Start empty + inside flag
  input.value = '';
  updateFlag();

  // Inject a tiny in-input "show all" button (▾)
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'combo-toggle';
  toggleBtn.setAttribute('aria-label', 'Show all currencies');
  toggleBtn.textContent = '▾';
  combo.appendChild(toggleBtn);
  input.classList.add('with-toggle'); // adds left padding so text doesn’t overlap

  let active = -1;

  function updateFlag() {
    const code = (input.value || '').trim().toUpperCase();
    flag.textContent = curToFlag(code);
  }

  function open()  {
  positionListForViewport(input, list);     // align above keyboard on iOS
  enableIOSInnerScroll(list);               // ← make the list scrollable on iOS
  list.classList.add('open');
}

  function close() {
    list.classList.remove('open');
    active = -1;
  }

  function highlight(index) {
    const options = [...list.querySelectorAll('.combo-item')];
    options.forEach((el, i) => el.setAttribute('aria-selected', i === index ? 'true' : 'false'));
  }

  function render(items, mode) {
    list.innerHTML = '';
    items.forEach((code) => {
      const row = document.createElement('div');
      row.className = 'combo-item';
      row.setAttribute('role', 'option');
      row.dataset.value = code;
      row.innerHTML = `<span class="flag">${curToFlag(code)}</span><span>${code}</span>`;
      row.addEventListener('pointerdown', () => {
        input.value = code;
        updateFlag();
        close();
      });
      list.appendChild(row);
    });
    list.dataset.mode = mode || 'filter'; // 'filter' or 'all'
    if (items.length) {
      active = 0;
      highlight(active);
      open();
    } else {
      close();
    }
  }

  function filter() {
    const q = (input.value || '').trim().toUpperCase();
    const items = q ? CODES.filter(c => c.includes(q)) : CODES;
    render(items, q ? 'filter' : 'all');
  }

  // "Show all" button
  toggleBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // avoid blurring input
    if (list.classList.contains('open') && list.dataset.mode === 'all') {
      close();
    } else {
      render(CODES, 'all'); // show the FULL list regardless of current text
      input.focus();
    }
  });

  // Events
  input.addEventListener('focus', () => { filter(); updateFlag(); });
  input.addEventListener('input', () => { filter(); updateFlag(); });

  input.addEventListener('keydown', (e) => {
    const options = [...list.querySelectorAll('.combo-item')];
    if (e.key === 'Escape') return close();
    if (!options.length) return;

    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % options.length; highlight(active); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + options.length) % options.length; highlight(active); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) options[active].dispatchEvent(new Event('pointerdown')); }
  });

  document.addEventListener('pointerdown', (e) => {
    if (e.target !== input && e.target !== toggleBtn && !list.contains(e.target)) close();
  });

  // --- iOS/Viewport: keep the list aligned while keyboard/viewport moves
  const vv = window.visualViewport;
  const realign = () => {
    if (list.classList.contains('open')) positionListForViewport(input, list);
  };
  if (vv) {
    vv.addEventListener('resize', realign);
    vv.addEventListener('scroll', realign);
  }
  window.addEventListener('resize', realign);

  // Allow scrolling inside the list on touch without closing it
  list.addEventListener('touchstart', (e)=>e.stopPropagation(), { passive: true });
  list.addEventListener('touchmove',  (e)=>e.stopPropagation(), { passive: true });
  list.addEventListener('wheel',      (e)=>e.stopPropagation(), { passive: true });
}

/* ---------------------------
   Convert / Swap / Refresh
--------------------------- */
async function doConvert() {
  const resultEl = $('#result');
  const lastEl   = $('#last');
  const amountEl = $('#amount');
  const fromEl   = $('#fromInput');
  const toEl     = $('#toInput');
  if (!resultEl || !amountEl || !fromEl || !toEl) return;

  resultEl.textContent = 'Converting…';
  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountEl.value, from: fromEl.value, to: toEl.value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');

    resultEl.textContent = `${data.formatted_from} → ${data.formatted_result}`;
    resultEl.classList.remove('pop'); void resultEl.offsetWidth; resultEl.classList.add('pop');

    if (lastEl) {
      lastEl.textContent = `Refreshed ${new Date().toLocaleTimeString()}`;
      pulse(lastEl); // pulse under the result
    }
  } catch (err) {
    resultEl.textContent = err.message;
    if (lastEl) lastEl.textContent = '';
  }
}

function doSwap() {
  const a = $('#fromInput'), b = $('#toInput');
  if (!a || !b) return;
  const t = a.value; a.value = b.value; b.value = t;
  $('#fromFlag').textContent = curToFlag(a.value.toUpperCase().trim());
  $('#toFlag').textContent   = curToFlag(b.value.toUpperCase().trim());
}

async function doRefresh() {
  const btn = $('#refresh');
  const lastEl = $('#last');

  btn?.classList.add('loading');
  btn?.setAttribute('aria-busy', 'true');

  const info = await loadCodesAndAttribution();

  btn?.classList.remove('loading');
  btn?.removeAttribute('aria-busy');

  if (lastEl) {
    lastEl.textContent = `Refreshed ${new Date().toLocaleTimeString()}${info.fallback ? ' · Fallback' : ''}`;
    pulse(lastEl);
  }

  if (document.activeElement === $('#fromInput')) $('#fromInput').dispatchEvent(new Event('input'));
  if (document.activeElement === $('#toInput'))   $('#toInput').dispatchEvent(new Event('input'));
}

/* ---------------------------
   Theme toggle (unchanged)
--------------------------- */
(function themeInit(){
  const tBtn = $('#themeToggle');
  if (!tBtn) return;
  function setLabel(){
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    tBtn.textContent = cur === 'dark' ? '🌙 Dark' : '☀️ Light';
  }
  setLabel();
  tBtn.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setLabel();
  });
})();

/* ---------------------------
   Boot
--------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
  if ($('#fromInput')) $('#fromInput').value = '';
  if ($('#toInput'))   $('#toInput').value   = '';
  if ($('#amount'))    $('#amount').value    = '';

  const amountEl = $('#amount');
  if (amountEl) amountEl.placeholder = 'Amount (e.g. 1234)';

  await loadCodesAndAttribution();

  const fromInput = $('#fromInput'), fromList = $('#fromList'), fromFlag = $('#fromFlag');
  const toInput   = $('#toInput'),   toList   = $('#toList'),   toFlag   = $('#toFlag');
  if (fromInput && fromList && fromFlag) wireCombo({ input: fromInput, list: fromList, flag: fromFlag });
  if (toInput   && toList   && toFlag)   wireCombo({ input: toInput,   list: toList,   flag: toFlag });

  $('#convert')?.addEventListener('click', doConvert);
  $('#swap')?.addEventListener('click', doSwap);
  $('#refresh')?.addEventListener('click', doRefresh);
  ['#fromInput','#toInput','#amount'].forEach(sel => {
    $(sel)?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') doConvert(); });
  });
});

