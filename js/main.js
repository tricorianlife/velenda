/* =====================================================================
   VELENDA / Site-wide JS
   - Fetches and injects shared header.html / footer.html
   - Cursor spotlight
   - Scroll-state header
   - Mobile nav toggle
   - IntersectionObserver reveal
   - 3D tilt on [data-tilt]
   ===================================================================== */

(function () {
  'use strict';

  /* ---------- Config ----------
     Edit TRICORIAN_HOME if the destination ever moves. Templates use the
     {{TRICORIAN_HOME}} and {{YEAR}} tokens which are replaced at fetch time.
  ------------------------------ */
  const CONFIG = {
    TRICORIAN_HOME: 'https://www.tricorian.com/',
    HEADER_URL: 'header.html',
    FOOTER_URL: 'footer.html',

    /* Contact form
       =====================================================================
       Where to POST contact submissions. Two supported patterns:

       1. Your own backend (recommended). The Tricorian Django backend
          already accepts these field names and emails sales@tricorian.com,
          so point this at that endpoint, e.g.
            'https://www.tricorian.com/contact/api/'
          (CORS must allow https://www.velenda.com).

       2. A static-site form service such as
            'https://formsubmit.co/ajax/sales@tricorian.com'
          which accepts an arbitrary JSON body and emails it.

       If left null, the form opens the visitor's mail client with a
       pre-filled message to CONTACT_FALLBACK_EMAIL instead.
       ===================================================================== */
    CONTACT_ENDPOINT: null,
    CONTACT_FALLBACK_EMAIL: 'sales@tricorian.com',
    TURNSTILE_SITE_KEY: '0x4AAAAAAAQ56bsIs2w5_qkd' /* same key as Tricorian */
  };

  /* Friendly labels per mode (used in submit button + email subject) */
  const MODE_LABEL = {
    general:     { btn: 'Send message',          subject: 'General enquiry' },
    partnership: { btn: 'Request demo',          subject: 'Pharma partnership / demo request' },
    materials:   { btn: 'Submit materials enquiry', subject: 'Raw materials enquiry' },
    investor:    { btn: 'Send to investor relations', subject: 'Investor relations enquiry' },
    supplier:    { btn: 'Submit supplier enquiry',    subject: 'Supplier onboarding enquiry' }
  };

  /* ---------- Template token replacement ---------- */
  function applyTokens(html) {
    return html
      .replace(/\{\{TRICORIAN_HOME\}\}/g, CONFIG.TRICORIAN_HOME)
      .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
  }

  /* ---------- Fetch + inject header / footer ---------- */
  async function loadFragment(url, slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return false;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('fetch ' + url + ' → ' + res.status);
      const html = applyTokens(await res.text());
      // Replace the slot div with the fetched markup
      slot.outerHTML = html;
      return true;
    } catch (err) {
      // Likely cause: opened via file:// where fetch is blocked.
      console.warn('[Velenda] Could not load ' + url + '. Serve the site over HTTP.', err);
      slot.innerHTML =
        '<div style="padding:14px 24px;font-family:monospace;font-size:12px;color:#0E1F3D;background:#fdf2c8;border:1px solid #e6c84a;">' +
        'Could not load <strong>' + url + '</strong>. Open this site through a local web server ' +
        '(e.g. <code>npx serve</code> or <code>python -m http.server</code>) because browsers block ' +
        'fetch() on the <code>file://</code> protocol.' +
        '</div>';
      return false;
    }
  }

  /* ---------- Wire interactions (after DOM contains header/footer) ---------- */
  function wire() {
    /* Mark active nav link based on current page */
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.vl-header__link[data-nav]').forEach((a) => {
      if ((a.dataset.nav || '').toLowerCase() === path) a.classList.add('is-active');
    });
    if (path === '' && document.querySelector('.vl-header__link[data-nav="index.html"]')) {
      document.querySelector('.vl-header__link[data-nav="index.html"]').classList.add('is-active');
    }

    /* Scroll state on header */
    const header = document.getElementById('vlHeader');
    const onScroll = () => {
      if (!header) return;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* Mobile nav toggle */
    const toggle = document.getElementById('vlToggle');
    const nav    = document.getElementById('vlNav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => {
          nav.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    /* Cursor spotlight (skip on touch) */
    const cursor = document.querySelector('.vl-cursor');
    if (cursor && !matchMedia('(pointer:coarse)').matches) {
      window.addEventListener('mousemove', (e) => {
        cursor.style.setProperty('--cx', e.clientX + 'px');
        cursor.style.setProperty('--cy', e.clientY + 'px');
      }, { passive: true });
    }

    /* IntersectionObserver-driven reveal */
    if ('IntersectionObserver' in window) {
      const els = document.querySelectorAll('.vl-reveal');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      els.forEach((el) => io.observe(el));
    } else {
      document.querySelectorAll('.vl-reveal').forEach((el) => el.classList.add('is-in'));
    }

    /* 3D tilt on any [data-tilt] block (desktop only) */
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch  = matchMedia('(pointer:coarse)').matches;
    if (!reduce && !touch) {
      document.querySelectorAll('[data-tilt]').forEach((el) => {
        el.addEventListener('mousemove', (e) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width  - 0.5;
          const y = (e.clientY - r.top)  / r.height - 0.5;
          el.style.transform = 'perspective(900px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
          // Card-internal mouse position for radial highlight
          el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
        el.addEventListener('mouseleave', () => { el.style.transform = ''; });
      });
    }

    /* Contact form (only initialised on the contact page) */
    initContactForm();
  }

  /* =====================================================================
     CONTACT FORM
     ===================================================================== */

  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const modesRoot      = form.querySelector('.vl-modes');
    const panels         = form.querySelectorAll('.vl-mode-panel');
    const submitLabelEl  = form.querySelector('[data-submit-label]');
    const matsContainer  = form.querySelector('#vlMaterials');
    const matsTpl        = form.querySelector('#vlMaterialTpl');
    const addMatBtn      = form.querySelector('#vlAddMaterial');
    const turnstileMount = form.querySelector('#vlTurnstile');
    const submitBtn      = form.querySelector('#vlSubmit');
    const spinner        = form.querySelector('#vlSpinner');
    const okBox          = form.querySelector('#vlOk');
    const errBox         = form.querySelector('#vlErr');
    const errMsg         = form.querySelector('#vlErrMsg');

    /* ----- mode selection (also responds to ?type= URL param) ----- */
    const allowedModes = ['general','partnership','materials','investor','supplier'];
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('type');
    if (fromUrl && allowedModes.indexOf(fromUrl) !== -1) {
      const r = form.querySelector('input[name="form_type"][value="' + fromUrl + '"]');
      if (r) r.checked = true;
    }

    function activeMode() {
      const r = form.querySelector('input[name="form_type"]:checked');
      return r ? r.value : 'general';
    }

    function applyMode(mode) {
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.mode === mode));
      if (submitLabelEl && MODE_LABEL[mode]) submitLabelEl.textContent = MODE_LABEL[mode].btn;

      // Required-when toggling
      form.querySelectorAll('[data-required-when]').forEach((el) => {
        const need = el.getAttribute('data-required-when');
        if (need === mode) el.setAttribute('required', '');
        else                el.removeAttribute('required');
      });
      // Materials required-marking
      const matRequired = (mode === 'materials');
      form.querySelectorAll('[data-mat-required]').forEach((el) => {
        if (matRequired) el.setAttribute('required', '');
        else              el.removeAttribute('required');
      });
    }

    if (modesRoot) {
      modesRoot.addEventListener('change', (e) => {
        if (e.target.name === 'form_type') applyMode(e.target.value);
      });
    }
    applyMode(activeMode());

    /* ----- materials repeater ----- */
    let matIndex = 0;
    function renderMaterial() {
      if (!matsTpl || !matsContainer) return;
      const html = matsTpl.innerHTML
        .replace(/__INDEX__/g, String(matIndex))
        .replace(/__N__/g, String(matsContainer.children.length + 1));
      const wrap = document.createElement('div');
      wrap.innerHTML = html.trim();
      const node = wrap.firstChild;
      matsContainer.appendChild(node);
      matIndex++;
      updateMaterialRemoveButtons();
      // Apply current mode (so required attrs land on new inputs)
      applyMode(activeMode());
    }
    function updateMaterialRemoveButtons() {
      const rows = matsContainer ? matsContainer.children : [];
      Array.from(rows).forEach((row, i) => {
        const head = row.querySelector('.vl-material__head span');
        if (head) head.textContent = 'Material #' + (i + 1);
        const rm = row.querySelector('.vl-material__remove');
        if (rm) rm.toggleAttribute('hidden', rows.length <= 1);
      });
    }
    if (addMatBtn) {
      addMatBtn.addEventListener('click', renderMaterial);
    }
    if (matsContainer) {
      matsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.vl-material__remove');
        if (!btn) return;
        const row = btn.closest('.vl-material');
        if (row && matsContainer.children.length > 1) {
          row.remove();
          updateMaterialRemoveButtons();
        }
      });
      // Seed with one row
      renderMaterial();
    }

    /* ----- turnstile (loaded if API arrives) ----- */
    let turnstileWidgetId = null;
    function mountTurnstile() {
      if (!turnstileMount || !window.turnstile || !CONFIG.TURNSTILE_SITE_KEY) return;
      if (turnstileWidgetId !== null) return;
      try {
        turnstileWidgetId = window.turnstile.render(turnstileMount, {
          sitekey: CONFIG.TURNSTILE_SITE_KEY,
          theme: 'light',
          appearance: 'always'
        });
      } catch (e) { /* ignore */ }
    }
    if (window.turnstile) mountTurnstile();
    else {
      // Wait until the Turnstile script self-initialises
      const poll = setInterval(() => {
        if (window.turnstile) { mountTurnstile(); clearInterval(poll); }
      }, 200);
      setTimeout(() => clearInterval(poll), 8000);
    }
    function getTurnstileToken() {
      if (!window.turnstile || turnstileWidgetId === null) return '';
      try { return window.turnstile.getResponse(turnstileWidgetId) || ''; }
      catch (e) { return ''; }
    }
    function resetTurnstile() {
      if (window.turnstile && turnstileWidgetId !== null) {
        try { window.turnstile.reset(turnstileWidgetId); } catch (e) { /* ignore */ }
      }
    }

    /* ----- collect ----- */
    function collect() {
      const data = {};
      const fd = new FormData(form);
      fd.forEach((value, key) => {
        // Convert materials[N][field] into a nested array
        const m = key.match(/^materials\[(\d+)\]\[(\w+)\]$/);
        if (m) {
          data.materials = data.materials || [];
          const idx = Number(m[1]);
          data.materials[idx] = data.materials[idx] || {};
          data.materials[idx][m[2]] = String(value).trim();
          return;
        }
        if (data[key] !== undefined) {
          if (!Array.isArray(data[key])) data[key] = [data[key]];
          data[key].push(String(value).trim());
        } else {
          data[key] = String(value).trim();
        }
      });
      // Compact materials to filled rows only
      if (Array.isArray(data.materials)) {
        data.materials = data.materials.filter((row) => row && (row.name || row.cas));
      }
      // Friendly meta
      data.form_type = activeMode();
      data.subject_label = (MODE_LABEL[data.form_type] || {}).subject || 'Velenda enquiry';
      data.submitted_at = new Date().toISOString();
      data.source = 'velenda.com';
      const ts = getTurnstileToken();
      if (ts) data['cf-turnstile-response'] = ts;
      return data;
    }

    /* ----- mailto fallback ----- */
    function buildMailto(data) {
      const subj = '[Velenda · ' + data.subject_label + '] ' + (data.first_name || '') + ' ' + (data.last_name || '');
      const lines = [];
      lines.push('Hi sales team,');
      lines.push('');
      lines.push('A new ' + data.subject_label + ' has been submitted via velenda.com.');
      lines.push('');
      lines.push('--- Contact ---');
      lines.push('Name: ' + (data.first_name || '') + ' ' + (data.last_name || ''));
      lines.push('Email: ' + (data.email || ''));
      lines.push('Role: ' + (data.occupation || ''));
      lines.push('Company: ' + (data.company || ''));
      lines.push('Location: ' + (data.location || ''));
      lines.push('');
      lines.push('--- Details ---');
      Object.keys(data).forEach((k) => {
        if (['first_name','last_name','email','occupation','company','location','form_type','subject_label','submitted_at','source','materials','cf-turnstile-response'].indexOf(k) !== -1) return;
        const v = data[k];
        if (v == null || v === '') return;
        lines.push(k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
      });
      if (Array.isArray(data.materials) && data.materials.length) {
        lines.push('');
        lines.push('--- Materials ---');
        data.materials.forEach((m, i) => {
          lines.push('  ' + (i + 1) + '. ' + (m.name || '(no name)') + ' / CAS ' + (m.cas || '(no cas)'));
          ['specs','quantity','shipping','required_by'].forEach((k) => {
            if (m[k]) lines.push('     ' + k + ': ' + m[k]);
          });
        });
      }
      lines.push('');
      lines.push('Submitted: ' + data.submitted_at);
      const body = encodeURIComponent(lines.join('\n'));
      return 'mailto:' + CONFIG.CONTACT_FALLBACK_EMAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + body;
    }

    /* ----- show / hide UI states ----- */
    function setLoading(on) {
      submitBtn.classList.toggle('is-loading', on);
      submitBtn.disabled = on;
      spinner.classList.toggle('is-hidden', !on);
    }
    function showOk() {
      okBox.classList.remove('is-hidden');
      errBox.classList.add('is-hidden');
    }
    function showErr(msg) {
      if (msg && errMsg) errMsg.textContent = msg;
      errBox.classList.remove('is-hidden');
      okBox.classList.add('is-hidden');
    }

    /* ----- validation ----- */
    function validate(data) {
      const fail = [];
      if (!data.first_name) fail.push('first name');
      if (!data.last_name)  fail.push('last name');
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail.push('valid work email');
      if (!data.company)    fail.push('company');
      if (!data.location)   fail.push('location');

      if (data.form_type === 'general') {
        if (!data.message) fail.push('message');
      } else if (data.form_type === 'partnership') {
        if (!data.demo_date) fail.push('preferred date');
        if (!data.demo_time) fail.push('preferred time');
        if (!data.demo_tz)   fail.push('time zone');
      } else if (data.form_type === 'materials') {
        if (!Array.isArray(data.materials) || data.materials.length === 0) {
          fail.push('at least one material with name and CAS number');
        } else {
          const incomplete = data.materials.some((m) => !m.name || !m.cas);
          if (incomplete) fail.push('material name and CAS number for every row');
        }
      } else if (data.form_type === 'investor') {
        if (!data.investor_firm) fail.push('firm name');
      }
      return fail;
    }

    /* ----- submit ----- */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      okBox.classList.add('is-hidden');
      errBox.classList.add('is-hidden');

      const data = collect();
      const issues = validate(data);
      if (issues.length) {
        showErr('Please add: ' + issues.join(', ') + '.');
        return;
      }

      setLoading(true);

      // No backend wired? Fall back to mailto.
      if (!CONFIG.CONTACT_ENDPOINT) {
        try {
          window.location.href = buildMailto(data);
          setLoading(false);
          okBox.querySelector('div').innerHTML =
            '<strong>Mail client opened.</strong> Send the pre-filled message and our sales team will reply within 24 hours from <a href="mailto:' +
            CONFIG.CONTACT_FALLBACK_EMAIL + '">' + CONFIG.CONTACT_FALLBACK_EMAIL + '</a>.';
          showOk();
        } catch (err) {
          setLoading(false);
          showErr('Could not open your mail client. Please email ' + CONFIG.CONTACT_FALLBACK_EMAIL + ' directly.');
        }
        return;
      }

      try {
        const res = await fetch(CONFIG.CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        // Reset materials to one fresh row
        if (matsContainer) {
          matsContainer.innerHTML = '';
          matIndex = 0;
          renderMaterial();
        }
        applyMode('general');
        resetTurnstile();
        setLoading(false);
        showOk();
      } catch (err) {
        setLoading(false);
        showErr('We could not submit your message just now. Please try again, or email ' + CONFIG.CONTACT_FALLBACK_EMAIL + '.');
      }
    });
  }

  /* ---------- Boot ---------- */
  async function boot() {
    await Promise.all([
      loadFragment(CONFIG.HEADER_URL, 'vl-header-slot'),
      loadFragment(CONFIG.FOOTER_URL, 'vl-footer-slot')
    ]);
    wire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
