// Database IndexedDB con Dexie.js
const db = new Dexie('HACCPProDB');

db.version(1).stores({
  azienda:             'id, ragioneSociale',
  frigoriferi:         '++id, nome, tipo, attivo',
  temperature:         '++id, frigoId, dataOra',
  tracciabilita:       '++id, prodotto, data, fornitore, lotto',
  pulizieGiornaliere:  '++id, data',
  pulizieSettimanali:  '++id, data',
  licenza:             'id, codice'
});

// v2: aggiunta tabella tracciabilità interna (produzioni)
db.version(2).stores({
  tracciabilitaInterna: '++id, nome, dataPreparazione, dataScadenza, lottoInterno'
});
