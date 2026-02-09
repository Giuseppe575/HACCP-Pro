// ====== Modulo Tracciabilità Interna (Produzioni) ======
const TracciabilitaInterna = (() => {

  async function generateLotto() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;

    // Conta record di oggi per il progressivo
    const todayISO = now.toISOString().slice(0, 10);
    const todayRecords = await db.tracciabilitaInterna
      .where('dataPreparazione').equals(todayISO).count();

    const seq = String(todayRecords + 1).padStart(3, '0');
    return `PREP-${dateStr}-${seq}`;
  }

  function initTabs() {
    document.getElementById('tab-tracc-r').addEventListener('click', () => switchTab('r'));
    document.getElementById('tab-tracc-i').addEventListener('click', () => switchTab('i'));
  }

  function switchTab(t) {
    if (t === 'r') {
      document.getElementById('tracc-form-r').style.display = 'block';
      document.getElementById('tracc-form-i').style.display = 'none';
      document.getElementById('tab-tracc-r').classList.add('on');
      document.getElementById('tab-tracc-i').classList.remove('on');
    } else {
      document.getElementById('tracc-form-r').style.display = 'none';
      document.getElementById('tracc-form-i').style.display = 'block';
      document.getElementById('tab-tracc-r').classList.remove('on');
      document.getElementById('tab-tracc-i').classList.add('on');
    }
  }

  async function salva() {
    const nome = document.getElementById('traccint-nome').value.trim();
    const ingredienti = document.getElementById('traccint-ingredienti').value.trim();
    const dataPreparazione = document.getElementById('traccint-data-prep').value;
    const dataScadenza = document.getElementById('traccint-data-scad').value;
    const lottoInterno = document.getElementById('traccint-lotto').value.trim();
    const quantita = document.getElementById('traccint-quantita').value.trim();
    const luogoConservazione = document.getElementById('traccint-luogo').value;
    const firma = document.getElementById('traccint-firma').value.trim();

    if (!nome || !dataPreparazione) {
      App.toast('Compila almeno nome e data preparazione');
      return;
    }

    // Demo limit check
    if (!(await License.canAddTracciabilitaInterna())) {
      const lim = License.getLimits();
      App.toast(`Demo: max ${lim.maxTraccInt} produzioni. Attiva la licenza.`);
      return;
    }

    await db.tracciabilitaInterna.add({
      nome,
      ingredienti,
      dataPreparazione,
      dataScadenza,
      lottoInterno,
      quantita,
      luogoConservazione,
      firma,
      creatoIl: new Date().toISOString()
    });

    // Reset form
    document.getElementById('traccint-nome').value = '';
    document.getElementById('traccint-ingredienti').value = '';
    document.getElementById('traccint-data-prep').valueAsDate = new Date();
    document.getElementById('traccint-data-scad').value = '';
    document.getElementById('traccint-quantita').value = '';
    document.getElementById('traccint-firma').value = '';
    // Rigenera lotto per prossima registrazione
    document.getElementById('traccint-lotto').value = await generateLotto();

    await renderStorico();
    App.toast('Produzione registrata');
  }

  async function renderStorico() {
    const records = await db.tracciabilitaInterna.orderBy('dataPreparazione').reverse().limit(30).toArray();
    const el = document.getElementById('traccint-storico');

    if (!records.length) {
      el.innerHTML = '<div class="empty-state"><span class="emoji">🍳</span><p>Nessuna produzione registrata</p></div>';
      return;
    }

    el.innerHTML = `
      <table class="stbl">
        <thead><tr><th>Data</th><th>Preparazione</th><th>Lotto</th><th>Conserv.</th></tr></thead>
        <tbody>
          ${records.map(r => {
            const d = new Date(r.dataPreparazione);
            const dateStr = d.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
            return `<tr><td>${dateStr}</td><td>${r.nome}</td><td>${r.lottoInterno || '-'}</td><td>${r.luogoConservazione || '-'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function countAll() {
    return await db.tracciabilitaInterna.count();
  }

  async function getRecent(limit = 5) {
    return await db.tracciabilitaInterna.orderBy('creatoIl').reverse().limit(limit).toArray();
  }

  async function init() {
    initTabs();
    document.getElementById('btn-traccint-salva').addEventListener('click', salva);
    // Data default = oggi
    document.getElementById('traccint-data-prep').valueAsDate = new Date();
    // Genera lotto iniziale
    document.getElementById('traccint-lotto').value = await generateLotto();
  }

  return { init, renderStorico, countAll, getRecent };
})();
