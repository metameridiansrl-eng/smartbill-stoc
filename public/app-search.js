function performSearch(query) {
  const exact = findExactBySku(query);
  if (exact) {
    renderProductWithVariants(exact);
  } else {
    render(search(query));
  }
}

function search(query) {
  const q = normalize(query);
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);

  return products.filter((p) => {
    const haystack = normalize(Object.values(p).join(" "));
    return terms.every((t) => haystack.includes(t));
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

searchInput.addEventListener("input", () => {
  performSearch(searchInput.value);
});

// --- Scanare cod de bare cu camera telefonului ---

const scanBtn = document.getElementById("scan-btn");
const scannerOverlay = document.getElementById("scanner-overlay");
const scanCloseBtn = document.getElementById("scan-close");
let html5QrCode = null;

async function startScan() {
  scannerOverlay.style.display = "flex";
  try {
    html5QrCode = new Html5Qrcode("reader");
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        searchInput.value = decodedText;
        performSearch(decodedText);
        stopScan();
      },
      () => {}
    );
  } catch (err) {
    alert("Nu am putut porni camera. Verifică că ai dat acces la cameră pentru acest site, în Setări Safari.");
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

async function init() {
  statusEl.textContent = "Se încarcă produsele…";
  await loadProducts();
  statusEl.textContent = "Se încarcă stocul din SmartBill…";
  await loadStock();
  statusEl.textContent = `${products.length} produse · stoc actualizat: ${
    stockUpdatedAt ? new Date(stockUpdatedAt).toLocaleTimeString("ro-RO") : "indisponibil"
  }`;
  searchInput.focus();
}

init();

setInterval(async () => {
  await loadStock();
  if (searchInput.value) performSearch(searchInput.value);
}, 120000);
