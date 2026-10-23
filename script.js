(() => {
  const root = document.documentElement;
  const header = document.getElementById('siteHeader');
  const progressBar = document.getElementById('progressBar');
  const menuToggle = document.getElementById('menuToggle');
  const menuLabel = document.getElementById('menuLabel');
  const mobileNav = document.getElementById('mobileNav');
  const hero = document.querySelector('.hero-wrap');
  const year = document.getElementById('year');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (year) year.textContent = new Date().getFullYear();

  /* Hero headline: one sentence that unfolds into the three-line composition */
  const title = document.getElementById('heroTitle');
  if (title) {
    const words = [...title.querySelectorAll('.w')];
    const lines = [...title.querySelectorAll('.line')];
    const unfold = () => {
      if (motionQuery.matches || !words.length || !title.animate) { title.classList.add('is-ready'); return; }
      const box = title.getBoundingClientRect();
      const rects = words.map(w => w.getBoundingClientRect());
      const space = parseFloat(getComputedStyle(title).fontSize) * 0.24;
      const oneLine = rects.reduce((sum, r) => sum + r.width, 0) + space * (words.length - 1);
      const avail = Math.min(title.parentElement.clientWidth, window.innerWidth - 40);
      const scale = Math.min(0.62, avail / oneLine);
      const lineH = rects[0].height * scale;
      const startY = box.top + (box.height - lineH) / 2;
      let x = box.left;
      title.classList.add('is-ready');
      title.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, delay: 350, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' });
      words.forEach((w, i) => {
        const r = rects[i];
        const dx = x - r.left, dy = startY - r.top;
        const at = (fx, fy, fs) => `translate(${(dx * fx).toFixed(1)}px, ${(dy * fy).toFixed(1)}px) scale(${(scale + (1 - scale) * fs).toFixed(4)})`;
        x += (r.width + space) * scale;
        // Words drop into their line first, then glide and grow together with their line-mates,
        // so no two words ever overlap on the way.
        w.animate([
          { transform: at(1, 1, 0), easing: 'cubic-bezier(.55, 0, .25, 1)' },
          { transform: at(0.9, 0.1, 0.1), offset: 0.45, easing: 'cubic-bezier(.3, 0, .15, 1)' },
          { transform: 'none' }
        ], { duration: 1600, delay: 1000 + lines.indexOf(w.closest('.line')) * 90, fill: 'backwards' });
      });
    };
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    if (motionQuery.matches) title.classList.add('is-ready');
    else Promise.race([fontsReady, new Promise(res => setTimeout(res, 900))]).then(() => requestAnimationFrame(unfold));
  }

  /* Scroll reveals: stagger siblings that enter together */
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  const groups = new Map();
  reveals.forEach(el => {
    const parent = el.parentElement;
    const index = groups.get(parent) || 0;
    el.style.setProperty('--d', `${Math.min(index, 5) * 90}ms`);
    groups.set(parent, index + 1);
  });

  if ('IntersectionObserver' in window && !motionQuery.matches) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => revealObserver.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  /* Header state and progress bar, batched per frame */
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const scrollable = root.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.transform = `scaleX(${scrollable > 0 ? Math.min(1, y / scrollable) : 0})`;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    ticking = false;
  };
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();

  /* Active section in the main navigation */
  // Only in-page links are tracked; links to other pages (such as /cybersecurity) are left alone.
  const navLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(section => navObserver.observe(section));
    if (hero) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) navLinks.forEach(link => link.removeAttribute('aria-current'));
      }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
    }
  }

  /* Mobile menu */
  if (menuToggle && mobileNav) {
    const focusables = () => [menuToggle, ...mobileNav.querySelectorAll('a')];
    let closeTimer;
    const setMenu = open => {
      clearTimeout(closeTimer);
      menuToggle.setAttribute('aria-expanded', String(open));
      if (menuLabel) menuLabel.textContent = open ? 'Close menu' : 'Open menu';
      document.body.classList.toggle('menu-open', open);
      if (open) {
        mobileNav.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => mobileNav.classList.add('is-open')));
      } else {
        mobileNav.classList.remove('is-open');
        closeTimer = setTimeout(() => { mobileNav.hidden = true; }, motionQuery.matches ? 0 : 400);
      }
    };
    menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => {
      if (menuToggle.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'Escape') {
        setMenu(false);
        menuToggle.focus();
      } else if (event.key === 'Tab') {
        const items = focusables();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
  }
})();
