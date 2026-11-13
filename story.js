(() => {
  'use strict';
  const journey = document.querySelector('#fn-journey');
  const sticky = document.querySelector('.fn-sticky');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const navHeight = document.querySelector('.sitebar').getBoundingClientRect().height;
    const bounds = journey.getBoundingClientRect();
    journey.classList.toggle('story-has-content', bounds.top < navHeight - sticky.offsetHeight * .65);
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
  const setNavHeight = () => {
    document.documentElement.style.setProperty('--nav-height', `${Math.ceil(document.querySelector('.sitebar').getBoundingClientRect().height)}px`);
    schedule();
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', setNavHeight);
  if ('ResizeObserver' in window) new ResizeObserver(setNavHeight).observe(document.querySelector('.sitebar'));
  setNavHeight();
  const items = [...document.querySelectorAll('.section-heading, .responsibility-grid article, .project, .outcomes article, .market-section > .market-grid > article, .profile-grid, .project-index a, .project-summary, .case-pair>div, .development, .proposal-agreements article, .proposal-letter, .brand-finale')];
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
      const group = item.parentElement;
      const order = group.matches('.responsibility-grid,.market-grid,.project-index,.proposal-agreements,.outcomes') ? [...group.children].indexOf(item) : 0;
      item.style.setProperty('--reveal-delay', `${Math.min(order, 3) * 55}ms`);
      if (!item.classList.contains('is-assembled')) revealObserver.observe(item);
    });
  };
  reduceMotion.addEventListener('change', configureReveals);
  configureReveals();
})();
