(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const backdrop = document.createElement('div');
  backdrop.className = 'site-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const starts = ['#about', '#projects', '#payment-scene', '#role-proposal'];
  const names = ['hero', 'fn', 'payment', 'account'];
  let ready = document.readyState === 'complete';
  let printing = false;
  let scheduled = false;
  const players = [...document.querySelectorAll('[data-ambient]')].map((scene, index) => {
    const video = scene.querySelector('video');
    if (!video.id) video.id = `${names[index]}-video`;
    const frame = scene.querySelector('.hero-media') || scene;
    const status = scene.querySelector('[role="status"]');
    const layer = document.createElement('div');
    layer.className = 'site-video-layer';
    layer.dataset.scene = names[index];
    const poster = document.createElement('img');
    poster.src = video.getAttribute('poster');
    poster.alt = '';
    poster.decoding = 'async';
    layer.append(poster, video);
    backdrop.append(layer);
    let active = false;
    let loaded = false;
    let pending = false;
    let failed = false;
    const allowed = () => !reduced.matches && !connection?.saveData;
    const sync = async () => {
      if (!ready || printing || !allowed() || !active || document.hidden) { video.pause(); return; }
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
        if (!active || document.hidden || printing || !allowed()) video.pause();
        if (status) status.textContent = '';
      } catch (error) {
        if (error.name !== 'AbortError' && active && !printing && !document.hidden) {
          failed = true;
          if (status) status.textContent = 'Автозапуск недоступен. Показана заставка.';
        }
      } finally { pending = false; }
    };
    video.addEventListener('playing', () => {
      frame.classList.add('is-playing'); scene.classList.add('is-playing'); layer.classList.add('is-playing');
    });
    video.addEventListener('error', () => {
      failed = true; frame.classList.remove('is-playing'); scene.classList.remove('is-playing'); layer.classList.remove('is-playing');
      if (status) status.textContent = 'Видео недоступно. Показана заставка.';
    });
    return {
      sync,
      activate(value) { if (active !== value) { active = value; layer.classList.toggle('is-active', value); sync(); } },
      retry() { failed = false; sync(); }
    };
  });
  document.body.append(backdrop);
  document.body.classList.add('video-stage-enhanced', 'nav-on-media');
  const update = () => {
    scheduled = false;
    let active = 0;
    starts.forEach((selector, index) => {
      if (document.querySelector(selector).getBoundingClientRect().top <= window.innerHeight * .4) active = index;
    });
    backdrop.dataset.activeScene = names[active];
    players.forEach((player, index) => player.activate(index === active));
  };
  const schedule = () => { if (!scheduled) { scheduled = true; window.requestAnimationFrame(update); } };
  const syncAll = () => players.forEach(player => player.sync());
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', () => { ready = true; update(); syncAll(); }, { once: true });
  document.addEventListener('visibilitychange', syncAll);
  window.addEventListener('beforeprint', () => { printing = true; syncAll(); });
  window.addEventListener('afterprint', () => { printing = false; update(); syncAll(); });
  reduced.addEventListener('change', syncAll);
  connection?.addEventListener('change', syncAll);
  document.addEventListener('pointerdown', () => players.forEach(player => player.retry()), { once: true });
  update();
  if (ready) syncAll();
})();
