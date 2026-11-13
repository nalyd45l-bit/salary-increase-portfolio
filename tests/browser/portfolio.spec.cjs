const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test('desktop and mobile portfolio: media, all cases, navigation and image enlargement', async ({ page }, testInfo) => {
  // Four full-case screenshots plus live video decoding need extra time on CI WebKit.
  test.setTimeout(150000);
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; }); });
  const errors = [];
  const failedResources = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
  });
  const start = Date.now();
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('Мой вклад');
  await expect.poll(() => page.locator('header .logo img').evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.locator('header .logo img')).toHaveAttribute('src', 'assets/lifepay-logo-BlyhidjW.svg');
  const mediaBounds = await page.locator('.hero-media').boundingBox();
  expect(mediaBounds.height).toBeGreaterThanOrEqual(180);
  expect(Math.abs(mediaBounds.y)).toBeLessThan(1);
  await expect(page.locator('.sitebar')).toHaveCSS('position', 'fixed');
  const video = page.locator('#hero-video');
  await expect.poll(() => video.evaluate(node => node.currentTime), { timeout: 30000 }).toBeGreaterThan(0.1);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveJSProperty('controls', false);
  await expect(page.locator('.hero-media')).toHaveClass(/is-playing/);
  const mediaState = await video.evaluate(node => ({ currentSrc: node.currentSrc, width: node.videoWidth, height: node.videoHeight, duration: node.duration }));
  expect(mediaState.duration).toBeCloseTo(14.1667, 1);
  const timing = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0];
    return { domContentLoadedMs: entry.domContentLoadedEventEnd, loadMs: entry.loadEventEnd, transferBytes: entry.transferSize };
  });
  await testInfo.attach('load-observation.json', { body: JSON.stringify({ environment: 'CI localhost; not a field speed score', elapsedMs: Date.now() - start, timing, mediaState }, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('hero.png') });

  const menuButton = page.locator('.menu-toggle');
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#navlinks a[href="#projects"]').click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  } else {
    await page.locator('#navlinks a[href="#projects"]').click();
  }
  await expect(page).toHaveURL(/#projects$/);
  await page.locator('.responsibility').screenshot({ path: testInfo.outputPath('responsibility.png'), animations: 'disabled', style: '.sitebar{visibility:hidden}' });
  await page.locator('#projects .section-heading').screenshot({ path: testInfo.outputPath('projects-heading.png'), animations: 'disabled', style: '.sitebar{visibility:hidden}' });
  const projects = page.locator('.project');
  await expect(projects).toHaveCount(4);
  for (const id of ['piot', 'bot', 'erp', 'workflow']) {
    const project = page.locator(`#project-${id}`);
    await project.scrollIntoViewIfNeeded();
    const image = project.locator('.project-visual img');
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    for (const heading of ['Практический результат', 'Проблема', 'Моя роль', 'Реализованные функции', 'Использованные технологии']) {
      await expect(project.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    const overflow = await project.evaluate(node => {
      const bottom = node.getBoundingClientRect().bottom;
      return Math.max(...[...node.querySelectorAll('p, li, h3, h4, a')].map(child => child.getBoundingClientRect().bottom - bottom));
    });
    expect(overflow).toBeLessThanOrEqual(1);
    await project.screenshot({ path: testInfo.outputPath(`project-${id}.png`) });
    await project.locator('[data-lightbox]').click();
    await expect(page.locator('#image-dialog')).toBeVisible();
    await expect.poll(() => page.locator('#dialog-image').evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await page.locator('.dialog-close').click();
    await expect(page.locator('#image-dialog')).not.toBeVisible();
    await project.locator('summary').click();
    await expect(project.locator('details')).not.toHaveAttribute('open', '');
    await project.locator('summary').click();
    await expect(project.locator('details')).toHaveAttribute('open', '');
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('#results').scrollIntoViewIfNeeded();
  await expect(page.locator('.outcomes article')).toHaveCount(4);
  await page.locator('#market').scrollIntoViewIfNeeded();
  await expect(page.locator('.market-section > .market-grid > .market-card')).toHaveCount(3);
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
  await testInfo.attach('javascript-errors.json', { body: JSON.stringify({ errors, failedResources }), contentType: 'application/json' });
});

test('reduced motion avoids automatic media transfers without player UI', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mediaRequests = [];
  page.on('request', request => { if (/(hero|fn36|payment|account)-(loop|mobile)\.mp4/.test(request.url())) mediaRequests.push(request.url()); });
  await page.goto('./');
  for (const selector of ['#fn36', '#payment-scene', '#account-scene']) await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(mediaRequests).toEqual([]);
  await expect(page.locator('#motion-toggle, #fn-motion-toggle, .cinematic-toggle')).toHaveCount(0);
});

test('PDF contains all cases even when the reader collapsed them', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'desktop-chrome', 'PDF generation is verified in desktop Chromium.');
  await page.goto('./');
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach(node => { node.open = false; });
    window.__originalPrint = window.print;
    window.print = () => { window.__printCalled = true; };
  });
  await page.locator('#print-pdf').click();
  expect(await page.evaluate(() => window.__printCalled)).toBe(true);
  expect(await page.locator('details').evaluateAll(nodes => nodes.every(node => node.open))).toBe(true);
  await page.emulateMedia({ media: 'print' });
  // Wait for lazy screenshots before native PDF rendering.
  await page.locator('.project-visual img').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
  await expect.poll(() => page.locator('.project-visual img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  const file = testInfo.outputPath('lifepay-portfolio.pdf');
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const buffer = fs.readFileSync(file);
  expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  expect(buffer.length).toBeGreaterThan(150000);
  const { execFileSync } = require('node:child_process');
  const rawText = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
  const pages = rawText.split('\f');
  if (!pages.at(-1).trim()) pages.pop();
  expect(pages.every(text => text.trim().length > 40)).toBe(true);
  const text = rawText.replace(/\s+/g, ' ');
  for (const title of ['Аналитика ТС ПИОТ', 'Бот ФН', 'LIFE PAY ERP', 'Передача заявок партнёрам']) expect(text).toContain(title);
  expect((text.match(/Моя роль/g) || []).length).toBe(4);
  for (const detail of ['Дмитрий Козлов', 'Владислав Ерофеев', 'Размер фиксированного оклада предлагаю согласовать на встрече']) expect(text).toContain(detail);
  expect(text).not.toContain('150 000');
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  await testInfo.attach('pdf-info.txt', { body: info, contentType: 'text/plain' });
  await testInfo.attach('portfolio.pdf', { path: file, contentType: 'application/pdf' });
});

test('FN36 animates without scrolling and video backgrounds cover every section', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const top = await page.locator('#fn36').evaluate(node => node.getBoundingClientRect().top + scrollY);
  const header = await page.locator('.sitebar').evaluate(node => node.getBoundingClientRect().height);
  await page.evaluate(({ top, header }) => scrollTo(0, top - header + 5), { top, header });
  const video = page.locator('#fn-video');
  await expect.poll(() => video.evaluate(node => node.currentTime), { timeout: 30000 }).toBeGreaterThan(.1);
  const before = await video.evaluate(node => node.currentTime);
  await page.waitForTimeout(450);
  await expect.poll(() => video.evaluate(node => node.currentTime)).toBeGreaterThan(before + .1);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('controls', false);
  await expect(page.locator('#fn36')).toHaveClass(/is-playing/);
  await expect.poll(() => page.locator('.fn-sticky').evaluate(node => getComputedStyle(node, '::before').display)).toBe('none');
  await page.screenshot({ path: testInfo.outputPath('fn36-intro.png') });
  await page.locator('#role-proposal').scrollIntoViewIfNeeded();
  await expect(page.locator('#fn-journey')).toHaveClass(/story-has-content/);
  await page.screenshot({ path: testInfo.outputPath('fn36-through-page.png') });
  await expect(page.locator('.site-backdrop')).toHaveAttribute('data-active-scene', 'account');
  await page.locator('.footer').scrollIntoViewIfNeeded();
  await expect(page.locator('.site-backdrop')).toHaveAttribute('data-active-scene', 'account');
  const ending = await page.locator('.site-backdrop').boundingBox();
  expect(ending.y).toBe(0);
  expect(ending.height).toBeGreaterThanOrEqual(await page.evaluate(() => innerHeight));
  expect(errors).toEqual([]);
});

test('profile and leadership proposal use explicit user details and copy the selected pay format', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.locator('#profile-name')).toHaveText('Дмитрий Козлов');
  await expect(page.locator('#profile-manager')).toHaveText('Владислав Ерофеев');
  await expect(page.locator('#profile')).toContainText('Ульяновск');
  await expect(page.locator('#profile a[href="mailto:d.kozlov@life-pay.ru"]')).toBeVisible();
  await expect(page.locator('.hero-bottom')).not.toContainText('20 августа');
  await expect(page.locator('#proposal-salary')).toHaveValue('');
  await page.locator('.profile-grid').scrollIntoViewIfNeeded();
  await expect(page.locator('.profile-grid')).toHaveClass(/is-assembled/);
  await page.locator('#profile').screenshot({ path: testInfo.outputPath('profile.png'), animations: 'disabled', style: '.sitebar{visibility:hidden}' });
  await page.locator('#role-proposal').screenshot({ path: testInfo.outputPath('leadership-proposal.png'), animations: 'disabled', style: '.sitebar{visibility:hidden}' });
  await page.locator('.brand-finale').scrollIntoViewIfNeeded();
  await expect(page.locator('.brand-finale')).toHaveClass(/is-assembled/);
  await expect(page.locator('.signature-pieces img').first()).toHaveCSS('opacity', '1');
  await page.locator('.brand-finale').screenshot({ path: testInfo.outputPath('finale-assembled.png') });
  await page.locator('#proposal-salary').fill('150000');
  await page.locator('#proposal-pay-format').selectOption('net');
  await page.locator('#proposal-date').fill('2026-12-01');
  await expect(page.locator('#proposal-text')).toContainText('на руки');
  await expect(page.locator('#proposal-text')).toContainText('01.12.2026');
  const proposal = await page.locator('#proposal-text').innerText();
  expect(proposal.replace(/\s/g, '')).toContain('150000₽');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedProposal = text; } } }));
  await page.locator('#copy-proposal').click();
  await expect(page.locator('#proposal-status')).toContainText('Текст скопирован');
  expect(await page.evaluate(() => window.__copiedProposal)).toBe(proposal);
  await page.locator('#proposal-pay-format').selectOption('gross');
  await expect(page.locator('#proposal-text')).toContainText('до вычета налогов');
  await expect(page.locator('#proposal-text')).not.toContainText('на руки');
  await page.locator('#profile .profile-editor summary').click();
  await page.locator('#profile-name-input').fill('Дмитрий Козлов · QA');
  await expect(page.locator('#profile-name')).toHaveText('Дмитрий Козлов · QA');
  await page.locator('#profile-name-input').fill('Дмитрий Козлов');
  await page.locator('#profile-manager-input').fill('');
  await expect(page.locator('#profile-manager-row')).not.toBeVisible();
  await page.locator('#profile-manager-input').fill('Владислав Ерофеев');
  await expect(page.locator('#profile-manager-row')).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied by test'); } } }));
  await page.locator('#copy-proposal').click();
  await expect(page.locator('#proposal-copy-fallback')).toBeVisible();
  await expect(page.locator('#proposal-copy-fallback')).toHaveValue(await page.locator('#proposal-text').innerText());
  await page.locator('#portrait-file').setInputFiles({ name: 'qa-only.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('#profile-photo')).toBeVisible();
  await expect(page.locator('#portrait-status')).toContainText('Фото добавлено');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.proposal-preparation')).not.toBeVisible();
  await expect(page.locator('#proposal-text')).toContainText('до вычета налогов');
});

test('reduced motion keeps FN static and the final official logo is visible', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frames = [];
  page.on('request', request => { if (/fn36-(loop|mobile)\.mp4/.test(request.url())) frames.push(request.url()); });
  await page.goto('./');
  await page.locator('#fn36').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(frames).toEqual([]);
  await expect(page.locator('#fn-video')).toHaveJSProperty('paused', true);
  await page.locator('.brand-finale').scrollIntoViewIfNeeded();
  await expect(page.locator('.signature-base')).toHaveCSS('opacity', '1');
  await page.locator('.brand-finale').screenshot({ path: testInfo.outputPath('finale.png') });
});

test('payment and account scenes autoplay silently without any player buttons', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  for (const name of ['payment', 'account']) {
    const scene = page.locator(`#${name}-scene`);
    const video = page.locator(`#${name}-video`);
    await scene.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate(node => node.currentTime), { timeout: 30000 }).toBeGreaterThan(.1);
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('controls', false);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(scene).toHaveClass(/is-playing/);
    const before = await video.evaluate(node => node.currentTime);
    await page.waitForTimeout(400);
    await expect.poll(() => video.evaluate(node => node.currentTime)).toBeGreaterThan(before + .1);
    await page.screenshot({ path: testInfo.outputPath(`${name}-scene.png`) });
    if (name === 'account') await expect(page.locator('#payment-video')).toHaveJSProperty('paused', true);
  }
  await expect(page.locator('video')).toHaveCount(4);
  await expect(page.locator('#motion-toggle, #fn-motion-toggle, .cinematic-toggle')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('all navigation buttons, project shortcuts and return to top reach their sections', async ({ page }) => {
  await page.goto('./');
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const navigate = async id => {
    const menu = page.locator('.menu-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    await page.locator(`#navlinks a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeVisible();
  };
  for (const id of ['profile', 'responsibility', 'projects', 'results', 'market']) await navigate(id);
  for (const id of ['piot', 'bot', 'erp', 'workflow']) {
    await navigate('projects');
    await page.locator(`.project-index a[href="#project-${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#project-${id}$`));
    await expect(page.locator(`#title-${id}`)).toBeVisible();
  }
  await page.locator('.footer a[href="#about"]').last().click();
  await expect(page).toHaveURL(/#about$/);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.site-backdrop')).toHaveAttribute('data-active-scene', 'hero');
});
