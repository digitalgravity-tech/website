// Digital Gravity — lead capture via Formspree (AJAX, no page reload).
// Wires any <form data-lead-form> on the page: posts to Formspree, shows an
// inline success/error state, and fires a GA4 `generate_lead` event on success.
//
// SETUP: replace FORMSPREE_ID below with the real form ID from
// https://formspree.io/f/XXXXXXXX  (copy just the XXXXXXXX part).
(function () {
  'use strict';

  var FORMSPREE_ID = 'YOUR_FORM_ID'; // <-- substitua pelo Form ID real do Formspree
  var ENDPOINT = 'https://formspree.io/f/' + FORMSPREE_ID;

  function ga(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function noteFor(form) {
    var scope = form.parentElement || document;
    return scope.querySelector('[data-form-note]');
  }

  document.querySelectorAll('form[data-lead-form]').forEach(function (form) {
    var btn = form.querySelector('button[type="submit"]');
    var note = noteFor(form);
    var btnText = btn ? btn.textContent : '';

    function setNote(msg, kind) {
      if (!note) return;
      note.textContent = msg;
      note.classList.remove('is-ok', 'is-err');
      if (kind) note.classList.add(kind);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot — bots fill hidden fields; humans don't.
      var hp = form.querySelector('[name="_gotcha"]');
      if (hp && hp.value) return;

      if (!form.checkValidity()) { form.reportValidity && form.reportValidity(); return; }

      var data = new FormData(form);
      var source = form.getAttribute('data-source') || 'site';
      data.set('source', source);
      data.set('page', location.pathname);

      // Fallback while the Formspree ID isn't configured yet: open a prefilled
      // mailto so the contact path still works (no broken submit in production).
      if (FORMSPREE_ID === 'YOUR_FORM_ID') {
        var email = data.get('email') || '';
        var band = data.get('band'), sp = data.get('score_pct');
        var body = 'Meu e-mail: ' + email + (band ? ('\nDiagnóstico: ' + band + ' (' + sp + '%)') : '');
        location.href = 'mailto:contato@digitalgravity.tech?subject=' +
          encodeURIComponent('Contato — site Digital Gravity') + '&body=' + encodeURIComponent(body);
        setNote('Abrindo seu cliente de e-mail…', null);
        ga('generate_lead', band ? { source: source, band: band, score_pct: Number(sp) } : { source: source });
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
      setNote('Enviando…', null);

      fetch(ENDPOINT, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
        .then(function (r) {
          if (r.ok) {
            form.style.display = 'none';
            setNote('Recebido. A gente responde no e-mail informado — sem spam.', 'is-ok');
            var lead = { source: source };
            var band = data.get('band'); if (band) lead.band = band;
            var sp = data.get('score_pct'); if (sp) lead.score_pct = Number(sp);
            ga('generate_lead', lead);
          } else {
            return r.json().then(function (d) {
              var msg = (d && d.errors && d.errors.length) ? d.errors.map(function (x) { return x.message; }).join(' ') : 'Algo falhou no envio.';
              throw new Error(msg);
            });
          }
        })
        .catch(function (err) {
          if (btn) { btn.disabled = false; btn.textContent = btnText; }
          setNote((err && err.message ? err.message : 'Não foi possível enviar.') + ' Tente de novo ou escreva para contato@digitalgravity.tech.', 'is-err');
        });
    });
  });
})();
