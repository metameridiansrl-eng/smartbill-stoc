// api/stock.js
//
// Functie serverless (Vercel). Ruleaza DOAR pe server, niciodata in browser.
// Foloseste email + token SmartBill din variabilele de mediu (Environment
// Variables), asa ca acestea nu ajung niciodata in codul public de pe GitHub.
//
// Vânzătorii nu apeleaza niciodata SmartBill direct - browserul lor apeleaza
// doar /api/stock (acest fisier), iar acesta vorbeste cu SmartBill folosind
// tokenul ascuns.

export default async function handler(req, res) {
  const { SMARTBILL_EMAIL, SMARTBILL_TOKEN, SMARTBILL_CIF } = process.env;

  if (!SMARTBILL_EMAIL || !SMARTBILL_TOKEN || !SMARTBILL_CIF) {
    res.status(500).json({
      error: "Lipsesc variabilele de mediu SMARTBILL_EMAIL / SMARTBILL_TOKEN / SMARTBILL_CIF pe server.",
    });
    return;
  }

  try {
    const auth = Buffer.from(`${SMARTBILL_EMAIL}:${SMARTBILL_TOKEN}`).toString("base64");

    const today = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams({ cif: SMARTBILL_CIF, date: today });
    // Optional: filtreaza pe o singura gestiune daca ai mai multe.
    // params.set("warehouseName", "Showroom Promenada");

    const url = `https://ws.smartbill.ro/SBORO/api/stocks?${params.toString()}`;

    const sbResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    const text = await sbResponse.text();

    if (!sbResponse.ok) {
      res.status(sbResponse.status).json({
        error: "SmartBill a returnat o eroare.",
        detail: text.slice(0, 500),
      });
      return;
    }

    const data = JSON.parse(text);

    // Normalizam raspunsul intr-o forma simpla: { "COD-SKU": cantitate, ... }
    // Structura exacta returnata de SmartBill poate varia usor; de aceea
    // cautam mai multe nume posibile de camp pentru cod si cantitate.
        const warehouseGroups = Array.isArray(data.list) ? data.list : [];

    const stockMap = {};
    for (const group of warehouseGroups) {
      const items = group.products || [];
      for (const item of items) {
        const code = item.productCode || item.code;
        const qty = item.quantity ?? 0;
        if (code) {
          const key = String(code).trim().toUpperCase();
          stockMap[key] = (stockMap[key] || 0) + Number(qty);
        }
      }
    }

    // Cache scurt la nivel de CDN (60s) - suficient pentru cautari in magazin,
    // dar tot pare "live" pentru vanzatori.
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    res.status(200).json({ stock: stockMap, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Eroare la interogarea SmartBill.", detail: String(err) });
  }
}
