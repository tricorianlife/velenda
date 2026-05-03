(function () {
  'use strict';

  var CONFIG = {
    TRICORIAN_HOME: 'https://www.tricorian.com/',
    HEADER_URL: 'header.html',
    FOOTER_URL: 'footer.html',
    CONTACT_TO: 'sales@tricorian' + '.' + 'com',
    CONTACT_ENDPOINT: 'https://www.tricorian.com/contact/velenda/',
    TURNSTILE_SITE_KEY: '0x4AAAAAAAQ56bsIs2w5_qkd'
  };

  var MODE_LABEL = {
    general:     { btn: 'Send message',                  subject: 'General enquiry' },
    partnership: { btn: 'Request demo',                  subject: 'Pharma partnership / demo request' },
    materials:   { btn: 'Submit materials enquiry',      subject: 'Raw materials enquiry' },
    investor:    { btn: 'Send to investor relations',    subject: 'Investor relations enquiry' },
    supplier:    { btn: 'Submit supplier enquiry',       subject: 'Supplier onboarding enquiry' }
  };

  function applyTokens(html) {
    return html
      .replace(/\{\{TRICORIAN_HOME\}\}/g, CONFIG.TRICORIAN_HOME)
      .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));
  }

  async function loadFragment(url, slotId) {
    var slot = document.getElementById(slotId);
    if (!slot) return false;
    try {
      var res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('fetch ' + url + ' -> ' + res.status);
      var html = applyTokens(await res.text());
      slot.outerHTML = html;
      return true;
    } catch (err) {
      console.warn('[Velenda] Could not load ' + url, err);
      slot.innerHTML =
        '<div style="padding:14px 24px;font-family:monospace;font-size:12px;color:#0E1F3D;background:#fdf2c8;border:1px solid #e6c84a;">' +
        'Could not load <strong>' + url + '</strong>. Open this site through a local web server.' +
        '</div>';
      return false;
    }
  }

  function wire() {
    var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.vl-header__link[data-nav]').forEach(function (a) {
      if ((a.dataset.nav || '').toLowerCase() === path) a.classList.add('is-active');
    });
    if (path === '' && document.querySelector('.vl-header__link[data-nav="index.html"]')) {
      document.querySelector('.vl-header__link[data-nav="index.html"]').classList.add('is-active');
    }

    var header = document.getElementById('vlHeader');
    var onScroll = function () {
      if (!header) return;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var toggle = document.getElementById('vlToggle');
    var nav    = document.getElementById('vlNav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var cursor = document.querySelector('.vl-cursor');
    if (cursor && !matchMedia('(pointer:coarse)').matches) {
      window.addEventListener('mousemove', function (e) {
        cursor['style'].setProperty('--cx', e.clientX + 'px');
        cursor['style'].setProperty('--cy', e.clientY + 'px');
      }, { passive: true });
    }

    if ('IntersectionObserver' in window) {
      var els = document.querySelectorAll('.vl-reveal');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var t = entry['target'];
            t.classList.add('is-in');
            io.unobserve(t);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (el) { io.observe(el); });
    } else {
      document.querySelectorAll('.vl-reveal').forEach(function (el) { el.classList.add('is-in'); });
    }

    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var touch  = matchMedia('(pointer:coarse)').matches;
    if (!reduce && !touch) {
      document.querySelectorAll('[data-tilt]').forEach(function (el) {
        el.addEventListener('mousemove', function (e) {
          var r = el.getBoundingClientRect();
          var rTop = r['top'];
          var x = (e.clientX - r.left) / r.width  - 0.5;
          var y = (e.clientY - rTop)  / r.height - 0.5;
          el['style'].transform = 'perspective(900px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
          el['style'].setProperty('--mx', (e.clientX - r.left) + 'px');
          el['style'].setProperty('--my', (e.clientY - rTop) + 'px');
        });
        el.addEventListener('mouseleave', function () { el['style'].transform = ''; });
      });
    }

    initContactForm();
  }

  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    var modesRoot      = form.querySelector('.vl-modes');
    var panels         = form.querySelectorAll('.vl-mode-panel');
    var submitLabelEl  = form.querySelector('[data-submit-label]');
    var matsContainer  = form.querySelector('#vlMaterials');
    var matsTpl        = form.querySelector('#vlMaterialTpl');
    var addMatBtn      = form.querySelector('#vlAddMaterial');
    var turnstileMount = form.querySelector('#vlTurnstile');
    var submitBtn      = form.querySelector('#vlSubmit');
    var spinner        = form.querySelector('#vlSpinner');
    var okBox          = form.querySelector('#vlOk');
    var errBox         = form.querySelector('#vlErr');
    var errMsg         = form.querySelector('#vlErrMsg');

    var allowedModes = ['general','partnership','materials','investor','supplier'];
    var params = new URLSearchParams(location['search']);
    var fromUrl = params.get('type');
    if (fromUrl && allowedModes.indexOf(fromUrl) !== -1) {
      var rsel = form.querySelector('input[name="form_type"][value="' + fromUrl + '"]');
      if (rsel) rsel.checked = true;
    }

    function activeMode() {
      var rr = form.querySelector('input[name="form_type"]:checked');
      return rr ? rr.value : 'general';
    }

    function applyMode(mode) {
      panels.forEach(function (p) { p.classList.toggle('is-active', p.dataset.mode === mode); });
      if (submitLabelEl && MODE_LABEL[mode]) submitLabelEl.textContent = MODE_LABEL[mode].btn;
      form.querySelectorAll('[data-required-when]').forEach(function (el) {
        var need = el.getAttribute('data-required-when');
        if (need === mode) el.setAttribute('required', '');
        else                el.removeAttribute('required');
      });
      var matRequired = (mode === 'materials');
      form.querySelectorAll('[data-mat-required]').forEach(function (el) {
        if (matRequired) el.setAttribute('required', '');
        else              el.removeAttribute('required');
      });
    }

    if (modesRoot) {
      modesRoot.addEventListener('change', function (e) {
        var t = e['target'];
        if (t['name'] === 'form_type') applyMode(t.value);
      });
    }
    applyMode(activeMode());

    form.addEventListener('input', function (e) {
      var t = e['target'];
      if (t && t.removeAttribute) t.removeAttribute('aria-invalid');
    });

    var matIndex = 0;
    function renderMaterial() {
      if (!matsTpl || !matsContainer) return;
      var html = matsTpl.innerHTML
        .replace(/__INDEX__/g, String(matIndex))
        .replace(/__N__/g, String(matsContainer.children.length + 1));
      var wrap = document.createElement('div');
      wrap.innerHTML = html.trim();
      var node = wrap.firstChild;
      matsContainer.appendChild(node);
      matIndex++;
      updateMaterialRemoveButtons();
      applyMode(activeMode());
    }
    function updateMaterialRemoveButtons() {
      var rows = matsContainer ? matsContainer.children : [];
      Array.from(rows).forEach(function (row, i) {
        var head = row.querySelector('.vl-material__head span');
        if (head) head.textContent = 'Material #' + (i + 1);
        var rm = row.querySelector('.vl-material__remove');
        if (rm) rm.toggleAttribute('hidden', rows.length <= 1);
      });
    }
    if (addMatBtn) addMatBtn.addEventListener('click', renderMaterial);
    if (matsContainer) {
      matsContainer.addEventListener('click', function (e) {
        var t = e['target'];
        var btn = t.closest('.vl-material__remove');
        if (!btn) return;
        var row = btn.closest('.vl-material');
        if (row && matsContainer.children.length > 1) {
          row.remove();
          updateMaterialRemoveButtons();
        }
      });
      renderMaterial();
    }

    var turnstileWidgetId = null;
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
      var poll = setInterval(function () {
        if (window.turnstile) { mountTurnstile(); clearInterval(poll); }
      }, 200);
      setTimeout(function () { clearInterval(poll); }, 8000);
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
      var data = {};
      var fd = new FormData(form);
      fd.forEach(function (value, key) {
        var m = key.match(/^materials\[(\d+)\]\[(\w+)\]$/);
        if (m) {
          data.materials = data.materials || [];
          var idx = Number(m[1]);
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
        data.materials = data.materials.filter(function (row) {
          return row && (row['name'] || row.cas);
        });
      }
      data.form_type = activeMode();
      data.subject_label = (MODE_LABEL[data.form_type] || {}).subject || 'Velenda enquiry';
      data.submitted_at = new Date().toISOString();
      data.source = 'velenda';
      var ts = getTurnstileToken();
      if (ts) data['cf-turnstile-response'] = ts;
      return data;
    }

    function buildMailtoFallback(data) {
      var subj = '[Velenda] ' + data.subject_label + ' - ' +
        ((data.first_name || '') + ' ' + (data.last_name || '')).trim();
      var lines = [];
      Object.keys(data).forEach(function (k) {
        if (k === 'materials' || k.charAt(0) === '_' || k === 'cf-turnstile-response') return;
        var v = data[k];
        if (v === '' || v == null) return;
        lines.push(k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
      });
      if (Array.isArray(data.materials) && data.materials.length) {
        data.materials.forEach(function (m, i) {
          lines.push('Material ' + (i+1) + ' name: ' + (m['name'] || ''));
          lines.push('Material ' + (i+1) + ' CAS: ' + (m.cas || ''));
        });
      }
      return 'mailto:' + CONFIG['CONTACT_TO'] +
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

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function validate(data) {
      var fail = [];
      if (!data.first_name) fail.push({ label: 'first name', selector: '#cf-first' });
      if (!data.last_name)  fail.push({ label: 'last name',  selector: '#cf-last'  });
      var em = data['email'];
      if (!em) {
        fail.push({ label: 'work email', selector: '#cf-email' });
      } else if (!EMAIL_RE.test(em)) {
        fail.push({ label: 'work email (please check the @ and domain)', selector: '#cf-email' });
      }
      var co = data['company'];
      if (!co)  fail.push({ label: 'company',  selector: '#cf-company'  });
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
          var incomplete = data.materials.some(function (m) { return !m['name'] || !m.cas; });
          if (incomplete) fail.push({ label: 'material name and CAS number for every row', selector: '#vlMaterials input' });
        }
      } else if (data.form_type === 'investor') {
        if (!data.investor_firm) fail.push({ label: 'firm name', selector: '#cf-inv-firm' });
      }
      return fail;
    }

    function clearFieldErrors() {
      form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    }
    function markFieldErrors(issues) {
      issues.forEach(function (iss) {
        var el = form.querySelector(iss.selector);
        if (el) el.setAttribute('aria-invalid', 'true');
      });
      if (issues.length) {
        var first = form.querySelector(issues[0].selector);
        if (first) {
          try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); }
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      okBox.classList.add('is-hidden');
      errBox.classList.add('is-hidden');
      clearFieldErrors();

      var data = collect();
      var issues = validate(data);
      if (issues.length) {
        markFieldErrors(issues);
        var labels = issues['map'](function (i) { return i.label; }).join(', ');
        showErr('Please complete: ' + labels + '.');
        return;
      }

      setLoading(true);
      var mailto = buildMailtoFallback(data);

      try {
        var res = await fetch(CONFIG['CONTACT_ENDPOINT'], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var body = null;
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
        showErr('We could not submit your message just now. Please try again, or email <a href="' + mailto + '">' + CONFIG['CONTACT_TO'] + '</a> directly.');
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
