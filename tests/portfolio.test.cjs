'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const csstree = require('css-tree');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = ['styles.css', 'story.css', 'readability.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const parsed = () => parseHTML(html);

test('the static document has one doctype, unique IDs and no missing local resources', () => {
  const { document } = parsed();
  assert.equal((html.match(/<!doctype html>/gi) || []).length, 1);
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const node of document.querySelectorAll('[src],[href],[data-src],[poster]')) {
    for (const attr of ['src', 'href', 'data-src', 'poster']) {
      const value = node.getAttribute(attr);
      if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value)) continue;
      if (value.startsWith('#')) assert.ok(document.getElementById(value.slice(1)), value);
      else assert.ok(fs.existsSync(path.join(root, value.split(/[?#]/)[0])), value);
    }
  }
  for (const node of document.querySelectorAll('[srcset]')) {
    for (const source of node.getAttribute('srcset').split(',')) {
      assert.ok(fs.existsSync(path.join(root, source.trim().split(' ')[0])));
    }
  }
  for (const node of document.querySelectorAll('[aria-labelledby],[aria-controls]')) {
    for (const attr of ['aria-labelledby', 'aria-controls']) {
      for (const id of (node.getAttribute(attr) || '').split(' ').filter(Boolean)) {
        assert.ok(document.getElementById(id), `${attr}: ${id}`);
      }
    }
  }
});

test('four cases expose detailed descriptions and original image links without JavaScript', () => {
  const { document } = parsed();
  const projects = [...document.querySelectorAll('.project')];
  assert.equal(projects.length, 4);
  for (const project of projects) {
    assert.ok(project.querySelector('h3').textContent.length > 4);
    assert.deepEqual([...project.querySelectorAll('h4')].map(x => x.textContent), [
      'Практический результат', 'Проблема', 'Моя роль', 'Реализованные функции', 'Использованные технологии'
    ]);
    assert.ok(project.querySelector('.case-details').hasAttribute('open'));
    assert.ok(project.querySelector('img[loading="lazy"][width][height]'));
    assert.ok(project.querySelector('[data-lightbox][href]'));
    assert.ok(project.querySelector('figcaption').textContent.length > 30);
  }
  assert.equal(document.querySelector('.project-featured').id, 'project-piot');
});

test('video is muted, inline, automatic and looped without player controls or remote runtime scripts', () => {
  const { document } = parsed();
  assert.equal(document.querySelectorAll('video').length, 4);
  for (const video of document.querySelectorAll('video')) {
  for (const attr of ['autoplay', 'muted', 'loop', 'playsinline', 'poster']) assert.ok(video.hasAttribute(attr));
  assert.equal(video.hasAttribute('controls'), false);
  assert.equal(video.getAttribute('preload'), 'none');
  assert.equal(video.querySelectorAll('source[data-src]').length, 2);
  assert.equal(video.querySelector('source[media]').getAttribute('media'), '(max-width: 700px)');
  }
  assert.equal(document.querySelectorAll('script[src^="http"]').length, 0);
  for (const link of document.querySelectorAll('a[target="_blank"]')) {
    assert.ok(link.rel.includes('noopener'));
    assert.ok(link.textContent.trim() || link.getAttribute('aria-label'));
  }
});

test('CSS parses and includes explicit phone, tablet, reduced-motion and print styles', () => {
  const errors = [];
  const ast = csstree.parse(css, { onParseError: error => errors.push(error.message) });
  assert.deepEqual(errors, []);
  let media = [];
  csstree.walk(ast, node => {
    if (node.type === 'Atrule' && node.name === 'media') media.push(csstree.generate(node.prelude));
  });
  assert.ok(media.includes('(max-width:700px)'));
  assert.ok(media.includes('(max-width:850px)'));
  assert.ok(media.includes('(max-width:1100px)'));
  assert.ok(media.includes('(prefers-reduced-motion:reduce)'));
  assert.ok(media.includes('print'));
  assert.ok(css.includes('break-before:page'));
  assert.ok(css.includes('object-fit:contain'));
});

function runtime({ reduced = false, saveData = false, autoplayBlocked = false, ready = true, noDialog = false } = {}) {
  const { window, document } = parsed();
  Object.defineProperty(document, 'readyState', { value: ready ? 'complete' : 'loading', configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, writable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000 });
  window.innerHeight = 800;
  window.scrollY = 0;
  window.requestAnimationFrame = callback => { callback(); return 1; };
  const queries = new Map();
  window.matchMedia = query => {
    if (!queries.has(query)) queries.set(query, { matches: query.includes('reduced') ? reduced : false, addEventListener(_, fn) { this.change = fn; } });
    return queries.get(query);
  };
  for (const section of document.querySelectorAll('section')) section.getBoundingClientRect = () => ({ top: 1000 });
  const menuButton = document.querySelector('.menu-toggle');
  menuButton.focus = () => {};
  for (const node of document.querySelectorAll('details')) {
    Object.defineProperty(node, 'open', {
      get() { return this.hasAttribute('open'); },
      set(value) { value ? this.setAttribute('open', '') : this.removeAttribute('open'); }
    });
  }
  const video = document.querySelector('video');
  const state = { plays: 0, pauses: 0, loads: 0, printed: [] };
  for (const video of document.querySelectorAll('video')) {
  video.load = () => { state.loads++; };
  video.play = async () => {
    state.plays++;
    if (autoplayBlocked) throw Object.assign(new Error('Autoplay disallowed'), { name: 'NotAllowedError' });
    video.dispatchEvent(new window.Event('playing'));
  };
  video.pause = () => { state.pauses++; };
  }
  const dialog = document.querySelector('dialog');
  dialog.open = false;
  if (!noDialog) dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new window.Event('close')); };
  window.print = () => {
    window.dispatchEvent(new window.Event('beforeprint'));
    state.printed.push([...document.querySelectorAll('details')].every(node => node.open));
    window.dispatchEvent(new window.Event('afterprint'));
  };
  const observers = [];
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
  }
  window.IntersectionObserver = IntersectionObserver;
  const context = { window, document, navigator: { connection: { saveData, addEventListener() {} } }, IntersectionObserver };
  vm.runInNewContext(app, context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'ambient.js'), 'utf8'), context);
  return { window, document, video, state, queries, observers, dialog };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('menu opens and closes from a navigation link and Escape', () => {
  const { document, window } = runtime();
  const button = document.querySelector('.menu-toggle');
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.ok(document.querySelector('#navlinks').classList.contains('open'));
  document.querySelector('#navlinks a').click();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  button.click();
  const event = new window.Event('keydown');
  event.key = 'Escape';
  document.dispatchEvent(event);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('PDF expands every project and restores the reader’s collapsed sections', () => {
  const { document, state } = runtime();
  const first = document.querySelector('details');
  first.open = false;
  const before = [...document.querySelectorAll('details')].map(node => node.open);
  document.querySelector('#print-pdf').click();
  assert.deepEqual(state.printed, [true]);
  assert.deepEqual([...document.querySelectorAll('details')].map(node => node.open), before);
});

test('each project image can open and close; unsupported dialogs retain direct navigation', () => {
  const { document, dialog } = runtime();
  for (const link of document.querySelectorAll('[data-lightbox]')) {
    link.click();
    assert.equal(dialog.open, true);
    assert.equal(document.querySelector('#dialog-image').getAttribute('src'), link.getAttribute('href'));
    assert.ok(document.body.classList.contains('has-dialog'));
    document.querySelector('.dialog-close').click();
    assert.equal(dialog.open, false);
    assert.equal(document.body.classList.contains('has-dialog'), false);
  }
  const fallback = runtime({ noDialog: true });
  const event = new fallback.window.Event('click', { cancelable: true });
  fallback.document.querySelector('[data-lightbox]').dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
});

test('video starts after page load and resumes after a hidden tab returns', async () => {
  const r = runtime({ ready: false });
  assert.equal(r.state.loads, 0);
  r.window.dispatchEvent(new r.window.Event('load'));
  await flush();
  assert.equal(r.state.loads, 1);
  assert.equal(r.video.muted, true);
  assert.ok(r.document.querySelector('.hero-media').classList.contains('is-playing'));
  const plays = r.state.plays;
  r.document.hidden = true;
  r.document.dispatchEvent(new r.window.Event('visibilitychange'));
  await flush();
  assert.ok(r.state.pauses > 0);
  await flush();
  r.document.hidden = false;
  r.document.dispatchEvent(new r.window.Event('visibilitychange'));
  await flush();
  assert.equal(r.state.plays, plays + 1);
  assert.equal(r.document.querySelector('#motion-toggle'), null);
});

test('reduced motion and data saving retain posters without player controls', async () => {
  for (const settings of [{ reduced: true }, { saveData: true }]) {
    const r = runtime(settings);
      await flush();
    assert.equal(r.state.loads, 0);
    assert.equal(r.state.plays, 0);
    assert.equal(r.document.querySelector('.cinematic-toggle, #motion-toggle, #fn-motion-toggle'), null);
  }
});

test('blocked autoplay and media errors keep the poster without visible player UI', async () => {
  const r = runtime({ autoplayBlocked: true });
  await flush();
  assert.match(r.document.querySelector('#media-status').textContent, /Автозапуск недоступен/);
  r.video.dispatchEvent(new r.window.Event('error'));
  assert.equal(r.document.querySelector('.hero-media').classList.contains('is-playing'), false);
  assert.match(r.document.querySelector('#media-status').textContent, /заставка/);
});

// FN uses its complete video loop; all background scenes start automatically.
test('FN36 automatic video and leadership preparation have complete local assets', () => {
  const { document } = parsed();
  assert.ok(document.querySelector('#fn36 video[autoplay][muted][loop][playsinline]'));
  assert.equal(document.querySelector('#profile-name').textContent, 'Дмитрий Козлов');
  assert.equal(document.querySelector('#profile-manager').textContent, 'Владислав Ерофеев');
  assert.equal(document.querySelector('#proposal-salary').getAttribute('value'), null);
  assert.ok(document.querySelector('#copy-proposal'));
  for (const selector of ['.projects-grid', '#results', '#market', '#role-proposal', '.brand-finale', '.footer']) assert.ok(document.querySelector(selector).closest('#fn-journey'));
  assert.equal(document.querySelector('#proposal-salary').getAttribute('step'), '1');
  assert.ok(document.querySelector('.brand-finale img'));
  assert.equal(document.querySelector('.hero-bottom time'), null);
});

test('proposal pay formats are actual selectable HTML options', () => {
  const { document } = parseHTML(html);
  assert.deepEqual([...document.querySelectorAll('#proposal-pay-format option')].map(node => node.getAttribute('value')), ['', 'net', 'gross']);
});

test('account illustration is the last cinematic scene and payment links to results', () => {
  const { document } = parsed();
  assert.equal([...document.querySelectorAll('[data-cinematic]')].at(-1).id, 'account-scene');
  assert.equal(document.querySelector('#account-scene').nextElementSibling.tagName, 'FOOTER');
  assert.equal(document.querySelector('#payment-scene a').getAttribute('href'), '#results');
  assert.ok(document.querySelector('#account-scene').closest('#fn-journey'));
});
