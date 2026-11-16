(() => {
  'use strict';
  const salary = document.querySelector('#proposal-salary');
  const format = document.querySelector('#proposal-pay-format');
  const date = document.querySelector('#proposal-date');
  const text = document.querySelector('#proposal-text');
  const status = document.querySelector('#proposal-status');
  const fallback = document.querySelector('#proposal-copy-fallback');
  // Keep the user-approved paragraphs in static HTML as the single source of copy.
  const base = [...text.querySelectorAll('p')].map(paragraph => paragraph.textContent);
  const invalidInput = () => [salary, date].find(input => !input.validity.valid);
  const update = () => {
    const terms = [];
    const amount = Number(salary.value);
    const money = salary.value && salary.validity.valid && amount > 0;
    if (money) {
      terms.push(`Предлагаю обсудить фиксированный оклад ${new Intl.NumberFormat('ru-RU').format(amount)} ₽ в месяц${format.value === 'net' ? ' на руки' : format.value === 'gross' ? ' до вычета налогов' : '; формат оплаты согласовать на встрече'}.`);
    } else if (format.value) {
      terms.push(`Формат оплаты — ${format.value === 'net' ? 'на руки' : 'до вычета налогов'}.`);
    }
    if (date.value && date.validity.valid) {
      terms.push(`Желаемая дата изменения условий — ${new Intl.DateTimeFormat('ru-RU').format(new Date(`${date.value}T12:00:00`))}.`);
    }
    const paragraphs = [...base.slice(0, -1), ...(terms.length ? [terms.join(' ')] : []), base.at(-1)];
    text.replaceChildren(...paragraphs.map(content => {
      const paragraph = document.createElement('p');
      paragraph.textContent = content;
      return paragraph;
    }));
    // A previously revealed manual-copy field must not retain an outdated draft.
    fallback.hidden = true;
    fallback.classList.add('sr-only');
    fallback.value = '';
    const invalid = invalidInput();
    status.textContent = invalid === salary ? 'Введите целый оклад от 1 до 10 000 000 ₽.' : invalid === date ? 'Укажите корректную дату изменения условий.' : '';
  };
  [salary, format, date].forEach(input => {
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });
  window.addEventListener('beforeprint', update);
  document.querySelector('#copy-proposal').addEventListener('click', async () => {
    update();
    const invalid = invalidInput();
    if (invalid) { invalid.reportValidity(); return; }
    const content = [...text.querySelectorAll('p')].map(paragraph => paragraph.textContent).join('\n\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(content);
      status.textContent = 'Текст скопирован. Его можно вставить в сообщение руководителю.';
    } catch {
      fallback.value = content;
      fallback.hidden = false;
      fallback.classList.remove('sr-only');
      fallback.focus();
      fallback.select();
      status.textContent = 'Текст выделен. Скопируйте его через меню браузера или Ctrl/Cmd+C.';
    }
  });
  update();
})();
