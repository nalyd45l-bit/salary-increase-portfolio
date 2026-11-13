(() => {
  'use strict';
  const salary = document.querySelector('#proposal-salary');
  const format = document.querySelector('#proposal-pay-format');
  const date = document.querySelector('#proposal-date');
  const text = document.querySelector('#proposal-text');
  const status = document.querySelector('#proposal-status');
  const base = 'Предлагаю обсудить пересмотр оплаты с учётом фактической зоны ответственности: сопровождения сервисных партнёров, работы с данными об оборудовании и вклада в цифровые инструменты LIFE PAY.';
  const update = () => {
    const amount = Number(salary.value);
    const money = salary.value && salary.validity.valid && amount > 0;
    const pay = money ? ` Предлагаю обсудить фиксированный оклад ${new Intl.NumberFormat('ru-RU').format(amount)} ₽ в месяц${format.value === 'net' ? ' на руки' : format.value === 'gross' ? ' до вычета налогов' : '; формат оплаты согласовать на встрече'}.` : ' Размер фиксированного оклада предлагаю согласовать на встрече.';
    const day = date.value && date.validity.valid ? ` Желаемая дата изменения условий — ${new Intl.DateTimeFormat('ru-RU').format(new Date(`${date.value}T12:00:00`))}.` : ' Дату изменения условий предлагаю определить совместно.';
    text.textContent = `${base}${pay}${day} Прошу согласовать содержание роли, приоритеты развития, критерии результата и срок следующего пересмотра.`;
    status.textContent = '';
  };
  [salary, format, date].forEach(input => input.addEventListener('input', update));
  document.querySelector('#copy-proposal').addEventListener('click', async () => {
    const content = text.textContent;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(content);
      status.textContent = 'Текст скопирован. Его можно вставить в сообщение руководителю.';
    } catch {
      const fallback = document.querySelector('#proposal-copy-fallback');
      fallback.value = content;
      fallback.classList.remove('sr-only');
      fallback.focus();
      fallback.select();
      status.textContent = 'Текст выделен. Скопируйте его через меню браузера или Ctrl/Cmd+C.';
    }
  });

  const nameInput = document.querySelector('#profile-name-input');
  const managerInput = document.querySelector('#profile-manager-input');
  nameInput.addEventListener('input', () => {
    const name = document.querySelector('#profile-name');
    name.textContent = nameInput.value.trim();
    name.hidden = !name.textContent;
  });
  managerInput.addEventListener('input', () => {
    const manager = document.querySelector('#profile-manager');
    manager.textContent = managerInput.value.trim();
    document.querySelector('#profile-manager-row').hidden = !manager.textContent;
  });
  let photoUrl;
  const photo = document.querySelector('#profile-photo');
  const portraitStatus = document.querySelector('#portrait-status');
  document.querySelector('#portrait-file').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      portraitStatus.textContent = 'Выберите JPG, PNG или WebP размером до 8 МБ.';
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    photo.onload = () => {
      photo.hidden = false;
      document.querySelector('#portrait-fallback').hidden = true;
      portraitStatus.textContent = 'Фото добавлено в эту вкладку и будет включено в PDF.';
    };
    photo.onerror = () => { portraitStatus.textContent = 'Не удалось открыть изображение. Попробуйте другой файл.'; };
    photo.src = photoUrl;
  });
  update();
})();
