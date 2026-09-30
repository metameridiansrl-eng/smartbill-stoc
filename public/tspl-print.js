// tspl-print.js — printare directa pe imprimanta 4BARCODE/Arkscan 4B-2054L prin Web Bluetooth, din Chrome Android.
// Foloseste acelasi transport Bluetooth (Microchip Transparent UART) ca Rongta RPP30, dar alt limbaj de comenzi
// pentru motorul de print: TSPL2 (SIZE / GAP / CLS / BITMAP / PRINT), nu CPCL.
// Ca si la Rongta, construieste acelasi element .plabel-print (definit in etichete-print.js / etichete.css)
// si il rasterizeaza cu html2canvas, ca eticheta Bluetooth sa fie identica ca proportii cu cea de pe hartie.

const TSPL_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const TSPL_WRITE_CHAR_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
const TSPL_DPI_SCALE = 203 / 96; // CSS px (96dpi, ca in browser) -> puncte la 203dpi (rezolutia imprimantei)

let tsplChar = null;
let tsplDevice = null;

async function connectTspl() {
  if (!navigator.bluetooth) {
    alert("Bluetooth Web API nu e disponibil în acest browser. Deschide pagina în Chrome pe Android.");
    return null;
  }
  try {
    tsplDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "4B-2054" }],
      optionalServices: [TSPL_SERVICE_UUID],
    });
    const server = await tsplDevice.gatt.connect();
    const service = await server.getPrimaryService(TSPL_SERVICE_UUID);
    tsplChar = await service.getCharacteristic(TSPL_WRITE_CHAR_UUID);
    tsplDevice.addEventListener("gattserverdisconnected", () => {
      tsplChar = null;
    });
    return tsplChar;
  } catch (err) {
    console.error(err);
    alert("Nu m-am putut conecta la imprimantă: " + err.message);
    return null;
  }
}

async function bleWriteBytesChunked(characteristic, bytes) {
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

async function buildTsplLabelCanvas(it) {
  // Exact acelasi markup si aceeasi clasa CSS (.plabel-print) ca la printarea normala din browser.
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
  shrinkBlockToFit(label.querySelector(".name-block"), 9, 4.5);
  shrinkBlockToFit(label.querySelector(".furnizor-block"), 4.5, 3.5);
  shrinkBlockToFit(label.querySelector(".distribuitor-block"), 4.5, 3.5);
  await waitForImages(label);
  await nextFrame();

  let canvas;
  try {
    canvas = await html2canvas(label, {
      scale: TSPL_DPI_SCALE,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    document.body.removeChild(label);
  }
  return canvas;
}

// Converteste canvas-ul in date binare 1bpp pentru comanda TSPL BITMAP:
// date brute (nu text hex ca la CPCL), MSB primul in fiecare octet, negru = bit 1.
function canvasToTsplBitmap(canvas) {
  const w = canvas.width, h = canvas.height;
  const widthBytes = Math.ceil(w / 8);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, w, h).data;
  const bytes = new Uint8Array(widthBytes * h);
  let idx = 0;
  for (let y = 0; y < h; y++) {
    for (let bi = 0; bi < widthBytes; bi++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bi * 8 + bit;
        let on = 0;
        if (x < w) {
          const p = (y * w + x) * 4;
          const lum = imgData[p] * 0.299 + imgData[p + 1] * 0.587 + imgData[p + 2] * 0.114;
          // Aceasta imprimanta interpreteaza biții invers fata de conventia TSPL standard:
          // bit 0 = tipareste negru, bit 1 = lasa alb. De-aia logica e inversata fata de Rongta (CPCL).
          on = lum < 128 ? 0 : 1;
        }
        byte |= on << (7 - bit);
      }
      bytes[idx++] = byte;
    }
  }
  return { bytes, widthBytes, height: h };
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((a) => {
    out.set(a, offset);
    offset += a.length;
  });
  return out;
}

async function printLabelOnTspl(it) {
  if (!tsplChar) {
    const ch = await connectTspl();
    if (!ch) return false;
  }
  let canvas;
  try {
    canvas = await buildTsplLabelCanvas(it);
  } catch (err) {
    console.error(err);
    alert("Eroare la generarea etichetei: " + err.message);
    return false;
  }
  const { bytes, widthBytes, height } = canvasToTsplBitmap(canvas);

  const ascii = (s) => new TextEncoder().encode(s);
  // Presupunem etichete 40x30mm cu gap de 2mm intre ele (acelasi format ca la Rongta).
  // Daca imprimanta nu detecteaza corect inceputul etichetei, ajustam valoarea GAP.
  const header = ascii(
    "SIZE 40 mm,30 mm\r\n" +
      "GAP 2 mm,0 mm\r\n" +
      "DIRECTION 1\r\n" +
      "CLS\r\n" +
      "BITMAP 0,0," + widthBytes + "," + height + ",0,"
  );
  const footer = ascii("\r\nPRINT 1\r\n");
  const job = concatBytes(header, bytes, footer);

  try {
    await bleWriteBytesChunked(tsplChar, job);
    return true;
  } catch (err) {
    console.error(err);
    alert("Eroare la trimiterea etichetei: " + err.message);
    return false;
  }
}

const tsplBtn = document.getElementById("tsplBtn");
const tsplStatus = document.getElementById("tsplStatus");

if (tsplBtn) {
  tsplBtn.addEventListener("click", async () => {
    if (!items.length) {
      alert("Nu ai niciun produs în listă.");
      return;
    }
    tsplBtn.disabled = true;
    let total = 0;
    items.forEach((it) => { total += it.cantitate; });
    let done = 0;
    for (const it of items) {
      for (let i = 0; i < it.cantitate; i++) {
        tsplStatus.textContent = "Printez " + (done + 1) + "/" + total + "…";
        const ok = await printLabelOnTspl(it);
        if (!ok) {
          tsplStatus.textContent = "Oprit la eticheta " + (done + 1) + "/" + total + " (eroare).";
          tsplBtn.disabled = false;
          return;
        }
        done++;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    tsplStatus.textContent = "Gata — " + total + " etichete trimise.";
    tsplBtn.disabled = false;
  });
}
