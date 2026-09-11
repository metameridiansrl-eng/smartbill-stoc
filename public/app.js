// app.js — ruleaza in browser. NU contine niciun secret.

const searchInput = document.getElementById("search");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");

let products = [];
let stockMap = {};
let stockUpdatedAt = null;

// Coloanele afisate pe fiecare card de rezultat (in ordinea asta).
const DISPLAY_FIELDS = [
  "DENUMIRE SCURTA",
  "COD SKU",
  "BRAND",
  "FAMILIA",
  "CULOARE LUNG",
  "MARIME",
  "CATEGORIA (M/F/C)",
  "FURNIZOR/PRODUCATOR",
];

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
    .replace(/[\u0300-\u036f]/g, ""); // scoate diacriticele, ca vânzătorul să nu trebuiască să le scrie
}

function getStock(codSku) {
  const key = String(codSku || "").trim().toUpperCase();
  return stockMap[key] ?? null; // null = nu am gasit info de stoc pentru acest cod
}

function render(list) {
  resultsEl.innerHTML = "";

  if (list.length === 0) {
    resultsEl.innerHTML = `<div class="empty">Niciun produs găsit.</div>`;
    return;
  }

  // Limitam la 60 de rezultate afisate deodata, ca lista sa ramana rapida pe telefon.
  const shown = list.slice(0, 60);

  for (const p of shown) {
    const qty = getStock(p["COD SKU"]);
    const qtyClass = qty === null ? "" : qty > 0 ? "ok" : "zero";
    const qtyLabel = qty === null ? "?" : qty;

    const meta = [p["CULOARE LUNG"], p["MARIME"], p["BRAND"], p["FAMILIA"]]
      .filter(Boolean)
      .join(" · ");

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="main-info">
        <div class="name">${escapeHtml(p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || "—")}</div>
        <div class="meta">${escapeHtml(p["COD SKU"] || "")} ${meta ? "· " + escapeHtml(meta) : ""}</div>
      </div>
      <div class="stock">
        <div class="qty ${qtyClass}">${qtyLabel}</div>
        <div class="price">${p["PRET UNITAR CU TVA (LEI)"] ? p["PRET UNITAR CU TVA (LEI)"] + " lei" : ""}</div>
      </div>
    `;
    resultsEl.appendChild(row);
  }

  if (list.length > shown.length) {
    const more = document.createElement("div");
    more.className = "empty";
    more.textContent = `+ încă ${list.length - shown.length} rezultate — rafinează căutarea`;
    resultsEl.appendChild(more);
  }
}

function search(query) {
  const q = normalize(query);
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);

  return products.filter((p) => {
    const haystack = normalize(Object.values(p).join(" "));
    return terms.every((t) => haystack.includes(t));
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

searchInput.addEventListener("input", () => {
  const results = search(searchInput.value);
  render(results);
});

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

// Reimprospatam stocul din 2 in 2 minute, cat timp pagina ramane deschisa in magazin.
setInterval(async () => {
  await loadStock();
  if (searchInput.value) render(search(searchInput.value));
}, 120000);
