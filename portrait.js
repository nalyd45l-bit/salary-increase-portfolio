(() => {
  'use strict';
  const photo = document.querySelector('#profile-photo');
  const fallback = document.querySelector('#portrait-fallback');
  const input = document.querySelector('#portrait-file');
  const reset = document.querySelector('#portrait-remove');
  const status = document.querySelector('#portrait-status');
  const publishedPhoto = photo.getAttribute('src');
  let previewUrl;
  let revision = 0;
  const loaded = image => new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth) { resolve(); return; }
    image.onload = resolve; image.onerror = reject;
  });
  const restore = async () => {
    if (!publishedPhoto) { photo.hidden = true; photo.removeAttribute('src'); fallback.hidden = false; return; }
    photo.src = publishedPhoto;
    await loaded(photo);
    if (photo.decode) await photo.decode();
    photo.hidden = false;
    fallback.hidden = true;
  };
  const run = task => { window.portfolioPortraitReady = task.catch(() => { photo.hidden = true; fallback.hidden = false; status.textContent = 'Не удалось загрузить фото. Попробуйте обновить страницу.'; }); };
  run(restore());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      status.textContent = 'Выберите JPG, PNG или WebP размером до 8 МБ.'; input.value = ''; return;
    }
    const ticket = ++revision;
    run((async () => {
      const url = URL.createObjectURL(file);
      try {
        const candidate = new Image(); candidate.src = url; await loaded(candidate);
        if (ticket !== revision) { URL.revokeObjectURL(url); return; }
        photo.src = url; await loaded(photo);
        if (photo.decode) await photo.decode();
        const previous = previewUrl; previewUrl = url;
        photo.hidden = false; fallback.hidden = true; reset.hidden = false;
        if (previous) URL.revokeObjectURL(previous);
        status.textContent = 'Фото добавлено во временный предпросмотр для PDF. Опубликованный портрет остаётся прежним.';
      } catch { URL.revokeObjectURL(url); status.textContent = 'Не удалось открыть изображение. Попробуйте другой файл.'; }
      finally { input.value = ''; }
    })());
  });
  reset.addEventListener('click', () => {
    revision++;
    run((async () => {
      await restore();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = undefined; reset.hidden = true;
      status.textContent = publishedPhoto ? 'Восстановлено фото, опубликованное на сайте.' : 'Временное фото убрано.';
    })());
  });
})();
