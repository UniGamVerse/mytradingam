# MyTradinGam — Portfolio Desk

Portfolio tracker personale con Firebase, prezzi live da Google Sheet, engine FIFO e supporto fondi comuni.

## Struttura del progetto

```
index.html          — HTML + caricamento moduli
css/
  style.css         — tutti gli stili
js/
  state.js          — variabili globali condivise
  format.js         — funzioni f(), fe(), fp(), cc()
  firebase.js       — config Firebase, auth Google, save/load
  engine.js         — FIFO azioni, CAGR, split/raggruppamento
  fondi.js          — engine FIFO fondi comuni, modal, render
  prices.js         — feed prezzi Google Sheet (JSONP), alert loop
  render.js         — tutte le funzioni renderXxxPanel()
  ui.js             — tabs, toast, theme, form addOp(), simulatore, import/export
guida.html          — guida utente (file separato)
```

## Bug corretto: Split / Raggruppamento

**Problema:** selezionando SPLIT/RAGGRUPPAMENTO, i campi `Quantità` e `Prezzo` venivano nascosti dall'UI ma la funzione `addOp()` li validava comunque (NaN / empty), bloccando l'operazione con errore prima ancora di raggiungere la logica split.

**Fix in `js/ui.js`:**
- La gestione del tipo `split` è stata anticipata **prima** della validazione `qty`/`price`
- Il campo `Quantità` viene ora nascosto (non solo `Prezzo` e `Commissioni`) quando si seleziona SPLIT
- Il toast differenzia tra "Split" (ratio ≥ 1) e "Raggruppamento" (ratio < 1)

## Come inserire un raggruppamento (reverse split)
Esempio: raggruppamento 10:1 (10 azioni → 1)
- Tipo: SPLIT / RAGGRUPPAMENTO
- Rapporto: `0.1` (= 1/10)

L'applicazione moltiplicherà le quantità × 0.1 e dividerà i prezzi per 0.1 su tutte le operazioni storiche.

## Prezzi live
Configurare `APPS_SCRIPT_URL` in `js/prices.js` con l'URL del proprio Google Apps Script.

## Deploy su GitHub Pages
```
git add .
git commit -m "refactor: split in moduli JS separati + fix split/raggruppamento"
git push
```
