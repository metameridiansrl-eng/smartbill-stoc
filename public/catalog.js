// catalog.js — ruleaza in browser. NU contine niciun secret.

const searchInput = document.getElementById("search");
const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const brandSelect = document.getElementById("filter-brand");
const familiaSelect = document.getElementById("filter-familia");

let products = [];
let models = []; // { name, variants:[...], brand, familia, price }
let stockMap = {};
let expandedName = null; // numele modelului deschis in acest moment (un singur card deschis odata)

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

function buildModels() {
  const map = new Map();
  for (const p of products) {
    const key = p["DENUMIRE SCURTA"] || p["COD SKU"];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  models = Array.from(map.entries()).map(([name, variants]) => ({
    name,
    variants,
    brand: String(variants[0]["NUME BRAND"] || "").trim(),
    familia: String(variants[0]["FAMILIA"] || "").trim(),
    price: variants[0]["PRET UNITAR CU TVA CE APARE PE ETICHETA"] || "",
  }));
}

function fillSelect(select, values, allLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>`;
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
  select.value = current;
}

function setupFilters() {
  fillSelect(brandSelect, [...new Set(models.map((m) => m.brand).filter(Boolean))].sort(), "Brand: toate");
  fillSelect(familiaSelect, [...new Set(models.map((m) => m.familia).filter(Boolean))].sort(), "Familia: toate");
}

function modelStockSummary(model) {
  let total = 0;
  let known = false;
  for (const v of model.variants) {
    const q = getStock(v["COD SKU"]);
    if (q !== null) {
      known = true;
      total += q;
    }
  }
  return { total, known };
}

function buildCard(model) {
  const { total, known } = modelStockSummary(model);
  const isOpen = expandedName === model.name;

  const card = document.createElement("div");
  card.className = "card";

  const badgeClass = !known ? "" : total > 0 ? "ok" : "zero";
  const badgeLabel = !known
    ? `${model.variants.length} variante`
    : total > 0
    ? `${model.variants.length} variante`
    : "stoc epuizat";

  card.innerHTML = `
    <div class="card-top">
      <div class="name" style="margin:0;">${escapeHtml(model.name)}</div>
      <div class="badge ${badgeClass}">${badgeLabel}</div>
    </div>
    <p class="brand">${escapeHtml(model.brand)}</p>
    <p class="price">${model.price ? model.price + " lei" : ""}</p>
  `;

  if (isOpen) {
    const box = document.createElement("div");
    box.className = "variants-box";
    box.innerHTML = `<p class="vlabel">Variante (${model.variants.length})</p>`;
    const sorted = [...model.variants].sort((a, b) =>
      String(a["MARIME"] || "").localeCompare(String(b["MARIME"] || ""))
    );
    for (const v of sorted) {
      const q = getStock(v["COD SKU"]);
      const qClass = q === null ? "" : q > 0 ? "ok" : "zero";
      const qLabel = q === null ? "?" : q;
      const row = document.createElement("div");
      row.className = "variant-row";
      const label = [v["MARIME"], v["CULOARE LUNG"]].filter(Boolean).join(" · ") || v["COD SKU"];
      row.innerHTML = `<span>${escapeHtml(label)}</span><span class="qty ${qClass}">${qLabel}</span>`;
      box.appendChild(row);
    }
    card.appendChild(box);
  }

  card.addEventListener("click", () => {
    expandedName = isOpen ? null : model.name;
    render();
  });

  return card;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function matchesFilters(model) {
  if (brandSelect.value && model.brand !== brandSelect.value) return false;
  if (familiaSelect.value && model.familia !== familiaSelect.value) return false;
  return true;
}

function matchesSearch(model, query) {
  const q = normalize(query);
  if (!q) return true;
  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = normalize(
    [model.name, model.brand, model.familia, ...model.variants.flatMap((v) => Object.values(v))].join(" ")
  );
  return terms.every((t) => haystack.includes(t));
}

function render() {
  const filtered = models.filter((m) => matchesFilters(m) && matchesSearch(m, searchInput.value));

  gridEl.innerHTML = "";
  if (filtered.length === 0) {
    gridEl.innerHTML = `<div class="empty">Niciun model găsit.</div>`;
    return;
  }
  for (const m of filtered) {
    gridEl.appendChild(buildCard(m));
  }
}

searchInput.addEventListener("input", render);
brandSelect.addEventListener("change", render);
familiaSelect.addEventListener("change", render);

async function init() {
  statusEl.textContent = "Se încarcă produsele…";
  await loadProducts();
  buildModels();
  setupFilters();
  statusEl.textContent = "Se încarcă stocul din SmartBill…";
  await loadStock();
  statusEl.textContent = `${models.length} modele · ${products.length} variante în total`;
  render();
}

init();

setInterval(async () => {
  await loadStock();
  render();
}, 120000);
