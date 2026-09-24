// verificare.js — scaneaza produsele expuse, compara cu stocul, arata ce lipseste de pe rafturi (probabil in depozit).

let products = [];
let stockMap = {};
let scannedKeys = new Set();
let scannedList = [];

const manualSku = document.getElementById("manualSku");
const scanBtn = document.getElementById("scan-btn");
const scannerOverlay = document.getElementById("scanner-overlay");
const scanCloseBtn = document.getElementById("scan-close");
const scanStatus = document.getElementById("scanStatus");
const scannedListEl = document.getElementById("scannedList");
const statScanate = document.getElementById("statScanate");
const checkBtn = document.getElementById("checkBtn");
const resultsCard = document.getElementById("resultsCard");
const resultsBody = document.getElementById("resultsBody");
const resultsSummary = document.getElementById("resultsSummary");

let html5QrCode = null;
let scanCooldown = false;

async function loadProducts() {
  const res = await fetch("/data/products.json");
  products = await res.json();
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

function getStock(codSku) {
  const key = String(codSku || "").trim().toUpperCase();
  const q = stockMap[key];
  return q === undefined ? null : q;
}

function normalizeKeyPart(str) {
  return String(str || "").trim().toLowerCase();
}

function groupKey(p) {
  const denumire = p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || "";
  const culoare = p["CULOARE SCURT"] || p["CULOARE LUNG"] || "";
  return normalizeKeyPart(denumire) + "||" + normalizeKeyPart(culoare);
}

function groupLabel(p) {
  return [p["NUME BRAND"], p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"], p["CULOARE SCURT"] || p["CULOARE LUNG"]]
    .filter(Boolean).join(" · ");
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

function showScanStatus(msg, isError) {
  scanStatus.textContent = msg;
  scanStatus.classList.toggle("error", !!isError);
}

function renderScannedList() {
  statScanate.textContent = scannedList.length.toString();
  if (scannedList.length === 0) {
    scannedListEl.innerHTML = '<div class="empty-hint">Niciun produs scanat încă.</div>';
    checkBtn.disabled = true;
    return;
  }
  scannedListEl.innerHTML = scannedList
    .map((it) => `<div class="scanned-row">${escapeHtml(it.label)}</div>`)
    .join("");
  checkBtn.disabled = false;
}

function tryAddSku(sku) {
  const p = findProductBySku(sku);
  if (!p) {
    showScanStatus(`Cod necunoscut: "${sku}"`, true);
    return;
  }
  const key = groupKey(p);
  if (!scannedKeys.has(key)) {
    scannedKeys.add(key);
    scannedList.push({ key, label: groupLabel(p) });
    renderScannedList();
  }
  showScanStatus(`✓ Scanat: ${p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || sku}`, false);
}

manualSku.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
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

function computeMissing() {
  const groups = new Map();
  products.forEach((p) => {
    const q = getStock(p["COD SKU"]);
    if (!q || q <= 0) return;
    const key = groupKey(p);
    if (!groups.has(key)) {
      groups.set(key, { key, label: groupLabel(p), totalStock: 0 });
    }
    groups.get(key).totalStock += q;
  });
  const missing = [];
  groups.forEach((val) => {
    if (!scannedKeys.has(val.key)) missing.push(val);
  });
  missing.sort((a, b) => a.label.localeCompare(b.label));
  return missing;
}

checkBtn.addEventListener("click", () => {
  const missing = computeMissing();
  resultsCard.style.display = "block";
  if (missing.length === 0) {
    resultsSummary.textContent = "Toate modelele cu stoc au fost găsite pe rafturi. 🎉";
    resultsBody.innerHTML = "";
    return;
  }
  resultsSummary.textContent = `${missing.length} modele/culori cu stoc NU au fost scanate — probabil în depozit:`;
  resultsBody.innerHTML = missing
    .map((m) => `<div class="missing-row"><span class="missing-label">${escapeHtml(m.label)}</span><span class="missing-qty">${m.totalStock} buc</span></div>`)
    .join("");
});

async function init() {
  await Promise.all([loadProducts(), loadStock()]);
}
init();
