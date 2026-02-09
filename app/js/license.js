// ====== Modulo Licenze — Validazione Offline ======
const License = (() => {

  // Salt segreto per la generazione/validazione codici
  // IMPORTANTE: deve corrispondere al salt usato in tools/genera-licenze.js
  const SALT = 'HACCP_PRO_2026_GS_SALT_KEY';
  const PREFIX = 'HP';

  // Limiti modalità demo
  const DEMO_LIMITS = {
    maxFrigo: 2,
    maxTempDays: 7,
    maxTracc: 5,
    maxTraccInt: 5,
    maxPulDays: 7
  };

  let _licensed = null; // cache dello stato

  // ─── SHA-256 hash via Web Crypto API ───
  async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Validazione codice ───
  // Formato codice: HP-XXXXXXXX-YYYY
  //   XXXXXXXX = 8 char seed random
  //   YYYY     = primi 4 char di SHA256(seed + SALT)
  async function validateLicense(code) {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim().toUpperCase();

    // Formato: HP-XXXXXXXX-YYYY
    const parts = clean.split('-');
    if (parts.length !== 3) return false;
    if (parts[0] !== PREFIX) return false;
    if (parts[1].length !== 8) return false;
    if (parts[2].length !== 4) return false;

    const seed = parts[1];
    const check = parts[2];
    const hash = await sha256(seed + SALT);
    const expected = hash.substring(0, 4).toUpperCase();

    return check === expected;
  }

  // ─── Stato licenza da IndexedDB ───
  async function getLicenseInfo() {
    return await db.licenza.get('main');
  }

  async function isLicensed() {
    if (_licensed !== null) return _licensed;
    const lic = await getLicenseInfo();
    _licensed = !!(lic && lic.codice && lic.attivataIl);
    return _licensed;
  }

  // ─── Attivazione ───
  async function activateLicense(code) {
    const valid = await validateLicense(code);
    if (!valid) return { ok: false, msg: 'Codice licenza non valido' };

    const clean = code.trim().toUpperCase();
    await db.licenza.put({
      id: 'main',
      codice: clean,
      attivataIl: new Date().toISOString(),
      tipo: 'completa'
    });

    _licensed = true;
    return { ok: true, msg: 'Licenza attivata con successo!' };
  }

  // ─── Check limiti demo ───
  // Ritorna true se l'operazione è permessa, false se bloccata
  async function canAddFrigo() {
    if (await isLicensed()) return true;
    const count = await db.frigoriferi.count();
    return count < DEMO_LIMITS.maxFrigo;
  }

  async function canAddTemperature() {
    if (await isLicensed()) return true;
    const all = await db.temperature.toArray();
    const days = new Set(all.map(r => r.dataOra ? r.dataOra.slice(0, 10) : ''));
    // Oggi è sempre permesso se già registrato, altrimenti conta come nuovo giorno
    const today = new Date().toISOString().slice(0, 10);
    if (days.has(today)) return true;
    return days.size < DEMO_LIMITS.maxTempDays;
  }

  async function canAddTracciabilita() {
    if (await isLicensed()) return true;
    const count = await db.tracciabilita.count();
    return count < DEMO_LIMITS.maxTracc;
  }

  async function canAddTracciabilitaInterna() {
    if (await isLicensed()) return true;
    const count = await db.tracciabilitaInterna.count();
    return count < DEMO_LIMITS.maxTraccInt;
  }

  async function canAddPulizia() {
    if (await isLicensed()) return true;
    const g = await db.pulizieGiornaliere.toArray();
    const s = await db.pulizieSettimanali.toArray();
    const days = new Set([
      ...g.map(r => r.data),
      ...s.map(r => r.data)
    ]);
    const today = new Date().toISOString().slice(0, 10);
    if (days.has(today)) return true;
    return days.size < DEMO_LIMITS.maxPulDays;
  }

  async function canExportPDF() {
    return await isLicensed();
  }

  function getLimits() {
    return DEMO_LIMITS;
  }

  // ─── UI: render stato licenza in Impostazioni ───
  async function renderLicenseCard() {
    const el = document.getElementById('license-card-content');
    if (!el) return;

    const lic = await getLicenseInfo();
    if (lic && lic.codice && lic.attivataIl) {
      const d = new Date(lic.attivataIl);
      const dateStr = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      el.innerHTML = `
        <div class="license-status license-active">
          <span class="license-ico">✅</span>
          <div>
            <div class="license-label">Licenza attiva</div>
            <div class="license-detail">Attivata il ${dateStr}</div>
            <div class="license-detail">${lic.codice}</div>
          </div>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="license-status license-demo">
          <span class="license-ico">🔒</span>
          <div>
            <div class="license-label">Modalit&agrave; Demo</div>
            <div class="license-detail">Max ${DEMO_LIMITS.maxFrigo} frigo, ${DEMO_LIMITS.maxTempDays} giorni dati, no PDF</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <input type="text" class="fi" id="license-code-input" placeholder="HP-XXXXXXXX-YYYY" style="flex:1;text-transform:uppercase;">
          <button class="btn-full" id="btn-license-activate" style="width:auto;padding:14px 20px;">Attiva</button>
        </div>
        <div id="license-feedback" style="margin-top:8px;"></div>
      `;
      // Bind activation
      document.getElementById('btn-license-activate').addEventListener('click', async () => {
        const code = document.getElementById('license-code-input').value;
        const fb = document.getElementById('license-feedback');
        if (!code.trim()) { fb.innerHTML = '<span class="license-err">Inserisci un codice</span>'; return; }

        fb.innerHTML = '<span style="color:var(--text-muted);">Verifica in corso...</span>';
        const result = await activateLicense(code);

        if (result.ok) {
          fb.innerHTML = `<span class="license-ok">${result.msg}</span>`;
          // Refresh the entire UI
          setTimeout(() => {
            renderLicenseCard();
            App.refreshDashboard();
          }, 800);
        } else {
          fb.innerHTML = `<span class="license-err">${result.msg}</span>`;
        }
      });
    }
  }

  // ─── UI: watermark + banner demo sulla dashboard ───
  async function renderDemoUI() {
    const licensed = await isLicensed();
    const watermark = document.getElementById('demo-watermark');
    const banner = document.getElementById('demo-upgrade-banner');

    if (watermark) watermark.style.display = licensed ? 'none' : 'block';
    if (banner) banner.style.display = licensed ? 'none' : 'block';

    // Disabilita/abilita bottoni PDF
    const pdfBtns = document.querySelectorAll('.pdf-btn, #btn-pdf-completo');
    pdfBtns.forEach(btn => {
      if (licensed) {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
      } else {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
      }
    });
  }

  function init() {
    // Il rendering viene chiamato da app.js al momento opportuno
  }

  return {
    init, validateLicense, isLicensed, activateLicense, getLicenseInfo,
    canAddFrigo, canAddTemperature, canAddTracciabilita, canAddTracciabilitaInterna, canAddPulizia, canExportPDF,
    getLimits, renderLicenseCard, renderDemoUI
  };
})();
