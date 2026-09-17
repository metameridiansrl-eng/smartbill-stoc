function doPrint(product, brandEntry, fabricatIn) {
  ensureLabelStyles();
  const area = ensurePrintArea();

  const p = {
    brand: product["BRAND"] || "",
    denumire: product["DENUMIRE PRODUS"] || product["DENUMIRE SCURTA"] || "",
    codFurnizor: product["COD PRODUCATOR"] || "",
    culoare: product["CULOARE SCURT"] || product["CULOARE LUNG"] || "",
    masura: product["MARIME"] || "",
    sku: product["COD SKU"] || "",
    pret: product["PRET UNITAR CU TVA (LEI)"] || "",
    fabricat: fabricatIn || "",
    furnizor: brandEntry ? brandEntry.firma : "",
    adresaFurnizor: brandEntry ? brandEntry.adresaEticheta : "",
  };

  const dataUrl = barcodeDataUrl(p.sku);
  const barcodeHtml = dataUrl
    ? `<img src="${dataUrl}" alt="cod de bare">`
    : `<div style="font-size:6pt;color:#c00;">Eroare cod de bare</div>`;

  area.innerHTML = `
    <div class="plabel-print">
      <div class="name-block">${escapeHtml(nameBlockText(p))}</div>
      <div class="barcode-row">${barcodeHtml}</div>
      <div class="sku-pret-row"><span class="sku">${escapeHtml(p.sku)}</span><span class="pret">${escapeHtml(formatPrice(p.pret))}</span></div>
      <div class="fabricat">${p.fabricat ? "Fabricat în " + escapeHtml(p.fabricat) : ""}</div>
      <div class="furnizor-block">${escapeHtml(furnizorText(p))}</div>
      <div class="distribuitor-block">${escapeHtml(DISTRIBUITOR)}</div>
    </div>
  `;

  shrinkBlockToFit(area.querySelector(".name-block"), 9, 4.5);
  shrinkBlockToFit(area.querySelector(".furnizor-block"), 4.5, 3.5);
  shrinkBlockToFit(area.querySelector(".distribuitor-block"), 4.5, 3.5);

  setTimeout(() => window.print(), 50);
}
