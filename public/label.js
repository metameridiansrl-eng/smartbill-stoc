// label.js - printare eticheta produs (40mm x 30mm)

let brandsData = null;
let brandsPromise = null;

function loadBrands() {
  if (!brandsPromise) {
    brandsPromise = fetch("data/brands.json")
      .then((r) => r.json())
      .then((data) => {
        brandsData = data;
        return data;
      })
      .catch((err) => {
        console.error("Nu am putut incarca brands.json", err);
        brandsData = [];
        return [];
      });
  }
  return brandsPromise;
}

function normalizeBrand(str) {
  return String(str || "").trim().toLowerCase();
}

function findBrandEntries(brandName) {
  if (!brandsData) return [];
  const target = normalizeBrand(brandName);
  return brandsData.filter((b) => normalizeBrand(b.brand) === target);
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

window.printLabel = function (product) {
  loadBrands().then(() => {
    const brandName = product["BRAND"] || "";
    const entries = findBrandEntries(brandName);

    if (entries.length === 0) {
      alert(`Nu am gasit date de contact pentru brandul "${brandName}" in contacte_branduri.xlsx.`);
      return;
    }

    if (entries.length === 1) {
      askFabricatInSiPrint(product, entries[0]);
      return;
    }

    showCompanyPicker(product, entries);
  });
};

function askFabricatInSiPrint(product, brandEntry) {
  const fabricatIn = prompt("Fabricat in (tara de origine):", "");
  if (fabricatIn === null) return; // anulat
  doPrint(product, brandEntry, fabricatIn);
}

function showCompanyPicker(product, entries) {
  ensureLabelStyles();
  const overlay = document.createElement("div");
  overlay.className = "label-picker-overlay";
  overlay.innerHTML = `
    <div class="label-picker-box">
      <h3>Alege firma pentru "${escapeHtml(product["BRAND"] || "")}"</h3>
      <div class="label-picker-options"></div>
      <button class="label-picker-cancel" type="button">Anuleaza</button>
    </div>
  `;
  const optionsDiv = overlay.querySelector(".label-picker-options");
  entries.forEach((entry) => {
    const btn = document.createElement("button");
    btn.className = "label-picker-option";
    btn.type = "button";
    btn.textContent = entry.firma || "(fara nume firma)";
    btn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      askFabricatInSiPrint(product, entry);
    });
    optionsDiv.appendChild(btn);
  });
  overlay.querySelector(".label-picker-cancel").addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  document.body.appendChild(overlay);
}

function ensureLabelStyles() {
  if (document.getElementById("label-print-style")) return;
  const style = document.createElement("style");
  style.id = "label-print-style";
  style.textContent = `
    #label-print-area { display: none; }

    @media print {
      @page { size: 40mm 30mm; margin: 0; }
      body * { visibility: hidden; }
      #label-print-area, #label-print-area * { visibility: visible; }
      #label-print-area {
        display: block !important;
        position: absolute;
        top: 0; left: 0;
        width: 40mm; height: 30mm;
      }
      .label-box {
        width: 40mm; height: 30mm;
        box-sizing: border-box;
        padding: 1.5mm 2mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-family: Arial, sans-serif;
      }
      .label-brand { font-size: 8pt; font-weight: bold; text-transform: uppercase; }
      .label-name { font-size: 6.5pt; line-height: 1.15; max-height: 8mm; overflow: hidden; }
      .label-row { display: flex; justify-content: space-between; font-size: 6pt; }
      .label-price { font-size: 8pt; font-weight: bold; text-align: right; }
      .label-barcode { text-align: center; }
      .label-barcode svg { width: 36mm; height: 7mm; }
      .label-barcode-text { font-size: 5.5pt; }
      .label-origin { font-size: 5pt; }
      .label-furnizor, .label-distribuitor { font-size: 4.3pt; line-height: 1.1; }
    }

    .label-picker-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center; z-index: 9999;
    }
    .label-picker-box { background: #fff; border-radius: 8px; padding: 20px; max-width: 320px; width: 90%; }
    .label-picker-box h3 { margin: 0 0 12px; font-size: 15px; }
    .label-picker-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .label-picker-option {
      padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: #f7f7f7;
      cursor: pointer; font-size: 14px; text-align: left;
    }
    .label-picker-option:hover { background: #eee; }
    .label-picker-cancel { width: 100%; padding: 8px; border: none; background: none; color: #888; cursor: pointer; }
  `;
  document.head.appendChild(style);
}

function ensurePrintArea() {
  let area = document.getElementById("label-print-area");
  if (!area) {
    area = document.createElement("div");
    area.id = "label-print-area";
    document.body.appendChild(area);
  }
  return area;
}

const DISTRIBUITOR = "ONZE SHOWROOM S.R.L., Sediu social: Bucuresti, Sector 2, Str. Suvenir nr. 4";

function buildLabelHtml(product, brandEntry, fabricatIn) {
  const brand = product["BRAND"] || "";
  const denumire = product["DENUMIRE PRODUS"] || product["DENUMIRE SCURTA"] || "";
  const codFurnizor = product["COD PRODUCATOR"] || "";
  const culoare = product["CULOARE SCURT"] || product["CULOARE LUNG"] || "";
  const marime = product["MARIME"] || "";
  const sku = product["COD SKU"] || "";
  const pret = product["PRET UNITAR CU TVA (LEI)"] || "";
  const firma = brandEntry ? brandEntry.firma : "";
  const adresa = brandEntry ? brandEntry.adresaEticheta : "";

  return `
    <div class="label-box">
      <div class="label-brand">${escapeHtml(brand)}</div>
      <div class="label-name">${escapeHtml(denumire)}${codFurnizor ? " (" + escapeHtml(codFurnizor) + ")" : ""}</div>
      <div class="label-row">
        <span>${escapeHtml(culoare)}${culoare && marime ? " / " : ""}${escapeHtml(marime)}</span>
        <span class="label-price">${escapeHtml(String(pret))} lei</span>
      </div>
      <div class="label-barcode">
        <svg id="label-barcode-svg"></svg>
        <div class="label-barcode-text">${escapeHtml(sku)}</div>
      </div>
      <div class="label-origin">Fabricat in: ${escapeHtml(fabricatIn || "")}</div>
      <div class="label-furnizor">Furnizor: ${escapeHtml(firma)}, ${escapeHtml(adresa)}</div>
      <div class="label-distribuitor">Distribuitor: ${escapeHtml(DISTRIBUITOR)}</div>
    </div>
  `;
}

function doPrint(product, brandEntry, fabricatIn) {
  ensureLabelStyles();
  const area = ensurePrintArea();
  area.innerHTML = buildLabelHtml(product, brandEntry, fabricatIn);

  if (window.JsBarcode) {
    try {
      window.JsBarcode("#label-barcode-svg", String(product["COD SKU"] || ""), {
        format: "CODE128",
        displayValue: false,
        height: 26,
        margin: 0,
      });
    } catch (e) {
      console.error("Eroare generare cod de bare", e);
    }
  }

  setTimeout(() => window.print(), 50);
}
