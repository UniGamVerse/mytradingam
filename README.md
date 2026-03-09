# MyTradinGam — Portfolio Desk

Portfolio tracker personale con Firebase, prezzi live da Google Sheet, engine FIFO e supporto fondi comuni.

## Struttura del progetto

```
index.html          — HTML principale + caricamento moduli
guida.html          — guida utente (file separato)
style.css           — tutti gli stili (temi dark, light, warm)
state.js            — variabili globali condivise
format.js           — funzioni f(), fe(), fp(), cc(), fmtDate()
firebase.js         — config Firebase, autenticazione Google, save/load
engine.js           — FIFO azioni, CAGR, split/raggruppamento
fondi.js            — engine FIFO fondi comuni, modal, render
prices.js           — feed prezzi Google Sheet (JSONP), alert loop
render.js           — tutte le funzioni renderXxxPanel()
ui.js               — tabs, toast, theme, form addOp(), simulatore, import/export
```

## Funzionalità principali

### Azioni
- Registrazione acquisti, vendite e split/raggruppamento
- Engine FIFO per calcolo PMC e P/L realizzato
- Prezzi live da Google Apps Script
- Alert su soglie di prezzo
- Simulatore capital gain
- Modifica e cancellazione di operazioni storiche (data, ticker, quantità, prezzo, commissioni, note)
- Export CSV

### Fondi comuni
- Anagrafica fondi (nome, ISIN, società, categoria, valuta)
- Elenco fondi registrati con modifica e cancellazione indipendente dai movimenti
- Registrazione sottoscrizioni e rimborsi
- Engine FIFO per calcolo NAV medio e P/L
- Aggiornamento manuale NAV corrente con data di aggiornamento
- Modifica e cancellazione di movimenti storici (data, fondo, quote, NAV, commissioni, note)
- Export CSV

### Interfaccia
- Tre temi: Dark (blu), Light, Warm (blu con accenti arancioni)
- Date visualizzate in formato gg-mm-aaaa
- Storico patrimonio giornaliero (max 730 giorni)
- Autenticazione Google con account separati e portafogli indipendenti

## Note tecniche

### Formato date
Le date sono salvate internamente in formato ISO (`aaaa-mm-gg`) per garantire ordinamento corretto. La funzione `fmtDate()` in `format.js` converte al formato `gg-mm-aaaa` solo in fase di visualizzazione.

### NAV fondi
`fnNavs` salva il NAV aggiornato manualmente nel formato `{ val: number, date: 'aaaa-mm-gg' }`. La lettura è retrocompatibile con il vecchio formato a numero semplice.

### Split / Raggruppamento
La gestione del tipo `split` è anticipata prima della validazione `qty`/`price` in `addOp()`. Il campo Quantità viene nascosto nell'UI. Il toast differenzia tra split (ratio ≥ 1) e raggruppamento (ratio < 1).

Esempio raggruppamento 10:1: inserire rapporto `0.1`. L'app moltiplica le quantità × 0.1 e divide i prezzi per 0.1 su tutte le operazioni storiche.

### Autenticazione
Il flag `isSigningIn` in `firebase.js` previene l'apertura di popup multipli di login Google.

## Prezzi live
Configurare `APPS_SCRIPT_URL` in `prices.js` con l'URL del proprio Google Apps Script.

## Deploy su GitHub Pages
```
git add .
git commit -m "descrizione modifiche"
git push
```