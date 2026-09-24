// etichete-io.js — export si import .xlsx pentru lista de etichete. Ruleaza in browser.

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const fileInput = document.getElementById("fileInput");
const ioStatus = document.getElementById("ioStatus");

function itemToRow(it) {
  return {
    "Brand": it.brand,
    "Denumire produs": it.denumire,
    "Cod Furnizor": it.codFurnizor,
    "SKU": it.sku,
    "Culoare": it.culoare,
    "Masura": it.masura,
    "Pret": it.pret,
    "Fabricat in": it.fabricat,
    "Cantitate": it.cantitate,
    "Firma": it.furnizor,
    "Adresa Furnizor": it.adresaFurnizor,
  };
}

exportBtn.addEventListener("click", () => {
  if (items.length === 0) {
    ioStatus.textContent = "Lista e goală — nu am ce exporta.";
    return;
  }
  const rows = items.map(itemToRow);
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Etichete");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, `etichete-${stamp}.xlsx`);
  ioStatus.textContent = `Exportat ${items.length} produse (${items.reduce((s, i) => s + i.cantitate, 0)} etichete).`;
});

importBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (!e.target.files.length) return;
  const file = e.target.files[0];
  ioStatus.textContent = "Se procesează " + file.name + "...";
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      let added = 0;
      rows.forEach((row) => {
        const sku = String(row["SKU"] || "").trim();
        if (!sku) return;
        const brand = String(row["Brand"] || "").trim();
        const entries = findBrandEntries(brand);
        const firmaOverride = String(row["Firma"] || "").trim();
        let match = entries.find((o) => o.firma === firmaOverride) || entries[0] || null;
        const cant = parseInt(row["Cantitate"]);
        items.push({
          brand,
          denumire: row["Denumire produs"] || "",
          codFurnizor: row["Cod Furnizor"] || "",
          culoare: row["Culoare"] || "",
          masura: row["Masura"] || "",
          sku,
          pret: row["Pret"] || "",
          fabricat: row["Fabricat in"] || "",
          furnizor: firmaOverride || (match ? match.firma : ""),
          adresaFurnizor: match ? match.adresaEticheta : (row["Adresa Furnizor"] || ""),
          firmaOptions: entries,
          cantitate: isNaN(cant) || cant < 1 ? 1 : cant,
        });
        added++;
      });
      renderList();
      ioStatus.textContent = `${file.name}: adăugate ${added} produse din import.`;
    } catch (err) {
      ioStatus.textContent = "Eroare la citirea fișierului: " + err.message;
      console.error(err);
    }
    fileInput.value = "";
  };
  reader.readAsArrayBuffer(file);
});
