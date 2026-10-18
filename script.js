(() => {
  const root = document.documentElement;
  const header = document.getElementById('siteHeader');
  const progressBar = document.getElementById('progressBar');
  const menuToggle = document.getElementById('menuToggle');
  const menuLabel = document.getElementById('menuLabel');
  const mobileNav = document.getElementById('mobileNav');
  const heroMedia = document.querySelector('.hero-media');
  const hero = document.querySelector('.hero');
  const year = document.getElementById('year');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (year) year.textContent = new Date().getFullYear();

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

  /* Header state, progress bar and a light hero parallax, batched per frame */
  let ticking = false;
  let heroVisible = true;
  const update = () => {
    const y = window.scrollY;
    const scrollable = root.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.transform = `scaleX(${scrollable > 0 ? Math.min(1, y / scrollable) : 0})`;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (heroMedia && heroVisible && !motionQuery.matches) heroMedia.style.setProperty('--py', `${Math.round(y * 0.12)}px`);
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

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(hero);
  }

  /* Active section in the main navigation */
  const navLinks = [...document.querySelectorAll('.desktop-nav a')];
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
