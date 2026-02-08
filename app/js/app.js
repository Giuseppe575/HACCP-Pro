// ====== App Core — Router + Dashboard ======
const App = (() => {

  let currentPage = 'dash';

  // --- Navigation ---
  function nav(page) {
    // Hide all pages
    document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
    // Show target
    const target = document.getElementById('p-' + page);
    if (target) target.classList.add('active');
    // Update bottom nav
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('on'));
    const btn = document.querySelector(`.bnav-item[data-p="${page}"]`);
    if (btn) btn.classList.add('on');
    // Scroll to top
    window.scrollTo(0, 0);
    currentPage = page;

    // Trigger page-specific renders
    if (page === 'dash') refreshDashboard();
    if (page === 'temp') { Temperature.renderForm(); Temperature.renderStorico(); }
    if (page === 'tracc') Tracciabilita.renderStorico();
    if (page === 'pul') Pulizie.renderStorico();
    if (page === 'sett') { Impostazioni.renderAziendaInfo(); Impostazioni.renderFrigoList(); License.renderLicenseCard(); }
    if (page === 'report') License.renderDemoUI();
  }

  // --- Toast ---
  function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // --- Header ---
  async function updateHeader() {
    const az = await Impostazioni.getAzienda();
    if (!az) return;
    const nome = az.responsabile || az.ragioneSociale || 'HACCP Pro';
    const initials = nome.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('hdr-avatar').textContent = initials;
    document.getElementById('hdr-name').textContent = nome;

    // Greeting based on time
    const h = new Date().getHours();
    let greet = 'Buongiorno';
    if (h >= 14 && h < 18) greet = 'Buon pomeriggio';
    else if (h >= 18) greet = 'Buonasera';
    document.getElementById('hdr-greet').textContent = greet;
  }

  // --- Dashboard ---
  async function refreshDashboard() {
    // Counters
    const tempCount = await Temperature.countToday();
    const pulCount = await Pulizie.countToday();
    const lottiCount = await Tracciabilita.countAll();

    document.getElementById('dash-temp-count').textContent = tempCount;
    document.getElementById('dash-pul-count').textContent = pulCount;
    document.getElementById('dash-lotti-count').textContent = lottiCount;

    // Badges on quick grid
    const qbTemp = document.getElementById('qb-temp');
    if (tempCount > 0) { qbTemp.className = 'qbadge ok'; qbTemp.textContent = '✓'; }
    else { qbTemp.className = 'qbadge hide'; }

    const qbTracc = document.getElementById('qb-tracc');
    if (lottiCount > 0) { qbTracc.className = 'qbadge ok'; qbTracc.textContent = '✓'; }
    else { qbTracc.className = 'qbadge hide'; }

    const qbPul = document.getElementById('qb-pul');
    if (pulCount > 0) { qbPul.className = 'qbadge ok'; qbPul.textContent = '✓'; }
    else { qbPul.className = 'qbadge hide'; }

    // License demo UI
    await License.renderDemoUI();

    // Recent activity
    await renderRecentActivity();
  }

  async function renderRecentActivity() {
    const el = document.getElementById('dash-activity');

    const [temps, lotti, pulizie] = await Promise.all([
      Temperature.getRecent(5),
      Tracciabilita.getRecent(5),
      Pulizie.getRecent(5)
    ]);

    // Merge all activities with timestamps
    const activities = [];

    temps.forEach(r => {
      activities.push({
        type: 'temp',
        text: `<strong>${r.frigoNome}</strong> — ${r.valore}°C ${r.stato === 'OK' ? 'Conforme' : '<span style="color:var(--amber)">Fuori limite</span>'}`,
        icon: r.stato === 'OK' ? '✅' : '⚠️',
        iconClass: r.stato === 'OK' ? 'g' : 'a',
        time: r.dataOra
      });
    });

    lotti.forEach(r => {
      activities.push({
        type: 'tracc',
        text: `<strong>${r.prodotto}</strong> — Lotto ${r.lotto}`,
        icon: '📦',
        iconClass: 'b',
        time: r.creatoIl
      });
    });

    pulizie.forEach(r => {
      const allDone = Object.values(r.valori).every(v => v === 'Eseguito');
      activities.push({
        type: 'pul',
        text: `Pulizia ${r.tipo} — <strong>${allDone ? 'Tutto OK' : 'Parziale'}</strong>`,
        icon: '🧹',
        iconClass: allDone ? 'g' : 'a',
        time: r.creatoIl || r.data
      });
    });

    // Sort by time desc
    activities.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    const top = activities.slice(0, 8);

    if (!top.length) {
      el.innerHTML = '<div class="empty-state"><span class="emoji">📋</span><p>Nessuna attività registrata</p></div>';
      return;
    }

    el.innerHTML = top.map(a => {
      const timeStr = formatTime(a.time);
      return `
        <div class="ai">
          <div class="ai-ico ${a.iconClass}">${a.icon}</div>
          <div>
            <div class="ai-txt">${a.text}</div>
            <div class="ai-time">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Oggi, ${time}`;
    if (isYesterday) return `Ieri, ${time}`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + `, ${time}`;
  }

  // --- Onboarding ---
  async function checkOnboarding() {
    const az = await Impostazioni.getAzienda();
    if (az && az.ragioneSociale) {
      // Show main app
      document.getElementById('main-hdr').style.display = 'flex';
      document.getElementById('main-bnav').style.display = 'flex';
      nav('dash');
      await updateHeader();
    } else {
      // Show onboarding
      document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
      document.getElementById('p-onboarding').classList.add('active');
      document.getElementById('main-hdr').style.display = 'none';
      document.getElementById('main-bnav').style.display = 'none';
    }
  }

  function initOnboarding() {
    document.getElementById('btn-onb-salva').addEventListener('click', async () => {
      const ragioneSociale = document.getElementById('onb-ragione').value.trim();
      const piva = document.getElementById('onb-piva').value.trim();
      const telefono = document.getElementById('onb-telefono').value.trim();
      const indirizzo = document.getElementById('onb-indirizzo').value.trim();
      const tipo = document.getElementById('onb-tipo').value;
      const responsabile = document.getElementById('onb-responsabile').value.trim();

      if (!ragioneSociale) { toast('Inserisci la ragione sociale'); return; }

      await Impostazioni.salvaAzienda({ ragioneSociale, piva, telefono, indirizzo, tipo, responsabile });

      // Transition to dashboard
      document.getElementById('main-hdr').style.display = 'flex';
      document.getElementById('main-bnav').style.display = 'flex';
      nav('dash');
      await updateHeader();
      toast('Benvenuto in HACCP Pro!');
    });
  }

  // --- Event Binding ---
  function bindEvents() {
    // Bottom nav
    document.querySelectorAll('.bnav-item').forEach(btn => {
      btn.addEventListener('click', () => nav(btn.dataset.p));
    });

    // All navigable elements (qcards, report banner, etc.)
    document.querySelectorAll('[data-nav]:not(.bnav-item):not(.back-btn)').forEach(el => {
      el.addEventListener('click', () => nav(el.dataset.nav));
    });

    // Back buttons
    document.querySelectorAll('.back-btn[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => nav(btn.dataset.nav));
    });
  }

  // --- Init ---
  async function init() {
    bindEvents();
    initOnboarding();
    License.init();
    Impostazioni.init();
    Temperature.init();
    Tracciabilita.init();
    Pulizie.init();
    HACCPReport.init();
    await checkOnboarding();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // Start when DOM ready
  document.addEventListener('DOMContentLoaded', init);

  return { nav, toast, updateHeader, refreshDashboard };
})();
