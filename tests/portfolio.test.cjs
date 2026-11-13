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
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
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
      if (!value || /^(https?:|data:)/.test(value)) continue;
      if (value.startsWith('#')) assert.ok(document.getElementById(value.slice(1)), value);
      else assert.ok(fs.existsSync(path.join(root, value)), value);
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
  const video = document.querySelector('video');
  for (const attr of ['autoplay', 'muted', 'loop', 'playsinline', 'poster']) assert.ok(video.hasAttribute(attr));
  assert.equal(video.hasAttribute('controls'), false);
  assert.equal(video.getAttribute('preload'), 'none');
  assert.equal(video.querySelectorAll('source[data-src]').length, 2);
  assert.equal(video.querySelector('source[media]').getAttribute('media'), '(max-width: 700px)');
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
  video.load = () => { state.loads++; };
  video.play = async () => {
    state.plays++;
    if (autoplayBlocked) throw Object.assign(new Error('Autoplay disallowed'), { name: 'NotAllowedError' });
    video.dispatchEvent(new window.Event('playing'));
  };
  video.pause = () => { state.pauses++; };
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
  vm.runInNewContext(app, { window, document, navigator: { connection: { saveData, addEventListener() {} } }, IntersectionObserver });
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

test('video starts after page load, pauses offscreen and resumes on return', async () => {
  const r = runtime({ ready: false });
  r.observers[0].callback([{ isIntersecting: true }]);
  assert.equal(r.state.loads, 0);
  r.window.dispatchEvent(new r.window.Event('load'));
  await flush();
  assert.equal(r.state.loads, 1);
  assert.equal(r.video.muted, true);
  assert.ok(r.document.querySelector('.hero-media').classList.contains('is-playing'));
  const plays = r.state.plays;
  r.observers[0].callback([{ isIntersecting: false }]);
  await flush();
  assert.ok(r.state.pauses > 0);
  r.observers[0].callback([{ isIntersecting: true }]);
  await flush();
  assert.equal(r.state.plays, plays + 1);
  r.document.querySelector('#motion-toggle').click();
  await flush();
  assert.match(r.document.querySelector('#motion-toggle').textContent, /Включить/);
});

test('reduced motion and data saving show a poster until the visitor explicitly starts playback', async () => {
  for (const settings of [{ reduced: true }, { saveData: true }]) {
    const r = runtime(settings);
    await flush();
    assert.equal(r.state.loads, 0);
    assert.equal(r.state.plays, 0);
    r.document.querySelector('#motion-toggle').click();
    await flush();
    assert.equal(r.state.loads, 1);
    assert.equal(r.state.plays, 1);
  }
});

test('blocked autoplay and media errors keep a usable poster and retry action', async () => {
  const r = runtime({ autoplayBlocked: true });
  await flush();
  assert.match(r.document.querySelector('#motion-toggle').textContent, /Включить/);
  assert.match(r.document.querySelector('#media-status').textContent, /Автозапуск недоступен/);
  r.video.dispatchEvent(new r.window.Event('error'));
  assert.equal(r.document.querySelector('.hero-media').classList.contains('is-playing'), false);
  assert.match(r.document.querySelector('#media-status').textContent, /заставка/);
});
