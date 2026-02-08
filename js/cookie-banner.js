(function() {
  if (localStorage.getItem('haccp_cookie_ok')) return;

  var banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML =
    '<div class="cookie-banner-inner">' +
      '<p>Questo sito utilizza esclusivamente cookie tecnici necessari al funzionamento. ' +
      'Nessun cookie di profilazione o di terze parti. ' +
      '<a href="cookies.html">Maggiori informazioni</a></p>' +
      '<button class="cookie-banner-btn" id="cookie-accept">Accetta</button>' +
    '</div>';

  document.body.appendChild(banner);

  document.getElementById('cookie-accept').addEventListener('click', function() {
    localStorage.setItem('haccp_cookie_ok', '1');
    banner.style.display = 'none';
  });
})();
