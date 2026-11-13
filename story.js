(() => {
  'use strict';
  const story = document.querySelector('#fn36');
  const sticky = story.querySelector('.fn-sticky');
  const journey = document.querySelector('#fn-journey');
  const canvas = document.querySelector('#fn-canvas');
  const context = canvas.getContext('2d');
  const toggle = document.querySelector('#fn-motion-toggle');
  const progressBar = document.querySelector('#fn-frame-progress');
  const status = document.querySelector('#fn-motion-status');
  const hint = document.querySelector('#fn-scroll-hint');
  const labels = [...story.querySelectorAll('.fn-layer-labels li')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = !reduceMotion.matches && !navigator.connection?.saveData;
  let near = false;
  let target = 0;
  let scheduled = false;
  const cache = new Map();
  const frameCount = Number(story.dataset.frameCount);
  const path = index => `assets/media/fn36-frames/frame-${String(index).padStart(3, '0')}.webp`;
  const clamp = value => Math.max(0, Math.min(1, value));
  const paint = (index, image) => {
    if (!context || index !== target || !image.naturalWidth) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    sticky.classList.add('frames-ready');
    story.dataset.frame = String(index);
  };
  const load = index => {
    if (index < 0 || index >= frameCount) return;
    const existing = cache.get(index);
    if (existing) {
      if (existing.complete && existing.naturalWidth) paint(index, existing);
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => paint(index, image);
    image.onerror = () => { status.textContent = 'Часть анимации недоступна. Можно продолжить просмотр страницы.'; };
    cache.set(index, image);
    image.src = path(index);
    // Keep decoded memory bounded on phones. Browser HTTP cache handles revisiting frames.
    while (cache.size > 12) {
      const oldest = [...cache.keys()].find(key => key !== target);
      cache.delete(oldest);
    }
  };
  const update = () => {
    scheduled = false;
    const navHeight = document.querySelector('.sitebar').getBoundingClientRect().height;
    const bounds = journey.getBoundingClientRect();
    document.body.classList.toggle('fn-journey-active', bounds.top <= navHeight && bounds.bottom > navHeight);
    journey.classList.toggle('story-has-content', bounds.top < navHeight - sticky.offsetHeight * .65);
    if (!enabled || !near || !context || document.hidden) return;
    const travel = Math.max(1, story.offsetHeight - sticky.offsetHeight);
    const progress = clamp((navHeight - story.getBoundingClientRect().top) / travel);
    target = Math.round(progress * (frameCount - 1));
    progressBar.style.transform = `scaleX(${progress})`;
    labels.forEach((label, index) => label.classList.toggle('active', index === Math.min(2, Math.floor(progress * 3))));
    load(target);
    load(target + 1);
    load(target - 1);
  };
  const schedule = () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  };
  const updateMode = () => {
    toggle.hidden = !context;
    toggle.textContent = enabled ? 'Остановить движение' : 'Включить разбор по прокрутке';
    toggle.setAttribute('aria-pressed', String(enabled));
    hint.textContent = enabled ? 'Прокрутите вниз, чтобы разобрать ФН‑36 ↓' : 'ФН‑36 · спокойный просмотр';
    if (enabled) schedule();
  };
  toggle.addEventListener('click', () => { enabled = !enabled; updateMode(); });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  const setNavHeight = () => {
    const height = Math.ceil(document.querySelector('.sitebar').getBoundingClientRect().height);
    document.documentElement.style.setProperty('--nav-height', `${height}px`);
  };
  setNavHeight();
  window.addEventListener('resize', setNavHeight);
  if ('ResizeObserver' in window) new ResizeObserver(setNavHeight).observe(document.querySelector('.sitebar'));
  if ('IntersectionObserver' in window) {
    const storyObserver = new IntersectionObserver(entries => {
      near = entries[0].isIntersecting;
      if (near) schedule();
    }, { rootMargin: '250px 0px' });
    storyObserver.observe(story);
  } else { near = true; }

  const items = [...document.querySelectorAll('.section-heading, .responsibility-grid article, .project, .outcomes article, .market-section > .market-grid > article, .profile-grid, .proposal-agreements article, .brand-finale')];
  let revealObserver;
  const configureReveals = () => {
    revealObserver?.disconnect();
    document.body.classList.toggle('story-motion', !reduceMotion.matches);
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-assembled'));
      return;
    }
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-assembled');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    items.forEach(item => {
      item.classList.add('assembly-item');
      if (!item.classList.contains('is-assembled')) revealObserver.observe(item);
    });
  };
  reduceMotion.addEventListener('change', () => {
    enabled = !reduceMotion.matches && !navigator.connection?.saveData;
    configureReveals();
    updateMode();
  });
  navigator.connection?.addEventListener('change', () => {
    if (navigator.connection.saveData) { enabled = false; updateMode(); }
  });
  configureReveals();
  updateMode();
})();
