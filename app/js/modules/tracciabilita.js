// ====== Modulo Tracciabilità ======
const Tracciabilita = (() => {

  async function salva() {
    const prodotto = document.getElementById('tracc-prodotto').value.trim();
    const data = document.getElementById('tracc-data').value;
    const lotto = document.getElementById('tracc-lotto').value.trim();
    const fornitore = document.getElementById('tracc-fornitore').value.trim();
    const conforme = document.querySelector('input[name="tracc-conf"]:checked').value === '1';
    const firma = document.getElementById('tracc-firma').value.trim();

    if (!prodotto || !data || !lotto) {
      App.toast('Compila prodotto, data e lotto');
      return;
    }

    // Demo limit check
    if (!(await License.canAddTracciabilita())) {
      const lim = License.getLimits();
      App.toast(`Demo: max ${lim.maxTracc} schede. Attiva la licenza.`);
      return;
    }

    await db.tracciabilita.add({
      prodotto,
      data,
      fornitore,
      lotto,
      conforme,
      firma,
      creatoIl: new Date().toISOString()
    });

    // Reset form
    document.getElementById('tracc-prodotto').value = '';
    document.getElementById('tracc-data').value = '';
    document.getElementById('tracc-lotto').value = '';
    document.getElementById('tracc-fornitore').value = '';
    document.getElementById('tracc-firma').value = '';
    document.querySelector('input[name="tracc-conf"][value="1"]').checked = true;

    await renderStorico();
    App.toast('Scheda rintracciabilità salvata');
  }

  async function renderStorico() {
    const records = await db.tracciabilita.orderBy('data').reverse().limit(30).toArray();
    const el = document.getElementById('tracc-storico');

    if (!records.length) {
      el.innerHTML = '<div class="empty-state"><span class="emoji">📦</span><p>Nessuna scheda registrata</p></div>';
      return;
    }

    el.innerHTML = `
      <table class="stbl">
        <thead><tr><th>Data</th><th>Prodotto</th><th>Lotto</th><th></th></tr></thead>
        <tbody>
          ${records.map(r => {
            const d = new Date(r.data);
            const dateStr = d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
            const pillClass = r.conforme ? 'ok' : 'al';
            const pillText = r.conforme ? '✓' : '✕';
            return `<tr><td>${dateStr}</td><td>${r.prodotto}</td><td>${r.lotto}</td><td><span class="pill ${pillClass}">${pillText}</span></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function countAll() {
    return await db.tracciabilita.count();
  }

  async function getRecent(limit = 5) {
    return await db.tracciabilita.orderBy('creatoIl').reverse().limit(limit).toArray();
  }

  function init() {
    document.getElementById('btn-tracc-salva').addEventListener('click', salva);
    // Set default date to today
    document.getElementById('tracc-data').valueAsDate = new Date();
  }

  return { init, renderStorico, countAll, getRecent };
})();
