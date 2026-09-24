// etichete.js — stare, cautare produs, randare lista. Ruleaza in browser.

const DISTRIBUITOR = "Distribuitor: ONZE SHOWROOM SRL — Str. Suvenir nr. 4, București";

let products = [];
let brandsData = [];
let items = [];
let lastFabricat = "";
let discountPercent = 0;

const tableBody = document.getElementById("tableBody");
const statProduse = document.getElementById("statProduse");
const statEtichete = document.getElementById("statEtichete");
const printBtn = document.getElementById("printBtn");
const printArea = document.getElementById("printArea");
const discountInput = document.getElementById("discountPercent");

discountInput.addEventListener("input", () => {
  const v = parseFloat(discountInput.value);
  discountPercent = isNaN(v) || v < 0 ? 0 : Math.min(v, 95);
});

async function loadProducts() {
  const res = await fetch("/data/products.json");
  products = await res.json();
}

async function loadBrands() {
  const res = await fetch("/data/brands.json");
  brandsData = await res.json();
}

function normalizeBrand(str) {
  return String(str || "").trim().toLowerCase();
}

function findBrandEntries(brandName) {
  const target = normalizeBrand(brandName);
  return brandsData.filter((b) => normalizeBrand(b.brand) === target);
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPrice(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return (val || "").toString();
  return num.toFixed(2).replace(/\.00$/, "") + " LEI";
}

function findProductBySku(sku) {
  const key = String(sku || "").trim().toUpperCase();
  if (!key) return null;
  return products.find((p) => String(p["COD SKU"] || "").trim().toUpperCase() === key) || null;
}

function addItemForProduct(p) {
  const brandName = p["NUME BRAND"] || "";
  const entries = findBrandEntries(brandName);
  const match = entries[0] || null;
  items.push({
    brand: brandName,
    denumire: p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || "",
    codFurnizor: p["COD INTERN PRODUCATOR"] || "",
    culoare: p["CULOARE SCURT"] || p["CULOARE LUNG"] || "",
    masura: p["MARIME"] || "",
    sku: p["COD SKU"] || "",
    pret: p["PRET UNITAR CU TVA CE APARE PE ETICHETA"] || "",
    fabricat: lastFabricat,
    furnizor: match ? match.firma : "",
    adresaFurnizor: match ? match.adresaEticheta : "",
    firmaOptions: entries,
    cantitate: 1,
  });
  renderList();
}

function renderList() {
  tableBody.innerHTML = "";
  if (items.length === 0) {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Niciun produs încă — scanează ceva mai sus.</td></tr>';
    statProduse.textContent = "0";
    statEtichete.textContent = "0";
    printBtn.disabled = true;
    return;
  }
  let total = 0;
  items.forEach((it, idx) => {
    total += it.cantitate;
    const tr = document.createElement("tr");
    const label = [it.brand, it.denumire, it.culoare, it.masura].filter(Boolean).join(" · ");
    let firmaHtml = escapeHtml(it.furnizor || "—");
    if (it.firmaOptions && it.firmaOptions.length > 1) {
      firmaHtml = `<select class="row-firma" data-idx="${idx}">` +
        it.firmaOptions.map((o, i) =>
          `<option value="${i}" ${o.firma === it.furnizor ? "selected" : ""}>${escapeHtml(o.firma)}</option>`
        ).join("") + "</select>";
    }
    tr.innerHTML = `
      <td><div class="row-name">${escapeHtml(label)}</div><div class="row-sub">${escapeHtml(it.sku)}</div></td>
      <td><input class="row-num" type="number" min="1" step="1" value="${it.cantitate}" data-idx="${idx}" data-field="cantitate"></td>
      <td><input class="row-fabricat" type="text" value="${escapeHtml(it.fabricat)}" data-idx="${idx}" data-field="fabricat" placeholder="Turcia"></td>
      <td>${firmaHtml}</td>
      <td><span class="del-btn" data-idx="${idx}">Șterge</span></td>
    `;
    tableBody.appendChild(tr);
  });
  statProduse.textContent = items.length.toString();
  statEtichete.textContent = total.toString();
  printBtn.disabled = false;

  tableBody.querySelectorAll(".row-num, .row-fabricat").forEach((el) => {
    el.addEventListener("input", () => {
      const idx = parseInt(el.dataset.idx);
      const field = el.dataset.field;
      if (field === "cantitate") {
        const v = parseInt(el.value);
        items[idx].cantitate = isNaN(v) || v < 1 ? 1 : v;
        statEtichete.textContent = items.reduce((s, i) => s + i.cantitate, 0).toString();
      } else {
        items[idx].fabricat = el.value;
        lastFabricat = el.value;
      }
    });
  });
  tableBody.querySelectorAll(".row-firma").forEach((el) => {
    el.addEventListener("change", () => {
      const idx = parseInt(el.dataset.idx);
      const opt = items[idx].firmaOptions[parseInt(el.value)];
      items[idx].furnizor = opt.firma;
      items[idx].adresaFurnizor = opt.adresaEticheta;
    });
  });
  tableBody.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      items.splice(parseInt(btn.dataset.idx), 1);
      renderList();
    });
  });
}

async function init() {
  await Promise.all([loadProducts(), loadBrands()]);
}
init();
