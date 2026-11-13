(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let ready = document.readyState === 'complete';
  let printing = false;
  const players = [...document.querySelectorAll('[data-ambient]')].map(scene => {
    const video = scene.querySelector('video');
    const frame = scene.querySelector('.hero-media') || scene;
    const status = scene.querySelector('[role="status"]');
    let visible = false;
    let loaded = false;
    let pending = false;
    let failed = false;
    const allowed = () => !reduced.matches && !connection?.saveData;
    const sync = async () => {
      if (!ready || printing || !allowed() || !visible || document.hidden) { video.pause(); return; }
      if (pending || failed) return;
      if (!loaded) {
        video.muted = true;
        video.defaultMuted = true;
        video.querySelectorAll('source').forEach(source => { source.src = source.dataset.src; });
        loaded = true;
        video.load();
      }
      pending = true;
      try {
        await video.play();
        if (!visible || document.hidden || printing || !allowed()) video.pause();
        if (status) status.textContent = '';
      } catch (error) {
        if (error.name !== 'AbortError' && visible && !printing && !document.hidden) {
          failed = true;
          if (status) status.textContent = 'Автозапуск недоступен. Показана заставка.';
        }
      } finally { pending = false; }
    };
    video.addEventListener('playing', () => { frame.classList.add('is-playing'); scene.classList.add('is-playing'); });
    video.addEventListener('error', () => {
      failed = true; frame.classList.remove('is-playing'); scene.classList.remove('is-playing');
      if (status) status.textContent = 'Видео недоступно. Показана заставка.';
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        scene.classList.toggle('is-on-screen', visible);
        sync();
      }, { threshold: .1 }).observe(scene.querySelector('.fn-sticky') || scene);
    } else { visible = true; }
    return { sync, retry() { failed = false; sync(); } };
  });
  const syncAll = () => players.forEach(player => player.sync());
  window.addEventListener('load', () => { ready = true; syncAll(); }, { once: true });
  document.addEventListener('visibilitychange', syncAll);
  window.addEventListener('beforeprint', () => { printing = true; syncAll(); });
  window.addEventListener('afterprint', () => { printing = false; syncAll(); });
  reduced.addEventListener('change', syncAll);
  connection?.addEventListener('change', syncAll);
  // Retry blocked silent autoplay on the first ordinary interaction, without player UI.
  document.addEventListener('pointerdown', () => players.forEach(player => player.retry()), { once: true });
  if (ready) syncAll();
})();
