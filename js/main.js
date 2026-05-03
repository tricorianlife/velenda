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
       Submissions are POSTed as JSON to the Tricorian Django backend, which
       sends the email via SendGrid to sales@tricorian.com. The endpoint is
       implemented by SendVelendaEmail() in the Tricorian contact app.

       If the contact app's urls.py is mounted somewhere other than
       /contact/ in the Tricorian project's root urls.py, update the
       CONTACT_ENDPOINT path below to match.
       ===================================================================== */
    CONTACT_TO: 'sales@tricorian.com',
    CONTACT_ENDPOINT: 'https://www.tricorian.com/contact/velenda/',
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

    // Clear inline field-error styling once the user starts fixing a field
    form.addEventListener('input', (e) => {
      if (e.target && e.target.removeAttribute) e.target.removeAttribute('aria-invalid');
    });

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

    /* ----- field labels for the outgoing email ----- */
    const FIELD_LABELS = {
      first_name: 'First name', last_name: 'Last name', email: 'Work email',
      occupation: 'Role / title', company: 'Company', location: 'Country / location',
      subject: 'Subject', message: 'Message',
      pharma_type: 'Company type', pharma_spend: 'Annual raw materials spend',
      demo_date: 'Preferred demo date', demo_time: 'Preferred demo time', demo_tz: 'Time zone',
      demo_attendees: 'Number of attendees', pharma_stage: 'Decision stage', pharma_notes: 'Demo notes',
      materials_notes: 'Materials notes',
      investor_firm: 'Firm / fund name', investor_type: 'Investor type', investor_stage: 'Stage of interest',
      investor_cheque: 'Indicative cheque size', investor_region: 'Geographic focus',
      investor_prior: 'Spoken before?', investor_notes: 'Investor notes',
      supplier_type: 'Company type', supplier_hq: 'Headquartered in',
      supplier_regions: 'Regions served', supplier_certs: 'Certifications',
      supplier_materials: 'Key materials / categories', supplier_volumes: 'Typical batch / volume',
      supplier_demo_date: 'Preferred demo date', supplier_demo_time: 'Preferred demo time',
      supplier_notes: 'Supplier notes'
    };

    /* ----- flatten payload into FormSubmit-friendly key/value pairs ----- */
    function flattenForEmail(data) {
      const out = {};
      const senderName = ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
      out._subject = '[Velenda · ' + data.subject_label + '] ' + (senderName || data.email || 'New enquiry');
      out._template = 'table';
      out._captcha = 'false'; // we use Turnstile
      if (data.email) out._replyto = data.email;

      Object.keys(data).forEach((key) => {
        if (key === 'materials' || key.charAt(0) === '_') return;
        const val = data[key];
        if (val === '' || val == null) return;
        const label = FIELD_LABELS[key] || key;
        out[label] = Array.isArray(val) ? val.join(', ') : String(val);
      });

      if (Array.isArray(data.materials) && data.materials.length) {
        data.materials.forEach((m, i) => {
          const n = i + 1;
          if (m.name)        out['Material ' + n + ' — Name'] = m.name;
          if (m.cas)         out['Material ' + n + ' — CAS number'] = m.cas;
          if (m.specs)       out['Material ' + n + ' — Specifications'] = m.specs;
          if (m.quantity)    out['Material ' + n + ' — Quantity'] = m.quantity;
          if (m.shipping)    out['Material ' + n + ' — Shipping'] = m.shipping;
          if (m.required_by) out['Material ' + n + ' — Required by'] = m.required_by;
        });
      }
      return out;
    }

    /* ----- mailto: link used as the error fallback (no third-party redirect) ----- */
    function buildMailtoFallback(data) {
      const subj = '[Velenda · ' + data.subject_label + '] ' +
        ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
      const lines = [];
      const flat = flattenForEmail(data);
      Object.keys(flat).forEach((k) => {
        if (k.charAt(0) === '_') return;
        lines.push(k + ': ' + flat[k]);
      });
      const body = lines.join('\n');
      return 'mailto:' + CONFIG.CONTACT_TO +
        '?subject=' + encodeURIComponent(subj) +
        '&body=' + encodeURIComponent(body);
    }

    /* ----- show / hide UI states ----- */
    function setLoading(on) {
      submitBtn.classList.toggle('is-loading', on);
      submitBtn.disabled = on;
      spinner.classList.toggle('is-hidden', !on);
    }
    function showOk() {
      if (okBox) okBox.classList.remove('is-hidden');
      errBox.classList.add('is-hidden');
    }
    function showErr(msg) {
      if (msg && errMsg) errMsg.textContent = msg;
      errBox.classList.remove('is-hidden');
      if (okBox) okBox.classList.add('is-hidden');
    }

    /* ----- validation -----
       Returns array of {label, selector} so the submit handler can
       surface specific feedback and highlight the failing field. */
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function validate(data) {
      const fail = [];
      if (!data.first_name) fail.push({ label: 'first name', selector: '#cf-first' });
      if (!data.last_name)  fail.push({ label: 'last name',  selector: '#cf-last'  });
      if (!data.email) {
        fail.push({ label: 'work email', selector: '#cf-email' });
      } else if (!EMAIL_RE.test(data.email)) {
        fail.push({ label: 'work email (looks like “' + data.email + '” — please check the @ and domain)', selector: '#cf-email' });
      }
      if (!data.company)    fail.push({ label: 'company',  selector: '#cf-company'  });
      if (!data.location)   fail.push({ label: 'location', selector: '#cf-location' });

      if (data.form_type === 'general') {
        if (!data.message) fail.push({ label: 'message', selector: '#cf-message' });
      } else if (data.form_type === 'partnership') {
        if (!data.demo_date) fail.push({ label: 'preferred date', selector: '#cf-demo-date' });
        if (!data.demo_time) fail.push({ label: 'preferred time', selector: '#cf-demo-time' });
        if (!data.demo_tz)   fail.push({ label: 'time zone',      selector: '#cf-demo-tz'   });
      } else if (data.form_type === 'materials') {
        if (!Array.isArray(data.materials) || data.materials.length === 0) {
          fail.push({ label: 'at least one material with name and CAS number', selector: '#vlMaterials input' });
        } else {
          const incomplete = data.materials.some((m) => !m.name || !m.cas);
          if (incomplete) fail.push({ label: 'material name and CAS number for every row', selector: '#vlMaterials input' });
        }
      } else if (data.form_type === 'investor') {
        if (!data.investor_firm) fail.push({ label: 'firm name', selector: '#cf-inv-firm' });
      }
      return fail;
    }

    function clearFieldErrors() {
      form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    }
    function markFieldErrors(issues) {
      issues.forEach((iss) => {
        const el = form.querySelector(iss.selector);
        if (el) el.setAttribute('aria-invalid', 'true');
      });
      // Scroll to and focus the first failing field
      if (issues.length) {
        const first = form.querySelector(issues[0].selector);
        if (first) {
          try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); }
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    /* ----- success page summary ----- */
    const formPanel  = document.getElementById('vlFormPanel');
    const successEl  = document.getElementById('vlSuccessPage');
    const summaryEl  = document.getElementById('vlSuccessSummary');
    const sendAnother = document.getElementById('vlSendAnother');

    const SUMMARY_LABELS = {
      first_name: 'First name', last_name: 'Last name', email: 'Work email',
      occupation: 'Role / title', company: 'Company', location: 'Country / location',
      subject: 'Subject', message: 'Message',
      pharma_type: 'Company type', pharma_spend: 'Annual spend',
      demo_attendees: 'Attendees', pharma_stage: 'Decision stage', pharma_notes: 'Demo notes',
      materials_notes: 'Materials notes',
      investor_firm: 'Firm', investor_type: 'Investor type', investor_stage: 'Stage',
      investor_cheque: 'Cheque size', investor_region: 'Geographic focus',
      investor_prior: 'Spoken before?', investor_notes: 'Investor notes',
      supplier_type: 'Supplier type', supplier_hq: 'Headquartered in',
      supplier_regions: 'Regions served', supplier_certs: 'Certifications',
      supplier_materials: 'Materials supplied', supplier_volumes: 'Batch / volume',
      supplier_notes: 'Supplier notes'
    };

    function renderSummary(data) {
      if (!summaryEl) return;
      summaryEl.innerHTML = '';
      const rows = [];
      const fullName = ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
      if (fullName) rows.push(['Name', fullName]);
      if (data.email) rows.push(['Work email', data.email]);
      if (data.occupation) rows.push(['Role / title', data.occupation]);
      if (data.company) rows.push(['Company', data.company]);
      if (data.location) rows.push(['Country / location', data.location]);
      if (data.subject_label) rows.push(['Enquiry type', data.subject_label]);

      if (data.form_type === 'general') {
        if (data.subject) rows.push(['Subject', data.subject]);
        if (data.message) rows.push(['Message', data.message]);
      } else if (data.form_type === 'partnership') {
        if (data.pharma_type) rows.push(['Company type', data.pharma_type]);
        if (data.pharma_spend) rows.push(['Annual spend', data.pharma_spend]);
        if (data.demo_date || data.demo_time || data.demo_tz) {
          rows.push(['Preferred demo',
            (data.demo_date || '') +
            (data.demo_time ? ' at ' + data.demo_time : '') +
            (data.demo_tz ? ' (' + data.demo_tz + ')' : '')]);
        }
        if (data.demo_attendees) rows.push(['Attendees', data.demo_attendees]);
        if (data.pharma_stage) rows.push(['Decision stage', data.pharma_stage]);
        if (data.pharma_notes) rows.push(['Notes', data.pharma_notes]);
      } else if (data.form_type === 'materials') {
        if (Array.isArray(data.materials) && data.materials.length) {
          data.materials.forEach((m, i) => {
            const parts = [];
            if (m.name) parts.push(m.name);
            if (m.cas) parts.push('CAS ' + m.cas);
            if (m.quantity) parts.push(m.quantity);
            if (m.shipping) parts.push(m.shipping);
            if (m.required_by) parts.push('by ' + m.required_by);
            rows.push(['Material ' + (i + 1), parts.join(' · ') || '(empty)']);
            if (m.specs) rows.push(['Material ' + (i + 1) + ' specs', m.specs]);
          });
        }
        if (data.materials_notes) rows.push(['Notes', data.materials_notes]);
      } else if (data.form_type === 'investor') {
        if (data.investor_firm) rows.push(['Firm', data.investor_firm]);
        if (data.investor_type) rows.push(['Investor type', data.investor_type]);
        if (data.investor_stage) rows.push(['Stage', data.investor_stage]);
        if (data.investor_cheque) rows.push(['Cheque size', data.investor_cheque]);
        if (data.investor_region) rows.push(['Geographic focus', data.investor_region]);
        if (data.investor_prior) rows.push(['Spoken before?', data.investor_prior]);
        if (data.investor_notes) rows.push(['Notes', data.investor_notes]);
      } else if (data.form_type === 'supplier') {
        if (data.supplier_type) rows.push(['Supplier type', data.supplier_type]);
        if (data.supplier_hq) rows.push(['Headquartered in', data.supplier_hq]);
        if (data.supplier_regions) rows.push(['Regions served', data.supplier_regions]);
        if (data.supplier_certs) rows.push(['Certifications', data.supplier_certs]);
        if (data.supplier_materials) rows.push(['Materials supplied', data.supplier_materials]);
        if (data.supplier_volumes) rows.push(['Batch / volume', data.supplier_volumes]);
        if (data.supplier_demo_date || data.supplier_demo_time) {
          rows.push(['Preferred demo',
            (data.supplier_demo_date || '') +
            (data.supplier_demo_time ? ' at ' + data.supplier_demo_time : '')]);
        }
        if (data.supplier_notes) rows.push(['Notes', data.supplier_notes]);
      }

      rows.forEach((r) => {
        const dt = document.createElement('dt'); dt.textContent = r[0];
        const dd = document.createElement('dd'); dd.textContent = r[1];
        summaryEl.appendChild(dt); summaryEl.appendChild(dd);
      });
    }

    function showSuccessPage(data) {
      renderSummary(data);
      if (formPanel) formPanel.style.display = 'none';
      if (successEl) {
        successEl.classList.remove('is-hidden');
        successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Fallback if success page markup is missing
        showOk();
      }
    }

    function resetToForm() {
      form.reset();
      if (matsContainer) {
        matsContainer.innerHTML = '';
        matIndex = 0;
        renderMaterial();
      }
      applyMode('general');
      resetTurnstile();
      clearFieldErrors();
      errBox.classList.add('is-hidden');
      if (okBox) okBox.classList.add('is-hidden');
      if (successEl) successEl.classList.add('is-hidden');
      if (formPanel) formPanel.style.display = '';
      if (formPanel) formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (sendAnother) sendAnother.addEventListener('click', resetToForm);

    /* ----- submit ----- */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (okBox) okBox.classList.add('is-hidden');
      errBox.classList.add('is-hidden');
      clearFieldErrors();

      const data = collect();
      const issues = validate(data);
      if (issues.length) {
        markFieldErrors(issues);
        showErr('Please complete: ' + issues.map((i) => i.label).join(', ') + '.');
        return;
      }

      setLoading(true);

      const mailto = buildMailtoFallback(data);

      if (!CONFIG.CONTACT_ENDPOINT) {
        setLoading(false);
        showErr('No contact endpoint is configured. Please email <a href="' + mailto + '">' + CONFIG.CONTACT_TO + '</a> directly.');
        return;
      }

      try {
        const payload = flattenForEmail(data);
        const res = await fetch(CONFIG.CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let body = null;
        try { body = await res.json(); } catch (_) { /* some services return empty body */ }
        if (body && body.success === false) {
          throw new Error(body.error || body.message || 'Submission rejected');
        }
        if (body && body.success === 'false') {
          throw new Error(body.message || 'Submission rejected');
        }
        setLoading(false);
        showSuccessPage(data);
      } catch (err) {
        setLoading(false);
        showErr('We could not submit your message just now. Please try again, or email <a href="' + mailto + '">' + CONFIG.CONTACT_TO + '</a> directly.');
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
