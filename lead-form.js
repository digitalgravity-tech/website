// Digital Gravity — lead capture + checklist-result logging via Formspree.
//
// Two paths share one Formspree endpoint:
//   1) Anonymous logging — fired the moment the checklist result is computed,
//      with IP + user agent, even before the user gives an email.
//   2) Interactive lead forms (<form data-lead-form>) — email capture.
// Both carry the same `checklist_id` so the two records correlate.
//
// SETUP: FORMSPREE_ID is the form ID from https://formspree.io/f/XXXXXXXX.
(function () {
  'use strict';

  var FORMSPREE_ID = 'mzdqgjqq'; // Formspree form ID (https://formspree.io/f/mzdqgjqq)
  var ENDPOINT = 'https://formspree.io/f/' + FORMSPREE_ID;

  function ga(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); }

  // Core Formspree POST. `fields` is a plain object; user_agent/page/ts added.
  // (Formspree records the submitter's IP server-side, so we don't send it.)
  function post(fields) {
    var data = new FormData();
    Object.keys(fields).forEach(function (k) {
      var v = fields[k];
      if (v !== undefined && v !== null && v !== '') data.append(k, v);
    });
    data.set('user_agent', navigator.userAgent);
    data.set('page', location.pathname);
    data.set('ts', new Date().toISOString());
    return fetch(ENDPOINT, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } });
  }

  function newId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'cid-' + new Date().getTime().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Public API for programmatic submissions (e.g. anonymous checklist result).
  window.DGLead = {
    newId: newId,
    log: function (fields) { post(fields).catch(function () {}); } // fire-and-forget
  };

  // ── Wire interactive lead forms ─────────────────────────────
  function noteFor(form) { return (form.parentElement || document).querySelector('[data-form-note]'); }

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

      var hp = form.querySelector('[name="_gotcha"]');
      if (hp && hp.value) return; // honeypot

      if (!form.checkValidity()) { form.reportValidity && form.reportValidity(); return; }

      var fields = {};
      new FormData(form).forEach(function (v, k) { if (k !== '_gotcha') fields[k] = v; });
      fields.source = form.getAttribute('data-source') || 'site';

      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
      setNote('Enviando…', null);

      post(fields).then(function (r) {
        if (r.ok) {
          form.style.display = 'none';
          setNote('Recebido. A gente responde no e-mail informado — sem spam.', 'is-ok');
          var lead = { source: fields.source };
          if (fields.band) lead.band = fields.band;
          if (fields.score_pct) lead.score_pct = Number(fields.score_pct);
          ga('generate_lead', lead);
        } else {
          return r.json().then(function (d) {
            var msg = (d && d.errors && d.errors.length) ? d.errors.map(function (x) { return x.message; }).join(' ') : 'Algo falhou no envio.';
            throw new Error(msg);
          });
        }
      }).catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = btnText; }
        setNote((err && err.message ? err.message : 'Não foi possível enviar.') + ' Tente de novo ou escreva para contato@digitalgravity.tech.', 'is-err');
      });
    });
  });
})();
