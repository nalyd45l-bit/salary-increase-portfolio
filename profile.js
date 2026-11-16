(() => {
  'use strict';
  const start = document.querySelector('#employment-start');
  const tenure = document.querySelector('#profile-tenure');
  const plural = (number, one, few, many) => {
    const last = number % 10;
    const lastTwo = number % 100;
    return last === 1 && lastTwo !== 11 ? one : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
  };
  const updateTenure = () => {
    if (!start || !tenure) return;
    const [year, month, day] = start.getAttribute('datetime').split('-').map(Number);
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Moscow', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const today = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    const currentDay = Date.UTC(today.year, today.month - 1, today.day);
    if (currentDay < Date.UTC(year, month - 1, day)) { tenure.hidden = true; return; }
    let totalMonths = (today.year - year) * 12 + today.month - month;
    if (today.day < day) totalMonths--;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const days = Math.round((currentDay - Date.UTC(year, month - 1 + totalMonths, day)) / 86400000);
    const result = [
      years && `${years} ${plural(years, 'год', 'года', 'лет')}`,
      months && `${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}`,
      days && `${days} ${plural(days, 'день', 'дня', 'дней')}`
    ].filter(Boolean).join(' ');
    tenure.textContent = result || 'Первый день в LIFE PAY';
    tenure.hidden = false;
  };
  updateTenure();
  window.setInterval(updateTenure, 60000);
  document.addEventListener('visibilitychange', updateTenure);
  window.addEventListener('beforeprint', updateTenure);

  // Native details remain usable without JavaScript; this control opens the whole list.
  const directions = [...document.querySelectorAll('.responsibility-item')];
  const toggle = document.querySelector('#toggle-responsibilities');
  if (toggle && directions.length) {
    const sync = () => {
      const allOpen = directions.every(item => item.open);
      toggle.textContent = allOpen ? 'Свернуть всё' : 'Раскрыть всё';
      toggle.setAttribute('aria-expanded', String(allOpen));
    };
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const open = !directions.every(item => item.open);
      directions.forEach(item => { item.open = open; });
      sync();
    });
    directions.forEach(item => item.addEventListener('toggle', sync));
    window.addEventListener('beforeprint', sync);
    window.addEventListener('afterprint', sync);
    sync();
  }

  const photo = document.querySelector('#profile-photo');
  const fallback = document.querySelector('#portrait-fallback');
  const status = document.querySelector('#portrait-status');
  if (!photo || !fallback) return;
  const loaded = new Promise((resolve, reject) => {
    if (photo.complete) { photo.naturalWidth ? resolve() : reject(); return; }
    photo.addEventListener('load', resolve, { once: true });
    photo.addEventListener('error', reject, { once: true });
  });
  window.portfolioPortraitReady = loaded.then(async () => {
    if (photo.decode) await photo.decode();
    photo.hidden = false;
    fallback.hidden = true;
  }).catch(() => {
    photo.hidden = true;
    fallback.hidden = false;
    if (status) status.textContent = 'Не удалось загрузить фото. Попробуйте обновить страницу.';
  });
})();
