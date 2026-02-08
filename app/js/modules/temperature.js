// ====== Modulo Temperature ======
const Temperature = (() => {

  async function renderForm() {
    const frigos = await Impostazioni.getFrigoriferi();
    const container = document.getElementById('temp-list');
    const btnSalva = document.getElementById('btn-temp-salva');

    if (!frigos.length) {
      container.innerHTML = '<div class="empty-state"><span class="emoji">❄️</span><p>Configura almeno un frigorifero nelle Impostazioni</p></div>';
      btnSalva.style.display = 'none';
      return;
    }

    btnSalva.style.display = 'flex';
    container.innerHTML = frigos.map(f => `
      <div class="ti" data-frigo-id="${f.id}">
        <div class="ti-top">
          <div>
            <div class="ti-name">${f.nome}</div>
            <div class="ti-type">${f.tipo} · ${f.limiteMin}°C – ${f.limiteMax}°C</div>
          </div>
        </div>
        <div class="ti-bot">
          <input type="number" step="0.1" placeholder="°C" id="temp-input-${f.id}"
                 data-min="${f.limiteMin}" data-max="${f.limiteMax}">
          <div class="pill pend" id="temp-pill-${f.id}">—</div>
        </div>
      </div>
    `).join('');

    // Real-time validation
    frigos.forEach(f => {
      const input = document.getElementById(`temp-input-${f.id}`);
      input.addEventListener('input', () => {
        const pill = document.getElementById(`temp-pill-${f.id}`);
        const val = parseFloat(input.value);
        if (isNaN(val) || input.value === '') {
          pill.className = 'pill pend';
          pill.textContent = '—';
          return;
        }
        if (val >= f.limiteMin && val <= f.limiteMax) {
          pill.className = 'pill ok';
          pill.textContent = '✓ OK';
        } else {
          pill.className = 'pill al';
          pill.textContent = '⚠ Allerta';
        }
      });
    });
  }

  async function salva() {
    const frigos = await Impostazioni.getFrigoriferi();
    if (!frigos.length) return;

    // Demo limit check
    if (!(await License.canAddTemperature())) {
      const lim = License.getLimits();
      App.toast(`Demo: max ${lim.maxTempDays} giorni di dati. Attiva la licenza.`);
      return;
    }

    const now = new Date().toISOString();
    let count = 0;

    for (const f of frigos) {
      const input = document.getElementById(`temp-input-${f.id}`);
      const val = parseFloat(input.value);
      if (isNaN(val) || input.value === '') continue;

      const stato = (val >= f.limiteMin && val <= f.limiteMax) ? 'OK' : 'Allerta';
      await db.temperature.add({
        frigoId: f.id,
        frigoNome: f.nome,
        valore: val,
        stato,
        dataOra: now,
        firma: ''
      });
      input.value = '';
      const pill = document.getElementById(`temp-pill-${f.id}`);
      pill.className = 'pill pend';
      pill.textContent = '—';
      count++;
    }

    if (count === 0) {
      App.toast('Inserisci almeno una temperatura');
      return;
    }

    await renderStorico();
    App.toast(`${count} temperature salvate`);
  }

  async function renderStorico() {
    const filterDate = document.getElementById('temp-filter-date').value;
    let records = await db.temperature.orderBy('dataOra').reverse().toArray();

    if (filterDate) {
      records = records.filter(r => r.dataOra.startsWith(filterDate));
    } else {
      records = records.slice(0, 20);
    }

    const el = document.getElementById('temp-storico');
    if (!records.length) {
      el.innerHTML = '<div class="empty-state"><span class="emoji">📊</span><p>Nessuna registrazione</p></div>';
      return;
    }

    el.innerHTML = `
      <table class="stbl">
        <thead><tr><th>Data</th><th>Unità</th><th>°C</th><th>Stato</th></tr></thead>
        <tbody>
          ${records.map(r => {
            const d = new Date(r.dataOra);
            const dateStr = d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
            const pillClass = r.stato === 'OK' ? 'ok' : 'al';
            const pillText = r.stato === 'OK' ? 'OK' : '⚠';
            return `<tr><td>${dateStr}</td><td>${r.frigoNome}</td><td>${r.valore}</td><td><span class="pill ${pillClass}">${pillText}</span></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function countToday() {
    const today = new Date().toISOString().slice(0, 10);
    const all = await db.temperature.toArray();
    return all.filter(r => r.dataOra.startsWith(today)).length;
  }

  async function getRecent(limit = 5) {
    return await db.temperature.orderBy('dataOra').reverse().limit(limit).toArray();
  }

  function init() {
    document.getElementById('btn-temp-salva').addEventListener('click', salva);
    document.getElementById('temp-filter-date').addEventListener('change', renderStorico);
  }

  return { init, renderForm, renderStorico, countToday, getRecent };
})();
