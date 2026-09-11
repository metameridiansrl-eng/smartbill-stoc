#!/usr/bin/env python3
"""
Converteste BAZA_DE_DATE.xlsx in data/products.json, fisierul pe care
aplicatia il incarca in browser pentru cautare.

Ruleaza asta de fiecare data cand actualizezi BAZA_DE_DATE.xlsx:

    pip install openpyxl
    python3 scripts/convert_products.py BAZA_DE_DATE.xlsx ../data/products.json

Cheia de legatura cu stocul din SmartBill este COD SKU (trebuie sa fie
identic cu "Cod Produs" folosit in SmartBill, conform mapajului deja
stabilit in Creare_Produse.xls / Receptie.xlsx).
"""
import sys
import json
import openpyxl
from pathlib import Path

def convert(xlsx_path: str, out_path: str):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb.active

    rows = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h else "" for h in next(rows)]

    products = []
    for row in rows:
        if not any(row):
            continue
        record = dict(zip(headers, row))
        cod_sku = record.get("COD SKU")
        if not cod_sku:
            continue
        # normalizam codul (fara spatii, uppercase) ca sa se lege sigur cu SmartBill
        record["COD SKU"] = str(cod_sku).strip().upper()
        # convertim valorile None in string gol ca sa nu strice cautarea in JS
        for k, v in record.items():
            if v is None:
                record[k] = ""
        products.append(record)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False)

    print(f"OK: {len(products)} produse scrise in {out_path}")

if __name__ == "__main__":
    xlsx = sys.argv[1] if len(sys.argv) > 1 else "BAZA_DE_DATE.xlsx"
    out = sys.argv[2] if len(sys.argv) > 2 else "../data/products.json"
    convert(xlsx, out)
