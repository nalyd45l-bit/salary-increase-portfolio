(() => {
  'use strict';
  const menu = document.querySelector('#navlinks');
  const menuButton = document.querySelector('.menu-toggle');
  const setMenu = open => {
    menu.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menuButton.textContent = open ? '×' : '☰';
  };
  menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', event => {
    if (!event.target.closest('.nav')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('open')) {
      setMenu(false);
      menuButton.focus();
    }
  });
  const mobileMenu = window.matchMedia('(max-width: 700px)');
  mobileMenu.addEventListener('change', () => setMenu(false));

  // Preserve the reader's collapsed sections while making every case available in PDF.
  let savedDetails;
  const expandForPrint = () => {
    if (savedDetails) return;
    if (imageDialog.open) imageDialog.close();
    savedDetails = [...document.querySelectorAll('details')].map(node => [node, node.open]);
    savedDetails.forEach(([node]) => { node.open = true; });
  };
  const restoreAfterPrint = () => {
    savedDetails?.forEach(([node, open]) => { node.open = open; });
    savedDetails = undefined;
  };
  document.querySelectorAll('.print-button').forEach(button => {
    button.addEventListener('click', () => { expandForPrint(); window.print(); });
  });
  window.addEventListener('beforeprint', expandForPrint);
  window.addEventListener('afterprint', restoreAfterPrint);

  const imageDialog = document.querySelector('#image-dialog');
  const dialogImage = document.querySelector('#dialog-image');
  const imageCaption = document.querySelector('#image-caption');
  document.querySelectorAll('[data-lightbox]').forEach(link => {
    link.addEventListener('click', event => {
      // Keep direct image links usable when <dialog> is unavailable.
      if (typeof imageDialog.showModal !== 'function') return;
      event.preventDefault();
      const sourceImage = link.querySelector('img');
      dialogImage.src = link.getAttribute('href');
      dialogImage.alt = sourceImage.alt;
      imageCaption.textContent = sourceImage.alt;
      imageDialog.showModal();
      document.body.classList.add('has-dialog');
    });
  });
  imageDialog.querySelector('.dialog-close').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', event => {
    if (event.target !== imageDialog) return;
    const bounds = imageDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) imageDialog.close();
  });
  imageDialog.addEventListener('close', () => document.body.classList.remove('has-dialog'));

  const progress = document.querySelector('#scroll-progress');
  const navLinks = [...menu.querySelectorAll('a')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href')));
  let scheduled = false;
  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
    let current;
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= 160) current = section.id;
    });
    navLinks.forEach(link => {
      if (link.getAttribute('href') === `#${current}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  };
  const scheduleScroll = () => {
    if (!scheduled) { scheduled = true; window.requestAnimationFrame(updateScroll); }
  };
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll);
  updateScroll();

  const video = document.querySelector('#hero-video');
  const videoFrame = document.querySelector('.hero-media');
  const motionButton = document.querySelector('#motion-toggle');
  const mediaStatus = document.querySelector('#media-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let loaded = false;
  let visible = true;
  let requestedPlayback = !reducedMotion.matches && !connection?.saveData;
  let pendingPlay = false;
  let pageLoaded = document.readyState === 'complete';
  const updateMotionButton = () => {
    motionButton.textContent = requestedPlayback ? 'Пауза анимации Ⅱ' : 'Включить анимацию ↻';
    motionButton.setAttribute('aria-label', requestedPlayback ? 'Приостановить фоновую анимацию' : 'Воспроизвести фоновую анимацию');
  };
  const loadVideo = () => {
    if (loaded) return;
    video.muted = true;
    video.defaultMuted = true;
    video.querySelectorAll('source').forEach(source => { source.src = source.dataset.src; });
    loaded = true;
    video.load();
  };
  const syncPlayback = async () => {
    if (!requestedPlayback || !visible || document.hidden || !pageLoaded) {
      video.pause();
      updateMotionButton();
      return;
    }
    if (pendingPlay) return;
    loadVideo();
    pendingPlay = true;
    try {
      await video.play();
      if (!requestedPlayback || !visible || document.hidden) video.pause();
      mediaStatus.textContent = '';
    } catch (error) {
      // Mobile battery-saving and autoplay policies may reject play without a tap.
      if (error.name !== 'AbortError' && requestedPlayback && visible && !document.hidden) {
        requestedPlayback = false;
        mediaStatus.textContent = 'Автозапуск недоступен. Используйте кнопку «Включить анимацию».';
      }
    } finally {
      pendingPlay = false;
      updateMotionButton();
    }
  };
  video.addEventListener('playing', () => videoFrame.classList.add('is-playing'));
  video.addEventListener('error', () => {
    videoFrame.classList.remove('is-playing');
    requestedPlayback = false;
    mediaStatus.textContent = 'Видео недоступно. Показана заставка.';
    updateMotionButton();
  });
  motionButton.hidden = false;
  motionButton.addEventListener('click', () => {
    requestedPlayback = !requestedPlayback;
    syncPlayback();
  });
  reducedMotion.addEventListener('change', () => {
    requestedPlayback = !reducedMotion.matches && !connection?.saveData;
    syncPlayback();
  });
  connection?.addEventListener('change', () => {
    if (connection.saveData) { requestedPlayback = false; syncPlayback(); }
  });
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: 0.05 });
    observer.observe(videoFrame);
  }
  // Delay network transfer until the poster and main document have loaded.
  if (document.readyState === 'complete') syncPlayback();
  else window.addEventListener('load', () => { pageLoaded = true; syncPlayback(); }, { once: true });
  updateMotionButton();
})();
