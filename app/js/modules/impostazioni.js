// ====== Modulo Impostazioni ======
const Impostazioni = (() => {

  // --- Azienda ---
  async function getAzienda() {
    return await db.azienda.get('main');
  }

  async function salvaAzienda(dati) {
    dati.id = 'main';
    await db.azienda.put(dati);
  }

  async function renderAziendaInfo() {
    const az = await getAzienda();
    if (!az) return;
    const el = document.getElementById('sett-azienda-info');
    el.innerHTML = `
      <div class="info-row"><span class="info-label">Ragione Sociale</span><span class="info-value">${az.ragioneSociale || '-'}</span></div>
      <div class="info-row"><span class="info-label">P.IVA</span><span class="info-value">${az.piva || '-'}</span></div>
      <div class="info-row"><span class="info-label">Indirizzo</span><span class="info-value">${az.indirizzo || '-'}</span></div>
      <div class="info-row"><span class="info-label">Telefono</span><span class="info-value">${az.telefono || '-'}</span></div>
      <div class="info-row"><span class="info-label">Tipo</span><span class="info-value">${az.tipo || '-'}</span></div>
      <div class="info-row"><span class="info-label">Responsabile</span><span class="info-value">${az.responsabile || '-'}</span></div>
    `;
  }

  function initModificaAzienda() {
    document.getElementById('btn-sett-modifica').addEventListener('click', async () => {
      const az = await getAzienda() || {};
      document.getElementById('sett-ragione').value = az.ragioneSociale || '';
      document.getElementById('sett-piva').value = az.piva || '';
      document.getElementById('sett-telefono').value = az.telefono || '';
      document.getElementById('sett-indirizzo').value = az.indirizzo || '';
      document.getElementById('sett-tipo').value = az.tipo || '';
      document.getElementById('sett-responsabile').value = az.responsabile || '';
      document.getElementById('sett-azienda-card').style.display = 'none';
      document.getElementById('sett-azienda-edit').style.display = 'block';
    });

    document.getElementById('btn-sett-salva').addEventListener('click', async () => {
      const dati = {
        ragioneSociale: document.getElementById('sett-ragione').value.trim(),
        piva: document.getElementById('sett-piva').value.trim(),
        telefono: document.getElementById('sett-telefono').value.trim(),
        indirizzo: document.getElementById('sett-indirizzo').value.trim(),
        tipo: document.getElementById('sett-tipo').value,
        responsabile: document.getElementById('sett-responsabile').value.trim()
      };
      if (!dati.ragioneSociale) { App.toast('Inserisci la ragione sociale'); return; }
      await salvaAzienda(dati);
      document.getElementById('sett-azienda-edit').style.display = 'none';
      document.getElementById('sett-azienda-card').style.display = 'block';
      await renderAziendaInfo();
      App.updateHeader();
      App.toast('Dati azienda aggiornati');
    });
  }

  // --- Frigoriferi ---
  async function getFrigoriferi() {
    return await db.frigoriferi.toArray();
  }

  async function renderFrigoList() {
    const lista = await getFrigoriferi();
    const el = document.getElementById('frigo-list');
    if (!lista.length) {
      el.innerHTML = '<div class="empty-state"><span class="emoji">❄️</span><p>Nessun frigorifero configurato</p></div>';
      return;
    }
    const tipoLabel = { Positivo: 'Pos.', Negativo: 'Neg.', Freezer: 'Frz.' };
    el.innerHTML = `
      <table class="stbl">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Min</th><th>Max</th><th></th></tr></thead>
        <tbody>
          ${lista.map(f => `
            <tr>
              <td>${f.nome}</td>
              <td>${tipoLabel[f.tipo] || f.tipo}</td>
              <td>${f.limiteMin}</td>
              <td>${f.limiteMax}</td>
              <td><button class="btn-danger" data-del-frigo="${f.id}">✕</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    // Bind delete buttons
    el.querySelectorAll('[data-del-frigo]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.delFrigo);
        await db.frigoriferi.delete(id);
        await renderFrigoList();
        App.toast('Frigorifero eliminato');
      });
    });
  }

  function initFrigoForm() {
    document.getElementById('btn-frigo-add').addEventListener('click', async () => {
      const nome = document.getElementById('frigo-nome').value.trim();
      const tipo = document.getElementById('frigo-tipo').value;
      const limiteMin = parseFloat(document.getElementById('frigo-min').value);
      const limiteMax = parseFloat(document.getElementById('frigo-max').value);

      if (!nome) { App.toast('Inserisci il nome del frigorifero'); return; }
      if (isNaN(limiteMin) || isNaN(limiteMax)) { App.toast('Inserisci i limiti di temperatura'); return; }
      if (limiteMin >= limiteMax) { App.toast('Il limite min deve essere inferiore al max'); return; }

      // Demo limit check
      if (!(await License.canAddFrigo())) {
        const lim = License.getLimits();
        App.toast(`Demo: max ${lim.maxFrigo} frigoriferi. Attiva la licenza.`);
        return;
      }

      await db.frigoriferi.add({ nome, tipo, limiteMin, limiteMax, attivo: 1 });

      // Reset form
      document.getElementById('frigo-nome').value = '';
      document.getElementById('frigo-min').value = '';
      document.getElementById('frigo-max').value = '';
      document.getElementById('frigo-tipo').value = 'Positivo';

      await renderFrigoList();
      App.toast('Frigorifero aggiunto');
    });
  }

  function init() {
    initModificaAzienda();
    initFrigoForm();
  }

  return { init, getAzienda, salvaAzienda, getFrigoriferi, renderAziendaInfo, renderFrigoList };
})();
