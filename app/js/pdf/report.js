// ====== Modulo Report PDF ======
// Dipendenze: jsPDF (window.jspdf), jsPDF-AutoTable, Dexie db, Impostazioni
const HACCPReport = (() => {

  const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  // Colori RGB
  const C_ACCENT     = [196, 93, 44];
  const C_ACCENT_DK  = [139, 58, 27];
  const C_WHITE      = [255, 255, 255];
  const C_TEXT        = [44, 24, 16];
  const C_TEXT_SEC    = [107, 94, 85];
  const C_TEXT_MUT    = [168, 155, 145];
  const C_GREEN       = [14, 124, 107];
  const C_GREEN_BG    = [230, 247, 244];
  const C_RED         = [196, 30, 58];
  const C_RED_BG      = [255, 235, 235];
  const C_ROW_ALT     = [251, 249, 246];

  const PW = 210; // A4 width mm
  const PH = 297; // A4 height mm
  const ML = 14;  // margin left
  const MR = 14;  // margin right
  const MT = 28;  // margin top (space for header)
  const MB = 20;  // margin bottom (space for footer)
  const CW = PW - ML - MR; // content width

  // ─────────── Helpers ───────────

  function newDoc() {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  }

  function localDate(iso) {
    const d = new Date(iso);
    return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), h: d.getHours(), min: d.getMinutes() };
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDate(iso) {
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  }

  function fmtDateShort(iso) {
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ─────────── Dati dal DB ───────────

  async function fetchData(anno, mese) {
    const azienda = await Impostazioni.getAzienda() || {};
    const frigoriferi = await Impostazioni.getFrigoriferi();

    const allTemp = await db.temperature.toArray();
    const temperature = allTemp.filter(r => {
      if (!r.dataOra) return false;
      const d = new Date(r.dataOra);
      return d.getFullYear() === anno && d.getMonth() === mese;
    });

    const allTracc = await db.tracciabilita.toArray();
    const prefix = `${anno}-${pad(mese + 1)}`;
    const tracciabilita = allTracc.filter(r => r.data && r.data.startsWith(prefix));

    const allPG = await db.pulizieGiornaliere.toArray();
    const pulGiorn = allPG.filter(r => r.data && r.data.startsWith(prefix));

    const allPS = await db.pulizieSettimanali.toArray();
    const pulSett = allPS.filter(r => r.data && r.data.startsWith(prefix));

    const allTraccInt = await db.tracciabilitaInterna.toArray();
    const tracciabilitaInterna = allTraccInt.filter(r => r.dataPreparazione && r.dataPreparazione.startsWith(prefix));

    return {
      azienda, frigoriferi, temperature, tracciabilita, tracciabilitaInterna, pulGiorn, pulSett,
      anno, mese, meseNome: MESI[mese],
      periodo: `${MESI[mese]} ${anno}`
    };
  }

  // ─────────── Header / Footer disegnati su ogni pagina ───────────

  function drawPageHeader(doc, azienda, periodo) {
    doc.setFillColor(...C_ACCENT);
    doc.rect(0, 0, PW, 22, 'F');
    // Decorative circle
    doc.setFillColor(255, 255, 255, 0);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.circle(PW - 20, 11, 30); // subtle decorative
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);

    doc.setTextColor(...C_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('HACCP Pro \u2014 Report Autocontrollo', ML, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const sub = `${azienda.ragioneSociale || 'Azienda'} \u2014 ${periodo}`;
    doc.text(sub, ML, 16);
  }

  function drawPageFooter(doc, pageNum, totalPages, azienda) {
    const year = new Date().getFullYear();
    const copy = `\u00A9 ${year} ${azienda.responsabile || azienda.ragioneSociale || 'HACCP Pro'} \u2014 Powered by HACCP Pro`;
    doc.setDrawColor(...C_ACCENT);
    doc.setLineWidth(0.4);
    doc.line(ML, PH - MB + 2, PW - MR, PH - MB + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_TEXT_MUT);
    doc.text(copy, ML, PH - MB + 7);
    doc.text(`Pagina ${pageNum}`, PW - MR, PH - MB + 7, { align: 'right' });
  }

  function applyHeadersFooters(doc, azienda, periodo, skipPage1) {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      if (skipPage1 && i === 1) continue; // frontespizio has its own layout
      drawPageHeader(doc, azienda, periodo);
      drawPageFooter(doc, i, total, azienda);
    }
  }

  // ─────────── Frontespizio ───────────

  function addFrontespizio(doc, data) {
    const az = data.azienda;
    const now = new Date();

    // Top accent bar
    doc.setFillColor(...C_ACCENT);
    doc.rect(0, 0, PW, 52, 'F');
    // Decorative gradient overlay
    doc.setFillColor(...C_ACCENT_DK);
    doc.rect(0, 40, PW, 12, 'F');

    // Title in bar
    doc.setTextColor(...C_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('HACCP Pro', PW / 2, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Autocontrollo Alimentare', PW / 2, 32, { align: 'center' });

    // Report title
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Report Mensile di Autocontrollo', PW / 2, 72, { align: 'center' });

    // Period
    doc.setTextColor(...C_ACCENT);
    doc.setFontSize(22);
    doc.text(data.periodo, PW / 2, 86, { align: 'center' });

    // Divider
    doc.setDrawColor(...C_ACCENT);
    doc.setLineWidth(0.8);
    doc.line(ML + 40, 95, PW - MR - 40, 95);

    // Company info
    let y = 110;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(az.ragioneSociale || 'Azienda', PW / 2, y, { align: 'center' });

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C_TEXT_SEC);

    if (az.indirizzo) {
      doc.text(`Indirizzo: ${az.indirizzo}`, PW / 2, y, { align: 'center' });
      y += 7;
    }

    const pivaTel = [
      az.piva ? `P.IVA: ${az.piva}` : null,
      az.telefono ? `Tel: ${az.telefono}` : null
    ].filter(Boolean).join('    |    ');
    if (pivaTel) {
      doc.text(pivaTel, PW / 2, y, { align: 'center' });
      y += 7;
    }

    if (az.tipo) {
      doc.text(`Tipologia: ${az.tipo}`, PW / 2, y, { align: 'center' });
      y += 7;
    }

    if (az.responsabile) {
      doc.text(`Responsabile HACCP: ${az.responsabile}`, PW / 2, y, { align: 'center' });
      y += 7;
    }

    // Contents
    y = 175;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Contenuto del Report', PW / 2, y, { align: 'center' });

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...C_TEXT_SEC);
    const sections = [
      '1. Scheda Registrazione Temperature',
      '2. Scheda Rintracciabilit\u00E0 Materie Prime',
      '3. Scheda Tracciabilit\u00E0 Interna \u2014 Produzioni',
      '4. Scheda Pulizia e Sanificazione Giornaliera',
      '5. Scheda Pulizia e Sanificazione Settimanale'
    ];
    sections.forEach(s => {
      doc.text(s, PW / 2, y, { align: 'center' });
      y += 8;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...C_TEXT_MUT);
    const genDate = `Documento generato il ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} alle ${pad(now.getHours())}:${pad(now.getMinutes())} \u2014 HACCP Pro v1.0`;
    doc.text(genDate, PW / 2, PH - 22, { align: 'center' });

    const year = now.getFullYear();
    const copy = `\u00A9 ${year} ${az.responsabile || az.ragioneSociale || ''} \u2014 Tutti i diritti riservati`;
    doc.text(copy, PW / 2, PH - 15, { align: 'center' });
  }

  // ─────────── Sezione 1: Temperature ───────────

  function addTemperature(doc, data, sectionNum) {
    const frigos = data.frigoriferi;
    const records = data.temperature;
    const num = sectionNum || '1';

    // Section title
    let y = MT + 4;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${num}. Registro Temperature`, ML, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Periodo: ${data.periodo} \u2014 Rilevazioni giornaliere`, ML, y);
    y += 8;

    if (!frigos.length || !records.length) {
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT_MUT);
      doc.text('Nessuna registrazione per questo periodo.', ML, y);
      return;
    }

    // Units summary table
    const unitHead = [['Unit\u00E0', 'Tipo', 'Min (\u00B0C)', 'Max (\u00B0C)']];
    const unitBody = frigos.map(f => [f.nome, f.tipo, String(f.limiteMin), String(f.limiteMax)]);

    doc.autoTable({
      startY: y,
      margin: { top: MT, bottom: MB + 2, left: ML, right: MR },
      head: unitHead,
      body: unitBody,
      theme: 'grid',
      headStyles: { fillColor: C_ACCENT, textColor: C_WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_TEXT, lineColor: [221, 213, 203], lineWidth: 0.3 },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: 'wrap'
    });

    y = doc.lastAutoTable.finalY + 8;

    // Group temperature records by day
    const byDay = {};
    records.forEach(r => {
      const d = new Date(r.dataOra);
      const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if (!byDay[key]) byDay[key] = {};
      // Keep last reading per fridge per day
      byDay[key][r.frigoId] = r;
    });

    const dayKeys = Object.keys(byDay).sort();

    // Build table
    const frigoNames = frigos.map(f => f.nome);
    const head = [['Data', 'Ora'].concat(frigoNames).concat(['Esito'])];
    const body = [];
    let conformi = 0;
    let nonConformi = 0;

    dayKeys.forEach(dayKey => {
      const dayRecs = byDay[dayKey];
      // Find representative time (earliest record of the day)
      let earliest = null;
      Object.values(dayRecs).forEach(r => {
        if (!earliest || r.dataOra < earliest.dataOra) earliest = r;
      });

      const dateStr = fmtDateShort(dayKey + 'T00:00:00');
      const timeStr = earliest ? fmtTime(earliest.dataOra) : '';
      const row = [dateStr, timeStr];
      let allOk = true;

      frigos.forEach(f => {
        const rec = dayRecs[f.id];
        if (rec) {
          row.push(`${rec.valore}\u00B0C`);
          if (rec.valore < f.limiteMin || rec.valore > f.limiteMax) allOk = false;
        } else {
          row.push('\u2014');
        }
      });

      row.push(allOk ? 'OK' : 'N.C.');
      if (allOk) conformi++; else nonConformi++;
      body.push(row);
    });

    // Data table with cell coloring
    doc.autoTable({
      startY: y,
      margin: { top: MT, bottom: MB + 2, left: ML, right: MR },
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: C_ACCENT, textColor: C_WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C_TEXT, halign: 'center', lineColor: [221, 213, 203], lineWidth: 0.3 },
      columnStyles: { 0: { halign: 'left', cellWidth: 18 }, 1: { cellWidth: 14 } },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      didParseCell: function(hookData) {
        if (hookData.section !== 'body') return;
        const colIdx = hookData.column.index;
        const numFrigos = frigos.length;
        // Temperature columns (index 2 to 2+numFrigos-1)
        if (colIdx >= 2 && colIdx < 2 + numFrigos) {
          const val = parseFloat(hookData.cell.raw);
          const frigoIdx = colIdx - 2;
          const f = frigos[frigoIdx];
          if (f && !isNaN(val) && (val < f.limiteMin || val > f.limiteMax)) {
            hookData.cell.styles.fillColor = C_RED_BG;
            hookData.cell.styles.textColor = C_RED;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
        // Esito column
        if (colIdx === 2 + numFrigos) {
          if (hookData.cell.raw === 'N.C.') {
            hookData.cell.styles.fillColor = C_RED_BG;
            hookData.cell.styles.textColor = C_RED;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (hookData.cell.raw === 'OK') {
            hookData.cell.styles.fillColor = C_GREEN_BG;
            hookData.cell.styles.textColor = C_GREEN;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // Riepilogo
    let fy = doc.lastAutoTable.finalY;
    if (fy > PH - MB - 15) { doc.addPage(); fy = MT + 4; }
    fy += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Riepilogo: ${dayKeys.length} rilevazioni effettuate \u2014 ${conformi} conformi \u2014 ${nonConformi} non conformi`, ML, fy);
  }

  // ─────────── Sezione 2: Tracciabilit\u00E0 ───────────

  function addTracciabilita(doc, data, sectionNum) {
    const records = data.tracciabilita;
    const num = sectionNum || '2';

    let y = MT + 4;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${num}. Rintracciabilit\u00E0 Materie Prime`, ML, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Periodo: ${data.periodo} \u2014 Registro rintracciabilit\u00E0 materie prime in entrata`, ML, y);
    y += 8;

    if (!records.length) {
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT_MUT);
      doc.text('Nessuna registrazione per questo periodo.', ML, y);
      return;
    }

    // Sort by date
    const sorted = [...records].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    const head = [['Data', 'Prodotto', 'Fornitore', 'Lotto', 'Conforme', 'Firma']];
    const body = sorted.map(r => [
      fmtDate(r.data + 'T00:00:00'),
      r.prodotto || '',
      r.fornitore || '',
      r.lotto || '',
      r.conforme ? 'SI' : 'NO',
      r.firma || ''
    ]);

    let conformi = sorted.filter(r => r.conforme).length;
    let nonConformi = sorted.length - conformi;

    doc.autoTable({
      startY: y,
      margin: { top: MT, bottom: MB + 2, left: ML, right: MR },
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: C_ACCENT, textColor: C_WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_TEXT, lineColor: [221, 213, 203], lineWidth: 0.3 },
      columnStyles: { 0: { cellWidth: 22 }, 4: { halign: 'center', cellWidth: 18 }, 5: { cellWidth: 24 } },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      didParseCell: function(hookData) {
        if (hookData.section !== 'body') return;
        if (hookData.column.index === 4) {
          if (hookData.cell.raw === 'NO') {
            hookData.cell.styles.fillColor = C_RED_BG;
            hookData.cell.styles.textColor = C_RED;
            hookData.cell.styles.fontStyle = 'bold';
          } else {
            hookData.cell.styles.fillColor = C_GREEN_BG;
            hookData.cell.styles.textColor = C_GREEN;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    let fy = doc.lastAutoTable.finalY;
    if (fy > PH - MB - 15) { doc.addPage(); fy = MT + 4; }
    fy += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Riepilogo: ${sorted.length} materie prime ricevute \u2014 ${conformi} conformi \u2014 ${nonConformi} non conformi`, ML, fy);
  }

  // ─────────── Sezione 3: Pulizie Giornaliere ───────────

  function addPulizieGiorn(doc, data, sectionNum) {
    const records = data.pulGiorn;
    const num = sectionNum || '3';
    const areeLabels = ['Attrezzature', 'Piani lavoro', 'Lavelli', 'Cestini', 'Pavimenti', 'Sanitari'];
    const areeKeys   = ['attrezzature', 'pianiLavoro', 'lavelli', 'cestini', 'pavimenti', 'sanitari'];

    let y = MT + 4;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${num}. Pulizia e Sanificazione Giornaliera`, ML, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Periodo: ${data.periodo} \u2014 Registrazione giornaliera delle operazioni di pulizia`, ML, y);
    y += 8;

    if (!records.length) {
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT_MUT);
      doc.text('Nessuna registrazione per questo periodo.', ML, y);
      return;
    }

    const sorted = [...records].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    const head = [['Data'].concat(areeLabels).concat(['Firma'])];
    const body = [];
    let totOps = 0;
    let eseguite = 0;
    let nonEseguite = 0;

    sorted.forEach(r => {
      const row = [fmtDate(r.data + 'T00:00:00')];
      areeKeys.forEach(key => {
        const val = (r.valori && r.valori[key]) || '';
        const isOk = val === 'Eseguito';
        row.push(isOk ? 'OK' : 'N.E.');
        totOps++;
        if (isOk) eseguite++; else nonEseguite++;
      });
      row.push(r.firma || '');
      body.push(row);
    });

    doc.autoTable({
      startY: y,
      margin: { top: MT, bottom: MB + 2, left: ML, right: MR },
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: C_ACCENT, textColor: C_WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C_TEXT, halign: 'center', lineColor: [221, 213, 203], lineWidth: 0.3 },
      columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 7: { cellWidth: 18 } },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      didParseCell: function(hookData) {
        if (hookData.section !== 'body') return;
        const colIdx = hookData.column.index;
        if (colIdx >= 1 && colIdx <= 6) {
          if (hookData.cell.raw === 'N.E.') {
            hookData.cell.styles.fillColor = C_RED_BG;
            hookData.cell.styles.textColor = C_RED;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // Riepilogo + legenda
    let fy = doc.lastAutoTable.finalY;
    if (fy > PH - MB - 22) { doc.addPage(); fy = MT + 4; }
    fy += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Riepilogo: ${totOps} operazioni \u2014 ${eseguite} eseguite \u2014 ${nonEseguite} non eseguite`, ML, fy);
    fy += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_TEXT_MUT);
    doc.text('OK = Pulizia eseguita e conforme | N.E. = Non eseguita', ML, fy);
  }

  // ─────────── Sezione 4: Pulizie Settimanali ───────────

  function addPulizieSett(doc, data, sectionNum) {
    const records = data.pulSett;
    const num = sectionNum || '4';
    const areeLabels = ['Cella frigo', 'Rubinetterie', 'Interruttori', 'Mensole', 'Maniglie', 'Zanzariere'];
    const areeKeys   = ['cellaFrigo', 'rubinetterie', 'interruttori', 'mensole', 'maniglie', 'zanzariere'];

    let y = MT + 4;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${num}. Pulizia e Sanificazione Settimanale`, ML, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Periodo: ${data.periodo} \u2014 Registrazione settimanale delle operazioni di pulizia approfondita`, ML, y);
    y += 8;

    if (!records.length) {
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT_MUT);
      doc.text('Nessuna registrazione per questo periodo.', ML, y);
      return;
    }

    const sorted = [...records].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

    const head = [['Data', 'Ora'].concat(areeLabels).concat(['Firma'])];
    const body = [];
    let totOps = 0;
    let eseguite = 0;
    let nonEseguite = 0;

    sorted.forEach(r => {
      const row = [fmtDate(r.data + 'T00:00:00'), r.ora || ''];
      areeKeys.forEach(key => {
        const val = (r.valori && r.valori[key]) || '';
        const isOk = val === 'Eseguito';
        row.push(isOk ? 'OK' : 'N.E.');
        totOps++;
        if (isOk) eseguite++; else nonEseguite++;
      });
      row.push(r.firma || '');
      body.push(row);
    });

    doc.autoTable({
      startY: y,
      margin: { top: MT, bottom: MB + 2, left: ML, right: MR },
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: C_ACCENT, textColor: C_WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: C_TEXT, halign: 'center', lineColor: [221, 213, 203], lineWidth: 0.3 },
      columnStyles: { 0: { halign: 'left', cellWidth: 22 }, 1: { cellWidth: 14 }, 8: { cellWidth: 18 } },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      didParseCell: function(hookData) {
        if (hookData.section !== 'body') return;
        const colIdx = hookData.column.index;
        if (colIdx >= 2 && colIdx <= 7) {
          if (hookData.cell.raw === 'N.E.') {
            hookData.cell.styles.fillColor = C_RED_BG;
            hookData.cell.styles.textColor = C_RED;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // Riepilogo
    let fy = doc.lastAutoTable.finalY;
    if (fy > PH - MB - 28) { doc.addPage(); fy = MT + 4; }
    fy += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Riepilogo: ${totOps} operazioni \u2014 ${eseguite} eseguite \u2014 ${nonEseguite} non eseguite`, ML, fy);

    // Signature lines at bottom
    fy += 14;
    if (fy > PH - MB - 15) { doc.addPage(); fy = MT + 10; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C_TEXT);
    doc.text('Data: ____________________', ML, fy);
    fy += 10;
    doc.text('Firma Responsabile HACCP: ____________________', ML, fy);
  }

  // ─────────── Sezione 5: Tracciabilità Interna ───────────

  function addTracciabilitaInterna(doc, data, sectionNum) {
    const records = data.tracciabilitaInterna;
    const num = sectionNum || '3';

    let y = MT + 4;
    doc.setTextColor(...C_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${num}. Tracciabilit\u00E0 Interna \u2014 Produzioni`, ML, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Periodo: ${data.periodo} \u2014 Registro preparazioni e produzioni interne`, ML, y);
    y += 8;

    if (!records.length) {
      doc.setFontSize(10);
      doc.setTextColor(...C_TEXT_MUT);
      doc.text('Nessuna registrazione per questo periodo.', ML, y);
      return;
    }

    const sorted = [...records].sort((a, b) => (a.dataPreparazione || '').localeCompare(b.dataPreparazione || ''));

    const head = [['Data Prep.', 'Preparazione', 'Ingredienti', 'Scadenza', 'Lotto', 'Qt\u00E0', 'Conserv.', 'Firma']];
    const body = sorted.map(r => [
      r.dataPreparazione ? fmtDate(r.dataPreparazione + 'T00:00:00') : '',
      r.nome || '',
      r.ingredienti || '',
      r.dataScadenza ? fmtDate(r.dataScadenza + 'T00:00:00') : '',
      r.lottoInterno || '',
      r.quantita || '',
      r.luogoConservazione || '',
      r.firma || ''
    ]);

    doc.autoTable({
      startY: y,
      margin: { top: MT, bottom: MB + 2, left: ML, right: MR },
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: C_ACCENT, textColor: C_WHITE, fontStyle: 'bold', fontSize: 7, cellPadding: 2.5 },
      styles: { fontSize: 7, cellPadding: 2, textColor: C_TEXT, lineColor: [221, 213, 203], lineWidth: 0.3 },
      columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 32 }, 3: { cellWidth: 20 }, 7: { cellWidth: 18 } },
      alternateRowStyles: { fillColor: C_ROW_ALT }
    });

    let fy = doc.lastAutoTable.finalY;
    if (fy > PH - MB - 15) { doc.addPage(); fy = MT + 4; }
    fy += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C_TEXT_SEC);
    doc.text(`Riepilogo: ${sorted.length} produzioni registrate`, ML, fy);
  }

  // ─────────── Generatori PDF pubblici ───────────

  function savePdf(doc, filename) {
    doc.save(filename);
  }

  async function pdfTemperature(anno, mese) {
    if (!(await License.canExportPDF())) { App.toast('Attiva la licenza per esportare PDF'); return; }
    const data = await fetchData(anno, mese);
    if (!data.temperature.length) { App.toast('Nessuna temperatura registrata per questo periodo'); return; }
    const doc = newDoc();
    addTemperature(doc, data, '1');
    applyHeadersFooters(doc, data.azienda, data.periodo, false);
    savePdf(doc, `HACCP_Temperature_${data.meseNome}_${anno}.pdf`);
    App.toast('PDF Temperature generato');
  }

  async function pdfTracciabilita(anno, mese) {
    if (!(await License.canExportPDF())) { App.toast('Attiva la licenza per esportare PDF'); return; }
    const data = await fetchData(anno, mese);
    if (!data.tracciabilita.length) { App.toast('Nessuna rintracciabilit\u00E0 registrata per questo periodo'); return; }
    const doc = newDoc();
    addTracciabilita(doc, data, '1');
    applyHeadersFooters(doc, data.azienda, data.periodo, false);
    savePdf(doc, `HACCP_Rintracciabilita_${data.meseNome}_${anno}.pdf`);
    App.toast('PDF Rintracciabilit\u00E0 generato');
  }

  async function pdfTracciabilitaInterna(anno, mese) {
    if (!(await License.canExportPDF())) { App.toast('Attiva la licenza per esportare PDF'); return; }
    const data = await fetchData(anno, mese);
    if (!data.tracciabilitaInterna.length) { App.toast('Nessuna produzione registrata per questo periodo'); return; }
    const doc = newDoc();
    addTracciabilitaInterna(doc, data, '1');
    applyHeadersFooters(doc, data.azienda, data.periodo, false);
    savePdf(doc, `HACCP_TraccInterna_${data.meseNome}_${anno}.pdf`);
    App.toast('PDF Tracciabilit\u00E0 Interna generato');
  }

  async function pdfPulizieGiorn(anno, mese) {
    if (!(await License.canExportPDF())) { App.toast('Attiva la licenza per esportare PDF'); return; }
    const data = await fetchData(anno, mese);
    if (!data.pulGiorn.length) { App.toast('Nessuna pulizia giornaliera registrata per questo periodo'); return; }
    const doc = newDoc();
    addPulizieGiorn(doc, data, '1');
    applyHeadersFooters(doc, data.azienda, data.periodo, false);
    savePdf(doc, `HACCP_Pulizie_Giorn_${data.meseNome}_${anno}.pdf`);
    App.toast('PDF Pulizie Giornaliere generato');
  }

  async function pdfPulizieSett(anno, mese) {
    if (!(await License.canExportPDF())) { App.toast('Attiva la licenza per esportare PDF'); return; }
    const data = await fetchData(anno, mese);
    if (!data.pulSett.length) { App.toast('Nessuna pulizia settimanale registrata per questo periodo'); return; }
    const doc = newDoc();
    addPulizieSett(doc, data, '1');
    applyHeadersFooters(doc, data.azienda, data.periodo, false);
    savePdf(doc, `HACCP_Pulizie_Sett_${data.meseNome}_${anno}.pdf`);
    App.toast('PDF Pulizie Settimanali generato');
  }

  async function pdfCompleto(anno, mese) {
    if (!(await License.canExportPDF())) { App.toast('Attiva la licenza per esportare PDF'); return; }
    const data = await fetchData(anno, mese);
    const hasAny = data.temperature.length || data.tracciabilita.length || data.tracciabilitaInterna.length || data.pulGiorn.length || data.pulSett.length;
    if (!hasAny) { App.toast('Nessun dato registrato per questo periodo'); return; }

    const doc = newDoc();

    // Page 1: Frontespizio
    addFrontespizio(doc, data);

    // Page 2+: Temperature
    doc.addPage();
    addTemperature(doc, data, '1');

    // New page: Rintracciabilit\u00E0
    doc.addPage();
    addTracciabilita(doc, data, '2');

    // New page: Tracciabilit\u00E0 Interna
    doc.addPage();
    addTracciabilitaInterna(doc, data, '3');

    // New page: Pulizie Giornaliere
    doc.addPage();
    addPulizieGiorn(doc, data, '4');

    // New page: Pulizie Settimanali
    doc.addPage();
    addPulizieSett(doc, data, '5');

    // Apply headers/footers to all pages except frontespizio
    applyHeadersFooters(doc, data.azienda, data.periodo, true);

    savePdf(doc, `HACCP_Report_${data.meseNome}_${anno}.pdf`);
    App.toast('Report completo generato');
  }

  // ─────────── UI bindings ───────────

  function getSelectedPeriod() {
    const meseEl = document.getElementById('report-mese');
    const annoEl = document.getElementById('report-anno');
    return { mese: parseInt(meseEl.value), anno: parseInt(annoEl.value) };
  }

  function init() {
    // Populate selectors
    const meseEl = document.getElementById('report-mese');
    const annoEl = document.getElementById('report-anno');
    if (!meseEl || !annoEl) return;

    MESI.forEach((nome, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = nome;
      if (i === new Date().getMonth()) opt.selected = true;
      meseEl.appendChild(opt);
    });

    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      annoEl.appendChild(opt);
    }

    // Bind buttons
    document.getElementById('btn-pdf-temp').addEventListener('click', () => {
      const p = getSelectedPeriod(); pdfTemperature(p.anno, p.mese);
    });
    document.getElementById('btn-pdf-tracc').addEventListener('click', () => {
      const p = getSelectedPeriod(); pdfTracciabilita(p.anno, p.mese);
    });
    document.getElementById('btn-pdf-traccint').addEventListener('click', () => {
      const p = getSelectedPeriod(); pdfTracciabilitaInterna(p.anno, p.mese);
    });
    document.getElementById('btn-pdf-pul-g').addEventListener('click', () => {
      const p = getSelectedPeriod(); pdfPulizieGiorn(p.anno, p.mese);
    });
    document.getElementById('btn-pdf-pul-s').addEventListener('click', () => {
      const p = getSelectedPeriod(); pdfPulizieSett(p.anno, p.mese);
    });
    document.getElementById('btn-pdf-completo').addEventListener('click', () => {
      const p = getSelectedPeriod(); pdfCompleto(p.anno, p.mese);
    });
  }

  return { init, pdfTemperature, pdfTracciabilita, pdfTracciabilitaInterna, pdfPulizieGiorn, pdfPulizieSett, pdfCompleto };
})();
