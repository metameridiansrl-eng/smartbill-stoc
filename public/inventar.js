
// inventar.js — inventar fizic (numarare pe raft), pe brand sau pe tot magazinul,
// cu progres salvat local (in acest telefon/browser) si reluare automata.

let products = [];
let stockMap = {};
let mode = "brand"; // "brand" | "store"
let selectedBrand = "";
let counts = {}; // { COD_SKU: cantitate numarata }

const modeBrandBtn = document.getElementById("modeBrandBtn");
const modeStoreBtn = document.getElementById("modeStoreBtn");
const brandSelect = document.getElementById("brandSelect");
const resumeCard = document.getElementById("resumeCard");
const resumeText = document.getElementById("resumeText");
const resetBtn = document.getElementById("resetBtn");
const scanCard = document.getElementById("scanCard");
const manualSku = document.getElementById("manualSku");
const scanForm = document.getElementById("scanForm");
const scanBtn = document.getElementById("scan-btn");
const scannerOverlay = document.getElementById("scanner-overlay");
const scanCloseBtn = document.getElementById("scan-close");
const scanStatus = document.getElementById("scanStatus");
const countedCard = document.getElementById("countedCard");
const countedList = document.getElementById("countedList");
const statModele = document.getElementById("statModele");
const statBucati = document.getElementById("statBucati");
const finishBtn = document.getElementById("finishBtn");
const resultsCard = document.getElementById("resultsCard");
const resultsSummary = document.getElementById("resultsSummary");
const resultsBody = document.getElementById("resultsBody");

let html5QrCode = null;
let scanCooldown = false;

async function loadProducts() {
  const res = await fetch("/data/products.json");
  products = await res.json();
  populateBrandSelect();
}

async function loadStock() {
  try {
    const res = await fetch("/api/stock");
    const data = await res.json();
    if (data.stock) stockMap = data.stock;
  } catch (err) {
    console.error("Nu am putut încărca stocul:", err);
  }
}

function populateBrandSelect() {
  const brands = Array.from(
    new Set(products.map((p) => (p["NUME BRAND"] || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  brandSelect.innerHTML =
    '<option value="">— alege brand —</option>' +
    brands.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
}

function normalizeKeyPart(str) {
  return String(str || "").trim().toLowerCase();
}
function groupBrand(p) {
  return (p["NUME BRAND"] || "").trim() || "Fără brand";
}
function itemLabel(p) {
  return [p["NUME BRAND"], p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"], p["CULOARE SCURT"] || p["CULOARE LUNG"], p["MARIME"]]
    .filter(Boolean)
    .join(" · ");
}
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function findProductBySku(sku) {
  const key = String(sku || "").trim().toUpperCase();
  if (!key) return null;
  return products.find((p) => String(p["COD SKU"] || "").trim().toUpperCase() === key) || null;
}
function getStock(codSku) {
  const key = String(codSku || "").trim().toUpperCase();
  const q = stockMap[key];
  return q === undefined ? null : q;
}

function storageKey() {
  return mode === "store" ? "inv_progress_store" : "inv_progress_brand_" + normalizeKeyPart(selectedBrand);
}

function loadProgress() {
  let saved = null;
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) saved = JSON.parse(raw);
  } catch (err) {
    console.error("Progres corupt in localStorage:", err);
  }
  if (saved && saved.counts && Object.keys(saved.counts).length > 0) {
    counts = saved.counts;
    const qtyTotal = Object.values(counts).reduce((s, q) => s + q, 0);
    const modelsTotal = Object.keys(counts).length;
    const dt = new Date(saved.updatedAt);
    resumeText.innerHTML =
      `<strong>Inventar neterminat găsit</strong> — ${modelsTotal} modele, ${qtyTotal} bucăți numărate, ` +
      `ultima actualizare ${dt.toLocaleDateString("ro-RO")} ${dt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}. ` +
      `Continuă de unde ai rămas.`;
    resumeCard.style.display = "block";
  } else {
    counts = {};
    resumeCard.style.display = "none";
  }
  renderAll();
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ updatedAt: new Date().toISOString(), counts }));
  } catch (err) {
    console.error("Nu am putut salva progresul:", err);
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(storageKey());
  } catch (err) {}
  counts = {};
  resumeCard.style.display = "none";
  resultsCard.style.display = "none";
  renderAll();
}

resetBtn.addEventListener("click", () => {
  if (!confirm("Sigur ștergi progresul acestui inventar? Nu poate fi recuperat.")) return;
  clearProgress();
});

function setMode(newMode) {
  mode = newMode;
  modeBrandBtn.classList.toggle("active", mode === "brand");
  modeStoreBtn.classList.toggle("active", mode === "store");
  brandSelect.style.display = mode === "brand" ? "block" : "none";
  resultsCard.style.display = "none";

  if (mode === "store") {
    scanCard.style.display = "block";
    countedCard.style.display = "block";
    loadProgress();
  } else if (selectedBrand) {
    scanCard.style.display = "block";
    countedCard.style.display = "block";
    loadProgress();
  } else {
    scanCard.style.display = "none";
    countedCard.style.display = "none";
    resumeCard.style.display = "none";
  }
}

modeBrandBtn.addEventListener("click", () => setMode("brand"));
modeStoreBtn.addEventListener("click", () => setMode("store"));

brandSelect.addEventListener("change", () => {
  selectedBrand = brandSelect.value;
  resultsCard.style.display = "none";
  if (!selectedBrand) {
    scanCard.style.display = "none";
    countedCard.style.display = "none";
    resumeCard.style.display = "none";
    return;
  }
  scanCard.style.display = "block";
  countedCard.style.display = "block";
  loadProgress();
});

function showScanStatus(msg, isError) {
  scanStatus.textContent = msg;
  scanStatus.classList.toggle("error", !!isError);
}

function tryAddSku(sku) {
  const p = findProductBySku(sku);
  if (!p) {
    showScanStatus(`Cod necunoscut: "${sku}"`, true);
    return;
  }
  if (mode === "brand" && normalizeKeyPart(groupBrand(p)) !== normalizeKeyPart(selectedBrand)) {
    showScanStatus(`"${p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || sku}" nu e din brandul ${selectedBrand} — ignorat.`, true);
    return;
  }
  const key = String(p["COD SKU"] || "").trim().toUpperCase();
  counts[key] = (counts[key] || 0) + 1;
  saveProgress();
  renderAll();
  showScanStatus(`✓ ${itemLabel(p)} — ${counts[key]} buc`, false);
}

scanForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = manualSku.value.trim();
  if (!val) return;
  tryAddSku(val);
  manualSku.value = "";
});

async function startScan() {
  scannerOverlay.style.display = "flex";
  try {
    html5QrCode = new Html5Qrcode("reader");
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        if (scanCooldown) return;
        scanCooldown = true;
        tryAddSku(decodedText);
        setTimeout(() => { scanCooldown = false; }, 1200);
      },
      () => {}
    );
  } catch (err) {
    alert("Nu am putut porni camera. Verifică că ai dat acces la cameră pentru acest site.");
    console.error(err);
    scannerOverlay.style.display = "none";
  }
}

async function stopScan() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (err) {}
    html5QrCode = null;
  }
  scannerOverlay.style.display = "none";
}

scanBtn.addEventListener("click", startScan);
scanCloseBtn.addEventListener("click", stopScan);

function decrementSku(sku) {
  if (!counts[sku]) return;
  counts[sku] -= 1;
  if (counts[sku] <= 0) delete counts[sku];
  saveProgress();
  renderAll();
}

function renderCountedList() {
  const skus = Object.keys(counts);
  const totalQty = skus.reduce((s, k) => s + counts[k], 0);
  statModele.textContent = skus.length.toString();
  statBucati.textContent = totalQty.toString();
  if (skus.length === 0) {
    countedList.innerHTML = '<div class="empty-hint">Niciun produs numărat încă.</div>';
    return;
  }
  countedList.innerHTML = skus
    .map((sku) => {
      const p = findProductBySku(sku);
      const label = p ? itemLabel(p) : sku;
      return `<div class="counted-row">
        <span class="cr-label">${escapeHtml(label)}</span>
        <span class="cr-qty-group">
          <button class="cr-minus" type="button" data-sku="${escapeHtml(sku)}" aria-label="Scade">−</button>
          <span class="cr-qty">${counts[sku]}</span>
        </span>
      </div>`;
    })
    .join("");
  countedList.querySelectorAll(".cr-minus").forEach((btn) => {
    btn.addEventListener("click", () => decrementSku(btn.dataset.sku));
  });
}

function renderAll() {
  renderCountedList();
}

function computeComparison() {
  const relevant = products.filter(
    (p) => mode === "store" || normalizeKeyPart(groupBrand(p)) === normalizeKeyPart(selectedBrand)
  );
  const rows = [];
  const seen = new Set();
  relevant.forEach((p) => {
    const sku = String(p["COD SKU"] || "").trim().toUpperCase();
    if (!sku || seen.has(sku)) return;
    seen.add(sku);
    const stockQty = getStock(sku) || 0;
    const countedQty = counts[sku] || 0;
    if (stockQty === 0 && countedQty === 0) return;
    rows.push({ sku, label: itemLabel(p), stockQty, countedQty, diff: countedQty - stockQty });
  });
  rows.sort((a, b) => {
    if (a.diff !== 0 && b.diff === 0) return -1;
    if (a.diff === 0 && b.diff !== 0) return 1;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

finishBtn.addEventListener("click", () => {
  const rows = computeComparison();
  resultsCard.style.display = "block";
  const ok = rows.filter((r) => r.diff === 0).length;
  const lipsa = rows.filter((r) => r.diff < 0).length;
  const surplus = rows.filter((r) => r.diff > 0).length;
  resultsSummary.textContent = `${rows.length} SKU-uri verificate — ${ok} potrivite, ${lipsa} cu lipsă, ${surplus} cu surplus.`;
  resultsBody.innerHTML = rows
    .map((r) => {
      let tagHtml;
      if (r.diff === 0) tagHtml = `<span class="result-tag ok">OK</span>`;
      else if (r.diff < 0) tagHtml = `<span class="result-tag lipsa">−${Math.abs(r.diff)} lipsă</span>`;
      else tagHtml = `<span class="result-tag surplus">+${r.diff} surplus</span>`;
      return `<div class="result-row">
        <div class="rr-info">
          <div>${escapeHtml(r.label)}</div>
          <div class="rr-sub">${escapeHtml(r.sku)} — numărat ${r.countedQty} / sistem ${r.stockQty}</div>
        </div>
        ${tagHtml}
      </div>`;
    })
    .join("");
  resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

async function init() {
  await Promise.all([loadProducts(), loadStock()]);
  setMode("brand");
}
init();
