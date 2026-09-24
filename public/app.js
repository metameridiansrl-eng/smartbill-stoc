// app.js — ruleaza in browser. NU contine niciun secret.

const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const scanBtn = document.getElementById("scan-btn");
const scannerOverlay = document.getElementById("scanner-overlay");
const scanCloseBtn = document.getElementById("scan-close");

let products = [];
let stockMap = {};
let stockUpdatedAt = null;
let html5QrCode = null;

async function loadProducts() {
  const res = await fetch("/data/products.json");
  products = await res.json();
}

async function loadStock() {
  try {
    const res = await fetch("/api/stock");
    const data = await res.json();
    if (data.stock) {
      stockMap = data.stock;
      stockUpdatedAt = data.updatedAt;
    } else {
      console.error("Eroare stoc:", data);
    }
  } catch (err) {
    console.error("Nu am putut încărca stocul:", err);
  }
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getStock(codSku) {
  const key = String(codSku || "").trim().toUpperCase();
  return stockMap[key] ?? null;
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function buildRow(p, isMainMatch) {
  const qty = getStock(p["COD SKU"]);
  const qtyClass = qty === null ? "" : qty > 0 ? "ok" : "zero";
  const qtyLabel = qty === null ? "?" : qty;

  const meta = [p["CULOARE LUNG"], p["MARIME"], p["NUME BRAND"], p["FAMILIA"]]
    .filter(Boolean)
    .join(" · ");

  const row = document.createElement("div");
  row.className = "row" + (isMainMatch ? " row-main" : "");
  row.innerHTML = `
    <div class="main-info">
      <div class="name">${escapeHtml(p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || "—")}</div>
      <div class="meta">${escapeHtml(p["COD SKU"] || "")} ${meta ? "· " + escapeHtml(meta) : ""}</div>
      <button class="print-label-btn" type="button">🖨️ Etichetă</button>
    </div>
    <div class="stock">
      <div class="qty ${qtyClass}">${qtyLabel}</div>
      <div class="price">${p["PRET UNITAR CU TVA CE APARE PE ETICHETA"] ? p["PRET UNITAR CU TVA CE APARE PE ETICHETA"] + " lei" : ""}</div>
    </div>
  `;

  row.querySelector(".print-label-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    window.printLabel(p);
  });

  return row;
}

function findVariants(product) {
  const name = product["DENUMIRE SCURTA"];
  if (!name) return [];
  return products.filter(
    (p) => p["DENUMIRE SCURTA"] === name && p["COD SKU"] !== product["COD SKU"]
  );
}

function findExactBySku(query) {
  const key = normalize(query).trim();
  if (!key) return null;
  return products.find((p) => normalize(p["COD SKU"]) === key) || null;
}

function renderProductWithVariants(product) {
  resultsEl.innerHTML = "";
  resultsEl.appendChild(buildRow(product, true));

  const variants = findVariants(product).sort((a, b) =>
    String(a["MARIME"] || "").localeCompare(String(b["MARIME"] || ""))
  );

  if (variants.length > 0) {
    const heading = document.createElement("div");
    heading.className = "variants-heading";
    heading.textContent = `Alte mărimi / culori disponibile (${variants.length})`;
    resultsEl.appendChild(heading);
    for (const v of variants) {
      resultsEl.appendChild(buildRow(v, false));
    }
  }
}

function render(list) {
  resultsEl.innerHTML = "";

  if (list.length === 0) {
    resultsEl.innerHTML = `<div class="empty">Niciun produs găsit.</div>`;
    return;
  }

  const shown = list.slice(0, 60);

  for (const p of shown) {
    resultsEl.appendChild(buildRow(p, false));
  }

  if (list.length > shown.length) {
    const more = document.createElement("div");
    more.className = "empty";
    more.textContent = `+ încă ${list.length - shown.length} rezultate — rafinează căutarea`;
    resultsEl.appendChild(more);
  }
}

function matchesQuery(p, terms) {
  const haystack = normalize(
    [p["COD SKU"], p["DENUMIRE SCURTA"], p["DENUMIRE PRODUS"], p["NUME BRAND"], p["CULOARE LUNG"], p["CULOARE SCURT"], p["MARIME"], p["FAMILIA"]]
      .filter(Boolean)
      .join(" ")
  );
  return terms.every((t) => haystack.includes(t));
}

function runSearch(query) {
  const q = query.trim();
  if (!q) {
    resultsEl.innerHTML = "";
    return;
  }
  const exact = findExactBySku(q);
  if (exact) {
    renderProductWithVariants(exact);
    return;
  }
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const list = products.filter((p) => matchesQuery(p, terms));
  render(list);
}

searchInput.addEventListener("input", () => runSearch(searchInput.value));

async function startScan() {
  scannerOverlay.style.display = "flex";
  try {
    html5QrCode = new Html5Qrcode("reader");
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        stopScan();
        searchInput.value = decodedText;
        runSearch(decodedText);
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

async function init() {
  statusEl.textContent = "Se încarcă produsele…";
  await loadProducts();
  statusEl.textContent = "Se încarcă stocul din SmartBill…";
  await loadStock();
  statusEl.textContent = `${products.length} produse · stoc actualizat: ${
    stockUpdatedAt ? new Date(stockUpdatedAt).toLocaleTimeString("ro-RO") : "indisponibil"
  }`;
  searchInput.focus();
}
init();

setInterval(async () => {
  await loadStock();
  if (searchInput.value.trim()) runSearch(searchInput.value);
}, 120000);
