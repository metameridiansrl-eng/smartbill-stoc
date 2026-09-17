// label.js - printare eticheta produs (40mm x 30mm), design preluat din tool-ul de etichete RFB

let brandsData = null;
let brandsPromise = null;

function loadBrands() {
  if (!brandsPromise) {
    brandsPromise = fetch("data/brands.json")
      .then((r) => r.json())
      .then((data) => { brandsData = data; return data; })
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
        position: absolute; top: 0; left: 0;
      }
      .plabel-print {
        width: 40mm; height: 30mm; padding: 1mm 1.5mm;
        display: flex; flex-direction: column; justify-content: space-between;
        overflow: hidden; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif;
      }
      .plabel-print .name-block { font-size: 7pt; font-weight: bold; line-height: 1.15; overflow: hidden; flex-shrink: 0; }
      .plabel-print .barcode-row { width: 100%; height: 6mm; overflow: hidden; text-align: center; flex-shrink: 0; }
      .plabel-print .barcode-row img { display: block; width: 100%; height: 6mm; }
      .plabel-print .sku-pret-row { display: flex; justify-content: space-between; align-items: baseline; flex-shrink: 0; }
      .plabel-print .sku { font-size: 6.5pt; }
      .plabel-print .pret { font-size: 10pt; font-weight: bold; }
      .plabel-print .fabricat { font-size: 5.2pt; color: #444; flex-shrink: 0; }
      .plabel-print .furnizor-block, .plabel-print .distribuitor-block {
        font-size: 5.2pt; line-height: 1.15; overflow: hidden; flex-shrink: 0;
      }
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

const DISTRIBUITOR = "Distribuitor: ONZE SHOWROOM SRL — Str. Suvenir nr. 4, București";

function nameBlockText(p) {
  return [p.brand, p.denumire, p.codFurnizor, p.culoare, p.masura].filter(Boolean).join(" · ");
}
function furnizorText(p) {
  return ["Furnizor: " + (p.furnizor || ""), p.adresaFurnizor].filter(Boolean).join(" — ");
}
function formatPrice(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return
