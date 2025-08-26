const $ = (sel) => document.querySelector(sel);
let RATES = {};
let ATTRIB = "";
let BASE = "USD";

/* ===========================
   THEME: load, apply, toggle, persist
   =========================== */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("#themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "🌙 Dark" : "☀️ Light";
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  const next = cur === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("theme", next);
}

/* ===========================
   RATES + UI helpers
   =========================== */
function fillDatalist(id, codes) {
  const el = $(id);
  el.innerHTML = "";
  for (const c of codes) {
    el.insertAdjacentHTML("beforeend", `<option value="${c}"></option>`);
  }
}

function fillSelect(id, codes) {
  const el = $(id);
  el.innerHTML = "";
  for (const c of codes) {
    el.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`);
  }
}

async function fetchRates() {
  $("#attrib").textContent = "Fetching rates…";
  try {
    const res = await fetch("/api/rates");
    const data = await res.json();
    RATES = data.rates || {};
    ATTRIB = data.attribution || "";
    BASE = data.base || "USD";

    const codes = Object.keys(RATES).sort();
    fillDatalist("#fromCodes", codes);
    fillDatalist("#toCodes", codes);
    fillSelect("#fromSelect", codes);
    fillSelect("#toSelect", codes);

    // keep existing selections if they remain valid; otherwise pick defaults
    const fromEl = $("#from");
    const toEl = $("#to");
    const fromSel = $("#fromSelect");
    const toSel = $("#toSelect");
    const curFrom = normalizeCode(fromEl.value);
    const curTo = normalizeCode(toEl.value);

    if (!RATES[curFrom]) {
      fromEl.value = RATES["USD"] ? "USD" : codes[0];
    }
    if (!RATES[curTo]) {
      toEl.value = RATES["EUR"] ? "EUR" : (codes[1] || codes[0]);
    }

    fromSel.value = fromEl.value;
    toSel.value = toEl.value;
    $("#attrib").textContent = ATTRIB + (data.live ? "" : " (fallback rates in use)");
  } catch (e) {
    $("#attrib").textContent = "Failed to fetch rates.";
  }
}

function normalizeCode(s) {
  return (s || "").trim().toUpperCase();
}

function cleanAmount(s) {
  const raw = String(s ?? "").trim().replace(/,/g, "");
  const cleaned = [...raw].filter(ch => /[0-9.\-]/.test(ch)).join("");
  return cleaned;
}

async function convert() {
  const from = normalizeCode($("#from").value);
  const to   = normalizeCode($("#to").value);
  const amount = $("#amount").value;

  if (!RATES[from] || !RATES[to]) {
    $("#result").textContent = "Unsupported currency code.";
    $("#last").textContent = "";
    return;
  }
  if (!amount || !cleanAmount(amount)) {
    $("#result").textContent = "Please enter a valid amount.";
    $("#last").textContent = "";
    return;
  }

  const res = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, from, to })
  });

  const data = await res.json();
  if (!res.ok) {
    $("#result").textContent = data.error || "Conversion failed.";
    $("#last").textContent = "";
    return;
  }

  $("#result").textContent = `${data.formatted_from} → ${data.formatted_result}`;
  $("#last").textContent = `Converted using current rates.`;
}

function swap() {
  const fromEl = $("#from");
  const toEl = $("#to");
  const fromSel = $("#fromSelect");
  const toSel = $("#toSelect");
  const t = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value = t;
  fromSel.value = fromEl.value;
  toSel.value = toEl.value;
}

/* ===========================
   Boot
   =========================== */
window.addEventListener("DOMContentLoaded", () => {
  initTheme();              // apply saved or system theme immediately
  fetchRates();             // fetch rates and fill datalists
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#convert").addEventListener("click", convert);
  $("#swap").addEventListener("click", swap);
  $("#refresh").addEventListener("click", fetchRates);

  $("#fromSelect").addEventListener("change", () => {
    $("#from").value = $("#fromSelect").value;
  });
  $("#toSelect").addEventListener("change", () => {
    $("#to").value = $("#toSelect").value;
  });
  $("#from").addEventListener("input", () => {
    const code = normalizeCode($("#from").value);
    if (RATES[code]) $("#fromSelect").value = code;
  });
  $("#to").addEventListener("input", () => {
    const code = normalizeCode($("#to").value);
    if (RATES[code]) $("#toSelect").value = code;
  });

  // Enter key submits
  ["#from", "#to", "#amount"].forEach(sel => {
    $(sel).addEventListener("keydown", (e) => {
      if (e.key === "Enter") convert();
    });
  });
});




