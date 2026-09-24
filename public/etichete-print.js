// etichete-print.js — cod de bare, shrink-to-fit, construire zona de print. Ruleaza in browser.

function nameBlockText(it) {
  return [it.brand, it.denumire, it.codFurnizor, it.culoare, it.masura].filter(Boolean).join(" · ");
}
function furnizorText(it) {
  return ["Furnizor: " + (it.furnizor || ""), it.adresaFurnizor].filter(Boolean).join(" — ");
}

function pretBlockHtml(it) {
  const pretVechi = parseFloat(it.pret);
  const hasDiscount = discountPercent > 0 && !isNaN(pretVechi) && pretVechi > 0;
  if (!hasDiscount) {
    return `<span class="pret">${escapeHtml(formatPrice(it.pret))}</span>`;
  }
  const pretNou = pretVechi * (1 - discountPercent / 100);
  return `<span class="pret-block"><span class="pret-vechi">${escapeHtml(formatPrice(pretVechi))}</span><span class="pret-nou">${escapeHtml(formatPrice(pretNou))}</span></span>`;
}

function barcodeDataUrl(sku) {
  try {
    if (typeof JsBarcode === "undefined") throw new Error("JsBarcode nu e incarcat");
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, (sku || "0000000000").toString(), {
      format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Barcode error", sku, e);
    return null;
  }
}

function shrinkBlockToFit(el, maxHeightMm, minFontPt) {
  if (!el) return;
  const maxHeightPx = maxHeightMm * 3.7795275591;
  let fontSize = parseFloat(getComputedStyle(el).fontSize);
  const floorPx = minFontPt * 1.3333333;
  let guard = 0;
  while (el.scrollHeight > maxHeightPx + 0.5 && fontSize > floorPx && guard < 40) {
    fontSize -= 0.25;
    el.style.fontSize = fontSize + "px";
    guard++;
  }
}

function buildPrintArea() {
  printArea.innerHTML = "";
  printArea.style.position = "absolute";
  printArea.style.visibility = "hidden";
  printArea.style.display = "block";

  items.forEach((it) => {
    for (let i = 0; i < it.cantitate; i++) {
      const label = document.createElement("div");
      label.className = "plabel-print";
      const dataUrl = barcodeDataUrl(it.sku);
      const barcodeHtml = dataUrl
        ? `<img src="${dataUrl}" alt="cod de bare">`
        : `<div style="font-size:6pt;color:#c00;">Eroare cod de bare</div>`;
      label.innerHTML = `
        <div class="name-block">${escapeHtml(nameBlockText(it))}</div>
        <div class="barcode-row">${barcodeHtml}</div>
        <div class="sku-pret-row"><span class="sku">${escapeHtml(it.sku)}</span>${pretBlockHtml(it)}</div>
        <div class="fabricat">${it.fabricat ? "Fabricat în " + escapeHtml(it.fabricat) : ""}</div>
        <div class="furnizor-block">${escapeHtml(furnizorText(it))}</div>
        <div class="distribuitor-block">${escapeHtml(DISTRIBUITOR)}</div>
      `;
      printArea.appendChild(label);
      shrinkBlockToFit(label.querySelector(".name-block"), 9, 4.5);
      shrinkBlockToFit(label.querySelector(".furnizor-block"), 4.5, 3.5);
      shrinkBlockToFit(label.querySelector(".distribuitor-block"), 4.5, 3.5);
    }
  });

  printArea.style.display = "none";
  printArea.style.visibility = "";
  printArea.style.position = "";
}

printBtn.addEventListener("click", () => {
  buildPrintArea();
  setTimeout(() => window.print(), 50);
});
