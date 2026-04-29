/* =====================================================================
   VELENDA — Site-wide JS
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
    FOOTER_URL: 'footer.html'
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
        '(e.g. <code>npx serve</code> or <code>python -m http.server</code>) — browsers block ' +
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
