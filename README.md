# Căutare stoc (SmartBill + baza de date proprie)

Aplicație web de căutare pentru vânzători din magazin: introduc orice
(cod, denumire, culoare, brand) și văd instant **stocul curent din
SmartBill** îmbogățit cu toate coloanele din `BAZA_DE_DATE.xlsx`
(preț achiziție, familie, descriere etc.), pe care SmartBill nu le are.

Legătura între cele două surse se face prin **COD SKU**.

## Cum funcționează (arhitectura, pe scurt)

- `public/` — pagina pe care o deschid vânzătorii (căutare + rezultate). Nu conține niciun secret.
- `data/products.json` — baza ta de date, convertită din Excel. Nu e secretă (e catalogul tău de produse), poate sta liniștit în repo.
- `api/stock.js` — singurul loc care vorbește cu SmartBill. Rulează pe server (Vercel), folosește tokenul din variabilele de mediu, și browserul vânzătorilor nu îl vede niciodată.

**De ce nu punem tokenul direct în pagină:** oricine ar deschide pagina ar putea vedea codul sursă din browser (View Source / DevTools) și ar putea extrage tokenul, obținând acces complet la contul tău SmartBill. De asta stocul trece printr-un mic "intermediar" (`api/stock.js`) care ascunde tokenul pe server.

## Pas cu pas: publicare pe internet, gratuit

### 1. Urcă proiectul pe GitHub

```bash
cd smartbill-stoc
git init
git add .
git commit -m "Prima versiune"
```

Creează un repo nou pe [github.com/new](https://github.com/new) (poate fi public — nu conține secrete) și urmează instrucțiunile afișate acolo pentru `git remote add` + `git push`.

### 2. Conectează-l la Vercel (găzduire gratuită)

1. Intră pe [vercel.com](https://vercel.com) și autentifică-te cu contul de GitHub.
2. **Add New → Project**, alege repo-ul `smartbill-stoc`.
3. Lasă setările implicite și apasă **Deploy**.

### 3. Adaugă tokenul SmartBill ca variabilă de mediu (aici, nu în cod!)

În proiectul din Vercel: **Settings → Environment Variables** și adaugi trei valori:

| Nume | Valoare |
|---|---|
| `SMARTBILL_EMAIL` | `romeo@onzeagency.com` |
| `SMARTBILL_TOKEN` | tokenul tău din SmartBill (Contul meu → Integrări → API) |
| `SMARTBILL_CIF` | `RO55194125` |

Apoi **Redeploy** (Vercel îți cere asta automat după ce salvezi variabilele).

### 4. Gata

Vercel îți dă un link de tipul `https://smartbill-stoc.vercel.app` — acela e site-ul pe care vânzătorii îl deschid de pe telefon sau tabletă (poate fi salvat ca shortcut pe ecranul de start, ca o aplicație).

## Când actualizezi baza de date

De câte ori modifici `BAZA_DE_DATE.xlsx` (produse noi, prețuri noi etc.):

```bash
cd scripts
pip install openpyxl
python3 convert_products.py BAZA_DE_DATE.xlsx ../data/products.json
cd ..
git add data/products.json
git commit -m "Actualizare produse"
git push
```

Vercel republică automat site-ul la fiecare `push`.

Stocul (cantitățile) se actualizează singur, live, direct din SmartBill — nu trebuie să faci nimic pentru asta.

## De verificat la prima testare

Am construit `api/stock.js` pe baza documentației publice SmartBill pentru
endpoint-ul de stocuri (`GET /stocks`), dar numele exacte ale câmpurilor din
răspunsul JSON (`productCode`, `quantity` etc.) pot să difere puțin în
practică. Când faci primul test:

1. Deschide site-ul, apasă F12 (unelte dezvoltator) → tab **Network** → caută cererea către `/api/stock`.
2. Verifică dacă `stock` conține coduri și cantități care arată corect.
3. Dacă e gol sau greșit, trimite-mi ce apare acolo și ajustez maparea din `api/stock.js` în două minute.

## Securitate — de reținut

- Tokenul tău a fost vizibil într-un screenshot trimis în chat. Nu e nicio
  urgență, dar dacă vrei liniște completă, poți oricând să-l **regenerezi**
  din SmartBill Cloud → Contul meu → Integrări → API (butonul ↺ de lângă
  token) și să pui noul token în Vercel.
- Nu adăuga niciodată `.env` sau `.env.local` cu valori reale în `git add` — sunt deja excluse prin `.gitignore`, dar verifică oricând ai dubii cu `git status`.
