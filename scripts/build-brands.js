const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "source-data", "contacte_branduri.xlsx");
const OUT = path.join(__dirname, "..", "public", "data", "brands.json");

if (!fs.existsSync(SRC)) {
  console.error(`Nu am gasit ${SRC}. Urca contacte_branduri.xlsx in folderul source-data/ din repo.`);
  process.exit(1);
}

const workbook = XLSX.readFile(SRC);
const sheet = workbook.Sheets["Contacte branduri"] || workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const brands = rows
  .filter((r) => r["Brand"])
  .map((r) => ({
    brand: String(r["Brand"]).trim(),
    firma: String(r["Firma"] || "").trim(),
    email: String(r["Email"] || "").trim(),
    telefon: String(r["Telefon"] || "").trim(),
    adresaSediu: String(r["Adresa sediu social"] || "").trim(),
    adresaEticheta: String(r["Adresa eticheta"] || "").trim(),
  }));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(brands));

console.log(`OK: ${brands.length} contacte de brand scrise in public/data/brands.json`);
