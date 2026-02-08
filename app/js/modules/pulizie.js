// ====== Modulo Pulizie ======
const Pulizie = (() => {

  const areeGiornaliere = ['attrezzature', 'pianiLavoro', 'lavelli', 'cestini', 'pavimenti', 'sanitari'];
  const areeSettimanali = ['cellaFrigo', 'rubinetterie', 'interruttori', 'mensole', 'maniglie', 'zanzariere'];

  function initTabs() {
    document.getElementById('tab-pul-d').addEventListener('click', () => switchTab('d'));
    document.getElementById('tab-pul-w').addEventListener('click', () => switchTab('w'));
  }

  function switchTab(t) {
    if (t === 'd') {
      document.getElementById('pul-form-d').style.display = 'block';
      document.getElementById('pul-form-w').style.display = 'none';
      document.getElementById('tab-pul-d').classList.add('on');
      document.getElementById('tab-pul-w').classList.remove('on');
    } else {
      document.getElementById('pul-form-d').style.display = 'none';
      document.getElementById('pul-form-w').style.display = 'block';
      document.getElementById('tab-pul-d').classList.remove('on');
      document.getElementById('tab-pul-w').classList.add('on');
    }
  }

  async function salvaGiornaliera() {
    const data = document.getElementById('pul-d-data').value;
    const firma = document.getElementById('pul-d-firma').value.trim();

    if (!data) { App.toast('Inserisci la data'); return; }
    if (!firma) { App.toast('Inserisci la firma'); return; }

    // Demo limit check
    if (!(await License.canAddPulizia())) {
      const lim = License.getLimits();
      App.toast(`Demo: max ${lim.maxPulDays} giorni di dati. Attiva la licenza.`);
      return;
    }

    const valori = {};
    areeGiornaliere.forEach(area => {
      valori[area] = document.getElementById(`pul-d-${area}`).value;
    });

    await db.pulizieGiornaliere.add({
      data,
      valori,
      firma,
      creatoIl: new Date().toISOString()
    });

    // Reset
    document.getElementById('pul-d-firma').value = '';
    areeGiornaliere.forEach(area => {
      document.getElementById(`pul-d-${area}`).value = 'Eseguito';
    });

    await renderStorico();
    App.toast('Pulizia giornaliera salvata');
  }

  async function salvaSettimanale() {
    const data = document.getElementById('pul-w-data').value;
    const ora = document.getElementById('pul-w-ora').value;
    const firma = document.getElementById('pul-w-firma').value.trim();

    if (!data) { App.toast('Inserisci la data'); return; }
    if (!firma) { App.toast('Inserisci la firma'); return; }

    // Demo limit check
    if (!(await License.canAddPulizia())) {
      const lim = License.getLimits();
      App.toast(`Demo: max ${lim.maxPulDays} giorni di dati. Attiva la licenza.`);
      return;
    }

    const valori = {};
    areeSettimanali.forEach(area => {
      valori[area] = document.getElementById(`pul-w-${area}`).value;
    });

    await db.pulizieSettimanali.add({
      data,
      ora,
      valori,
      firma,
      creatoIl: new Date().toISOString()
    });

    // Reset
    document.getElementById('pul-w-firma').value = '';
    document.getElementById('pul-w-ora').value = '';
    areeSettimanali.forEach(area => {
      document.getElementById(`pul-w-${area}`).value = 'Eseguito';
    });

    await renderStorico();
    App.toast('Pulizia settimanale salvata');
  }

  async function renderStorico() {
    const giorn = await db.pulizieGiornaliere.orderBy('data').reverse().limit(10).toArray();
    const sett = await db.pulizieSettimanali.orderBy('data').reverse().limit(10).toArray();

    const el = document.getElementById('pul-storico');

    if (!giorn.length && !sett.length) {
      el.innerHTML = '<div class="empty-state"><span class="emoji">🧹</span><p>Nessuna pulizia registrata</p></div>';
      return;
    }

    let html = '';

    if (giorn.length) {
      html += `
        <div style="font-size:13px;font-weight:700;color:var(--text-sec);margin-bottom:8px;">Giornaliere</div>
        <table class="stbl">
          <thead><tr><th>Data</th><th>Firma</th><th>Stato</th></tr></thead>
          <tbody>
            ${giorn.map(r => {
              const d = new Date(r.data);
              const dateStr = d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
              const allDone = Object.values(r.valori).every(v => v === 'Eseguito');
              const pillClass = allDone ? 'ok' : 'al';
              const pillText = allDone ? '✓' : '!';
              return `<tr><td>${dateStr}</td><td>${r.firma}</td><td><span class="pill ${pillClass}">${pillText}</span></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    if (sett.length) {
      html += `
        <div style="font-size:13px;font-weight:700;color:var(--text-sec);margin:16px 0 8px;">Settimanali</div>
        <table class="stbl">
          <thead><tr><th>Data</th><th>Firma</th><th>Stato</th></tr></thead>
          <tbody>
            ${sett.map(r => {
              const d = new Date(r.data);
              const dateStr = d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
              const allDone = Object.values(r.valori).every(v => v === 'Eseguito');
              const pillClass = allDone ? 'ok' : 'al';
              const pillText = allDone ? '✓' : '!';
              return `<tr><td>${dateStr}</td><td>${r.firma}</td><td><span class="pill ${pillClass}">${pillText}</span></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    el.innerHTML = html;
  }

  async function countToday() {
    const today = new Date().toISOString().slice(0, 10);
    const g = await db.pulizieGiornaliere.toArray();
    const s = await db.pulizieSettimanali.toArray();
    return g.filter(r => r.data === today).length + s.filter(r => r.data === today).length;
  }

  async function getRecent(limit = 5) {
    const g = await db.pulizieGiornaliere.orderBy('data').reverse().limit(limit).toArray();
    const s = await db.pulizieSettimanali.orderBy('data').reverse().limit(limit).toArray();
    // Merge and sort
    const all = [
      ...g.map(r => ({ ...r, tipo: 'giornaliera' })),
      ...s.map(r => ({ ...r, tipo: 'settimanale' }))
    ];
    all.sort((a, b) => (b.creatoIl || b.data).localeCompare(a.creatoIl || a.data));
    return all.slice(0, limit);
  }

  function init() {
    initTabs();
    document.getElementById('btn-pul-d-salva').addEventListener('click', salvaGiornaliera);
    document.getElementById('btn-pul-w-salva').addEventListener('click', salvaSettimanale);
    // Set default dates
    document.getElementById('pul-d-data').valueAsDate = new Date();
    document.getElementById('pul-w-data').valueAsDate = new Date();
  }

  return { init, renderStorico, countToday, getRecent };
})();
