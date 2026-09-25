// verificare.js — scaneaza produsele expuse, compara cu stocul, arata ce lipseste de pe rafturi (probabil in depozit).

let products = [];
let stockMap = {};
let scannedKeys = new Set();
let scannedList = [];
let selectedBrand = "";

const brandSelect = document.getElementById("brandSelect");
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
  populateBrandSelect();
}

function populateBrandSelect() {
  const brands = Array.from(
    new Set(products.map((p) => (p["NUME BRAND"] || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  brandSelect.innerHTML =
    '<option value="">— alege brand —</option>' +
    brands.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
}

brandSelect.addEventListener("change", () => {
  selectedBrand = brandSelect.value;
  scannedKeys = new Set();
  scannedList = [];
  renderScannedList();
  resultsCard.style.display = "none";
  resultsBody.innerHTML = "";
  showScanStatus("", false);
});

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

function groupBrand(p) {
  return (p["NUME BRAND"] || "").trim() || "Fără brand";
}

function groupItemLabel(p) {
  return [p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"], p["CULOARE SCURT"] || p["CULOARE LUNG"]]
    .filter(Boolean).join(" · ");
}

function groupKey(p) {
  return normalizeKeyPart(groupBrand(p)) + "||" + normalizeKeyPart(groupItemLabel(p));
}

function groupLabel(p) {
  return groupBrand(p) + " · " + groupItemLabel(p);
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
  if (!selectedBrand) {
    showScanStatus("Alege întâi un brand mai sus.", true);
    return;
  }
  const p = findProductBySku(sku);
  if (!p) {
    showScanStatus(`Cod necunoscut: "${sku}"`, true);
    return;
  }
  if (normalizeKeyPart(groupBrand(p)) !== normalizeKeyPart(selectedBrand)) {
    showScanStatus(`"${p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || sku}" nu e din brandul ${selectedBrand} — ignorat.`, true);
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
    if (normalizeKeyPart(groupBrand(p)) !== normalizeKeyPart(selectedBrand)) return;
    const q = getStock(p["COD SKU"]);
    if (!q || q <= 0) return;
    const key = groupKey(p);
    if (!groups.has(key)) {
      groups.set(key, { key, brand: groupBrand(p), itemLabel: groupItemLabel(p), totalStock: 0, skus: [] });
    }
    const g = groups.get(key);
    g.totalStock += q;
    g.skus.push({ sku: p["COD SKU"] || "", marime: p["MARIME"] || "", stock: q });
  });
  const missing = [];
  groups.forEach((val) => {
    if (!scannedKeys.has(val.key)) missing.push(val);
  });
  missing.forEach((m) => {
    m.skus.sort((a, b) => String(a.marime).localeCompare(String(b.marime)));
  });
  missing.sort((a, b) => a.itemLabel.localeCompare(b.itemLabel));
  return missing;
}

checkBtn.addEventListener("click", () => {
  if (!selectedBrand) {
    showScanStatus("Alege întâi un brand mai sus.", true);
    return;
  }
  const missing = computeMissing();
  resultsCard.style.display = "block";
  if (missing.length === 0) {
    resultsSummary.textContent = `Toate modelele din ${selectedBrand} cu stoc au fost găsite pe rafturi. 🎉`;
    resultsBody.innerHTML = "";
    return;
  }
  resultsSummary.textContent = `${missing.length} modele/culori din ${selectedBrand} cu stoc NU au fost scanate — probabil în depozit:`;

  resultsBody.innerHTML = missing
    .map((m) => {
      const codesText = m.skus
        .map((s) => `${escapeHtml(s.sku)}${s.marime ? " (" + escapeHtml(s.marime) + ")" : ""}: ${s.stock} buc`)
        .join(" · ");
      return `<div class="missing-item">
        <div class="missing-row"><span class="missing-label">${escapeHtml(m.itemLabel)}</span><span class="missing-qty">${m.totalStock} buc</span></div>
        <div class="missing-codes">${codesText}</div>
      </div>`;
    })
    .join("");
});

async function init() {
  await Promise.all([loadProducts(), loadStock()]);
}
init();
