// etichete-scan.js — scanare camera + cautare manuala dupa SKU. Ruleaza in browser.

const manualSku = document.getElementById("manualSku");
const scanForm = document.getElementById("scanForm");
const scanBtn = document.getElementById("scan-btn");
const scannerOverlay = document.getElementById("scanner-overlay");
const scanCloseBtn = document.getElementById("scan-close");
const scanStatus = document.getElementById("scanStatus");
let html5QrCode = null;
let scanCooldown = false;

function showScanStatus(msg, isError) {
  scanStatus.textContent = msg;
  scanStatus.classList.toggle("error", !!isError);
}

function tryAddSku(sku) {
  const p = findProductBySku(sku);
  if (!p) {
    showScanStatus(`Cod necunoscut: "${sku}"`, true);
    return false;
  }
  addItemForProduct(p);
  const denumire = p["DENUMIRE SCURTA"] || p["DENUMIRE PRODUS"] || sku;
  showScanStatus(`✓ Adăugat: ${denumire}`, false);
  return true;
}

// Folosim evenimentul de submit al formularului (nu keydown pe input), pentru ca pe telefon
// tastatura virtuala (ex. Gboard) nu declanseaza mereu corect "Enter" ca eveniment de tasta,
// dar declanseaza mereu submit cand apesi Enter/Go/Done.
scanForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = manualSku.value.trim();
  if (!val) return;
  tryAddSku(val);
  manualSku.value = "";
});

async function startScan() {
  scannerOverlay.style.display = "flex";
  try {
    html5QrCode = new Html5Qrcode("reader");
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        if (scanCooldown) return;
        scanCooldown = true;
        tryAddSku(decodedText);
        setTimeout(() => { scanCooldown = false; }, 1200);
      },
      () => {}
    );
  } catch (err) {
    alert("Nu am putut porni camera. Verifică că ai dat acces la cameră pentru acest site.");
    console.error(err);
    scannerOverlay.style.display = "none";
  }
}

async function stopScan() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (err) {}
    html5QrCode = null;
  }
  scannerOverlay.style.display = "none";
}

scanBtn.addEventListener("click", startScan);
scanCloseBtn.addEventListener("click", stopScan);
