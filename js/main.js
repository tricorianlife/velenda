/* =====================================================================
   VELENDA / Site-wide JS
   - Fetches and injects shared header.html / footer.html
   - Cursor spotlight
   - Scroll-state header
   - Mobile nav toggle
   - IntersectionObserver reveal
   - 3D tilt on [data-tilt]

   NOTE: This file does NOT handle the contact form. The contact page has
   its own self-contained inline handler. main.js will not touch any form.
   ===================================================================== */

(function () {
  'use strict';

  var CONFIG = {
    TRICORIAN_HOME: 'https://www.tricorian.com/',
    HEADER_URL: 'header.html',
    FOOTER_URL: 'footer.html'
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
      return false;
    }
  }

  function wire() {
    var path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.vl-header__link[data-nav]').forEach(function (a) {
      if ((a.dataset.nav || '').toLowerCase() === path) a.classList.add('is-active');
    });

    var header = document.getElementById('vlHeader');
    var onScroll = function () {
      if (!header) return;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var toggle = document.getElementById('vlToggle');
    var nav = document.getElementById('vlNav');
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
    var touch = matchMedia('(pointer:coarse)').matches;
    if (!reduce && !touch) {
      document.querySelectorAll('[data-tilt]').forEach(function (el) {
        el.addEventListener('mousemove', function (e) {
          var r = el.getBoundingClientRect();
          var rTop = r['top'];
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - rTop) / r.height - 0.5;
          el['style'].transform = 'perspective(900px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
          el['style'].setProperty('--mx', (e.clientX - r.left) + 'px');
          el['style'].setProperty('--my', (e.clientY - rTop) + 'px');
        });
        el.addEventListener('mouseleave', function () { el['style'].transform = ''; });
      });
    }
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
