// rongta-print.js — printare directa pe imprimanta Rongta RPP30 prin Web Bluetooth, din Chrome Android.
// Nu necesita nicio aplicatie instalata. Foloseste UUID-urile BLE reale ale RPP30 si comenzi CPCL (EG = imagine).

const RONGTA_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const RONGTA_WRITE_CHAR_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

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

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  });
  if (cur) lines.push(cur);
  return lines;
}

function drawFitText(ctx, text, x, y, maxWidth, maxHeight, bold, startSize, minSize) {
  let size = startSize;
  let lines = [];
  let lineHeight = 0;
  while (size >= minSize) {
    ctx.font = (bold ? "bold " : "") + size + "px Arial";
    lines = wrapLines(ctx, text, maxWidth);
    lineHeight = Math.round(size * 1.15);
    if (lines.length * lineHeight <= maxHeight) break;
    size -= 1;
  }
  ctx.font = (bold ? "bold " : "") + size + "px Arial";
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function pretPlainText(it) {
  const pretVechi = parseFloat(it.pret);
  const hasDiscount = discountPercent > 0 && !isNaN(pretVechi) && pretVechi > 0;
  if (!hasDiscount) return formatPrice(it.pret);
  const pretNou = pretVechi * (1 - discountPercent / 100);
  return formatPrice(pretNou);
}

function buildLabelCanvas(it) {
  const W = 320, H = 240;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  let y = 4;
  y = drawFitText(ctx, nameBlockText(it), 4, y, W - 8, 54, true, 19, 10);
  y += 3;

  const bcCanvas = document.createElement("canvas");
  try {
    JsBarcode(bcCanvas, (it.sku || "0000000000").toString(), {
      format: "CODE128", width: 2, height: 100, displayValue: false, margin: 0,
    });
    ctx.drawImage(bcCanvas, 10, y, W - 20, 46);
  } catch (e) {
    console.warn("Barcode error", e);
  }
  y += 50;

  ctx.font = "11px Arial";
  ctx.textAlign = "left";
  ctx.fillText(it.sku || "", 4, y + 6);
  const pretText = pretPlainText(it);
  ctx.font = "bold 20px Arial";
  const ptw = ctx.measureText(pretText).width;
  ctx.fillText(pretText, W - 4 - ptw, y);
  y += 26;

  ctx.textAlign = "left";
  if (it.fabricat) {
    ctx.font = "9px Arial";
    ctx.fillText("Fabricat în " + it.fabricat, 4, y);
    y += 12;
  }

  y = drawFitText(ctx, furnizorText(it), 4, y, W - 8, 26, false, 9, 6);
  y += 1;
  drawFitText(ctx, DISTRIBUITOR, 4, y, W - 8, 26, false, 9, 6);

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
  const canvas = buildLabelCanvas(it);
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
