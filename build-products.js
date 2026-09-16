// scripts/build-products.js
//
// Ruleaza AUTOMAT de catre Vercel la fiecare publicare (vezi "build" in
// package.json). Citeste source-data/BAZA_DE_DATE.xlsx si scrie
// public/data/products.json - fisierul pe care il incarca site-ul.
//
// Nu trebuie rulat manual: e suficient sa inlocuiesti fisierul Excel
// din source-data/ (direct pe GitHub, prin upload) si sa dai commit -
// Vercel face restul singur.

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "source-data", "BAZA_DE_DATE.xlsx");
const OUT = path.join(__dirname, "..", "public", "data", "products.json");

if (!fs.existsSync(SRC)) {
  console.error(`Nu am gasit ${SRC}. Urca BAZA_DE_DATE.xlsx in folderul source-data/ din repo.`);
  process.exit(1);
}

const workbook = XLSX.readFile(SRC);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const products = rows
  .filter((r) => r["COD SKU"])
  .map((r) => {
    const rec = { ...r };
    rec["COD SKU"] = String(rec["COD SKU"]).trim().toUpperCase();
    for (const key of Object.keys(rec)) {
      if (rec[key] === null || rec[key] === undefined) rec[key] = "";
    }
    return rec;
  });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(products));

console.log(`OK: ${products.length} produse scrise in public/data/products.json`);
