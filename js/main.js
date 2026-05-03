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

  /* ---------- Config ---------- */
  const CONFIG = {
    TRICORIAN_HOME: 'https://www.tricorian.com/',
    HEADER_URL: 'header.html',
    FOOTER_URL: 'footer.html',
    CONTACT_TO: 'sales@tricorian.com',
    CONTACT_ENDPOINT: 'https://www.tricorian.com/contact/velenda/',
    TURNSTILE_SITE_KEY: '0x4AAAAAAAQ56bsIs2w5_qkd'
  };

  const MODE_LABEL = {
    general:     { btn: 'Send message',          subject: 'General enquiry' },
    partnership: { btn: 'Request demo',          subject: 'Pharma partnership / demo request' },
    materials:   { btn: 'Submit materials enquiry', subject: 'Raw materials enquiry' },
    investor:    { btn: 'Send to investor relations', subject: 'Investor relations enquiry' },
    supplier:    { btn: 'Submit supplier enquiry',    subject: 'Supplier onboarding enquiry' }
  };

  function applyTokens(html) {
    return html
      .replace(/\{\{TRICORIAN_HOME\}\}/g, CONFIG.TRICORIAN_HOME)
      .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
  }

  async function loadFragment(url, slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return false;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('fetch ' + url + ' -> ' + res.status);
      const html = applyTokens(await res.text());
      slot.outerHTML = html;
      return true;
    } catch (err) {
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

  function wire() {
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.vl-header__link[data-nav]').forEach((a) => {
      if ((a.dataset.nav || '').toLowerCase() === path) a.classList.add('is-active');
    });
    if (path === '' && document.querySelector('.vl-header__link[data-nav="index.html"]')) {
      document.querySelector('.vl-header__link[data-nav="index.html"]').classList.add('is-active');
    }

    const header = document.getElementById('vlHeader');
    const onScroll = () => {
      if (!header) return;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

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

    const cursor = document.querySelector('.vl-cursor');
    if (cursor && !matchMedia('(pointer:coarse)').matches) {
      window.addEventListener('mousemove', (e) => {
        cursor.style.setProperty('--cx', e.clientX + 'px');
        cursor.style.setProperty('--cy', e.clientY + 'px');
      }, { passive: true });
    }

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

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch  = matchMedia('(pointer:coarse)').matches;
    if (!reduce && !touch) {
      document.querySelectorAll('[data-tilt]').forEach((el) => {
        el.addEventListener('mousemove', (e) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width  - 0.5;
          const y = (e.clientY - r.top)  / r.height - 0.5;
          el.style.transform = 'perspective(900px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
          el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
        el.addEventListener('mouseleave', () => { el.style.transform = ''; });
      });
    }

    initContactForm();
  }

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
      form.querySelectorAll('[data-required-when]').forEach((el) => {
        const need = el.getAttribute('data-required-when');
        if (need === mode) el.setAttribute('required', '');
        else                el.removeAttribute('required');
      });
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

    form.addEventListener('input', (e) => {
      if (e.target && e.target.removeAttribute) e.target.removeAttribute('aria-invalid');
    });

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
    if (addMatBtn) addMatBtn.addEventListener('click', renderMaterial);
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
      renderMaterial();
    }

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

    function collect() {
      const data = {};
      const fd = new FormData(form);
      fd.forEach((value, key) => {
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
      if (Array.isArray(data.materials)) {
        data.materials = data.materials.filter((row) => row && (row.name || row.cas));
      }
      data.form_type = activeMode();
      data.subject_label = (MODE_LABEL[data.form_type] || {}).subject || 'Velenda enquiry';
      data.submitted_at = new Date().toISOString();
      data.source = 'velenda.com';
      const ts = getTurnstileToken();
      if (ts) data['cf-turnstile-response'] = ts;
      return data;
    }

    function buildMailtoFallback(data) {
      const subj = '[Velenda] ' + data.subject_label + ' - ' +
        ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
      const lines = [];
      Object.keys(data).forEach((k) => {
        if (k === 'materials' || k.charAt(0) === '_' || k === 'cf-turnstile-response') return;
        const v = data[k];
        if (v === '' || v == null) return;
        lines.push(k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
      });
      if (Array.isArray(data.materials) && data.materials.length) {
        data.materials.forEach((m, i) => {
          lines.push('Material ' + (i+1) + ' name: ' + (m.name || ''));
          lines.push('Material ' + (i+1) + ' CAS: ' + (m.cas || ''));
        });
      }
      return 'mailto:' + CONFIG.CONTACT_TO +
        '?subject=' + encodeURIComponent(subj) +
        '&body=' + encodeURIComponent(lines.join('\n'));
    }

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

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function validate(data) {
      const fail = [];
      if (!data.first_name) fail.push({ label: 'first name', selector: '#cf-first' });
      if (!data.last_name)  fail.push({ label: 'last name',  selector: '#cf-last'  });
      if (!data.email) {
        fail.push({ label: 'work email', selector: '#cf-email' });
      } else if (!EMAIL_RE.test(data.email)) {
        fail.push({ label: 'work email (please check the @ and domain)', selector: '#cf-email' });
      }
      if (!data.company)  fail.push({ label: 'company',  selector: '#cf-company'  });
      if (!data.location) fail.push({ label: 'location', selector: '#cf-location' });

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
      if (issues.length) {
        const first = form.querySelector(issues[0].selector);
        if (first) {
          try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); }
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      okBox.classList.add('is-hidden');
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

      try {
        const res = await fetch(CONFIG.CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let body = null;
        try { body = await res.json(); } catch (_) {}
        if (body && body.success === false) {
          throw new Error(body.error || 'Submission rejected');
        }
        form.reset();
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
        showErr('We could not submit your message just now. Please try again, or email <a href="' + mailto + '">' + CONFIG.CONTACT_TO + '</a> directly.');
      }
    });
  }

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
