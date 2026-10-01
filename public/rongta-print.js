// rongta-print.js — printare directa pe imprimanta Rongta RPP30 prin Web Bluetooth, din Chrome Android.
// Nu deseneaza eticheta separat, cu formule proprii: construieste acelasi element .plabel-print
// folosit la printarea normala din browser (etichete-print.js, aceeasi clasa CSS din etichete.css)
// si il rasterizeaza cu html2canvas, ca eticheta Bluetooth sa fie identica ca proportii cu cea de pe hartie.

const RONGTA_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const RONGTA_WRITE_CHAR_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
const RONGTA_DPI_SCALE = 203 / 96; // CSS px (96dpi, ca in browser) -> puncte la 203dpi (rezolutia reala a RPP30)

let rongtaChar = null;
let rongtaDevice = null;

async function connectRongta() {
  if (!navigator.bluetooth) {
    alert("Bluetooth Web API nu e disponibil în acest browser. Deschide pagina în Chrome pe Android.");
    return null;
  }
  try {
    rongtaDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "RPP30" }],
      optionalServices: [RONGTA_SERVICE_UUID],
    });
    const server = await rongtaDevice.gatt.connect();
    const service = await server.getPrimaryService(RONGTA_SERVICE_UUID);
    rongtaChar = await service.getCharacteristic(RONGTA_WRITE_CHAR_UUID);
    rongtaDevice.addEventListener("gattserverdisconnected", () => {
      rongtaChar = null;
    });
    return rongtaChar;
  } catch (err) {
    console.error(err);
    alert("Nu m-am putut conecta la imprimanta Rongta: " + err.message);
    return null;
  }
}

async function bleWriteChunks(characteristic, str) {
  const bytes = new TextEncoder().encode(str);
  const chunkSize = 180;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    await characteristic.writeValueWithoutResponse(chunk);
    await new Promise((r) => setTimeout(r, 15));
  }
}

function waitForImages(el) {
  const imgs = Array.from(el.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
            })
    )
  );
}

function nextFrame() {
  return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
}

async function buildRongtaLabelCanvas(it) {
  // Exact acelasi markup si aceeasi clasa CSS (.plabel-print) ca in buildPrintArea() din etichete-print.js,
  // pentru un singur produs, randat in afara ecranului si apoi rasterizat.
  const label = document.createElement("div");
  label.className = "plabel-print";
  label.style.position = "fixed";
  label.style.left = "-9999px";
  label.style.top = "0";
  label.style.background = "#fff";

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
  document.body.appendChild(label);

  await nextFrame();
  // Aceleasi apeluri de shrink-to-fit ca la printarea normala din browser — acelasi rezultat vizual.
  shrinkBlockToFit(label.querySelector(".name-block"), 9, 4.5);
  shrinkRowToFit(label.querySelector(".sku-pret-row"), 5);
  shrinkBlockToFit(label.querySelector(".furnizor-block"), 4.5, 3.5);
  shrinkBlockToFit(label.querySelector(".distribuitor-block"), 4.5, 3.5);
  await waitForImages(label);
  await nextFrame();

  let canvas;
  try {
    canvas = await html2canvas(label, {
      scale: RONGTA_DPI_SCALE,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    document.body.removeChild(label);
  }
  return canvas;
}

function canvasToCpclEG(canvas) {
  const w = canvas.width, h = canvas.height;
  const widthBytes = Math.ceil(w / 8);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, w, h).data;
  let hex = "";
  for (let y = 0; y < h; y++) {
    for (let bi = 0; bi < widthBytes; bi++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bi * 8 + bit;
        let on = 0;
        if (x < w) {
          const idx = (y * w + x) * 4;
          const lum = imgData[idx] * 0.299 + imgData[idx + 1] * 0.587 + imgData[idx + 2] * 0.114;
          on = lum < 128 ? 1 : 0;
        }
        byte |= on << (7 - bit);
      }
      hex += byte.toString(16).padStart(2, "0");
    }
  }
  return { hex, widthBytes, height: h };
}

async function printLabelOnRongta(it) {
  if (!rongtaChar) {
    const ch = await connectRongta();
    if (!ch) return false;
  }
  let canvas;
  try {
    canvas = await buildRongtaLabelCanvas(it);
  } catch (err) {
    console.error(err);
    alert("Eroare la generarea etichetei: " + err.message);
    return false;
  }
  const { hex, widthBytes, height } = canvasToCpclEG(canvas);
  const cpcl =
    "! 0 200 200 " + (height + 10) + " 1\r\n" +
    "EG " + widthBytes + " " + height + " 0 0 " + hex + "\r\n" +
    "FORM\r\n" +
    "PRINT\r\n";
  try {
    await bleWriteChunks(rongtaChar, cpcl);
    return true;
  } catch (err) {
    console.error(err);
    alert("Eroare la trimiterea etichetei către Rongta: " + err.message);
    return false;
  }
}

const rongtaBtn = document.getElementById("rongtaBtn");
const rongtaStatus = document.getElementById("rongtaStatus");

if (rongtaBtn) {
  rongtaBtn.addEventListener("click", async () => {
    if (!items.length) {
      alert("Nu ai niciun produs în listă.");
      return;
    }
    rongtaBtn.disabled = true;
    let total = 0;
    items.forEach((it) => { total += it.cantitate; });
    let done = 0;
    for (const it of items) {
      for (let i = 0; i < it.cantitate; i++) {
        rongtaStatus.textContent = "Printez " + (done + 1) + "/" + total + "…";
        const ok = await printLabelOnRongta(it);
        if (!ok) {
          rongtaStatus.textContent = "Oprit la eticheta " + (done + 1) + "/" + total + " (eroare).";
          rongtaBtn.disabled = false;
          return;
        }
        done++;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    rongtaStatus.textContent = "Gata — " + total + " etichete trimise.";
    rongtaBtn.disabled = false;
  });
}
