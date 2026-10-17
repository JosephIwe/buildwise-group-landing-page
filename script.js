(() => {
  const progressBar = document.getElementById('progressBar');
  const year = document.getElementById('year');
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (year) year.textContent = new Date().getFullYear();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    reveals.forEach((el, index) => {
      if (el.classList.contains('capability-row') || el.classList.contains('principle') || el.classList.contains('collab-item')) {
        el.style.setProperty('--delay', `${(index % 4) * 70}ms`);
      }
      observer.observe(el);
    });
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  let ticking = false;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateProgress);
      ticking = true;
    }
  }, { passive: true });
  updateProgress();

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      mobileNav.classList.toggle('open', open);
    });
    mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
      mobileNav.classList.remove('open');
    }));
  }
})();