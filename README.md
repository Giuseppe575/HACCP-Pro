# HACCP Pro

Autocontrollo HACCP digitale per bar, ristoranti, pizzerie e attivit&agrave; alimentari.

**PWA offline-first** — Tutti i dati restano sul tuo dispositivo. Nessun server, nessun abbonamento.

## Demo

[**Prova la Demo**](https://giuseppe575.github.io/HACCP-Pro/app/)

## Funzionalit&agrave;

- **Temperature** — Registra temperature frigoriferi con allarmi automatici
- **Tracciabilit&agrave;** — Schede lotti con fornitore e conformit&agrave;
- **Pulizie** — Checklist giornaliere e settimanali con firma operatore
- **Report PDF** — Genera report mensili conformi per controlli ASL/NAS

## Struttura

```
/                    ← Landing page (GitHub Pages root)
├── index.html       ← Home / landing page
├── acquista.html    ← Pagina acquisto
├── privacy.html     ← Privacy Policy GDPR
├── cookies.html     ← Cookie Policy
├── termini.html     ← Termini e Condizioni
├── css/style.css    ← Stili landing
├── js/              ← Cookie banner
└── app/             ← PWA HACCP Pro
    ├── index.html   ← App SPA
    ├── manifest.json
    ├── sw.js
    ├── css/         ← Stili app
    ├── js/          ← Moduli app (db, license, modules, pdf)
    └── assets/      ← Icone PWA
```

## Tech Stack

- Vanilla JS (no framework)
- IndexedDB via [Dexie.js](https://dexie.org/)
- PDF generation via [jsPDF](https://github.com/parallax/jsPDF) + [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- Service Worker per funzionamento offline
- Design: Plus Jakarta Sans, palette terracotta (#C45D2C)

## Licenza

&copy; 2026 Giuseppe Strifezza. Tutti i diritti riservati.
