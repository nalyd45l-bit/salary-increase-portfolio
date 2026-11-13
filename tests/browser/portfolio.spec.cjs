const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test('desktop and mobile portfolio: media, all cases, navigation and image enlargement', async ({ page }, testInfo) => {
  const errors = [];
  const failedResources = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
  });
  const start = Date.now();
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('Мой вклад');
  await expect(page.locator('header .logo img')).toHaveJSProperty('naturalWidth', 235);
  const mediaBounds = await page.locator('.hero-media').boundingBox();
  expect(mediaBounds.height).toBeGreaterThanOrEqual(180);
  const video = page.locator('#hero-video');
  await expect.poll(() => video.evaluate(node => node.currentTime), { timeout: 30000 }).toBeGreaterThan(0.1);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveJSProperty('controls', false);
  await expect(page.locator('.hero-media')).toHaveClass(/is-playing/);
  const mediaState = await video.evaluate(node => ({ currentSrc: node.currentSrc, width: node.videoWidth, height: node.videoHeight, duration: node.duration }));
  expect(mediaState.duration).toBeCloseTo(23.4167, 1);
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
  await expect(page.locator('.market-card')).toHaveCount(3);
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
  await testInfo.attach('javascript-errors.json', { body: JSON.stringify({ errors, failedResources }), contentType: 'application/json' });
});

test('reduced motion avoids video transfer and allows an explicit start', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mediaRequests = [];
  page.on('request', request => { if (/hero-(loop|mobile)\.mp4/.test(request.url())) mediaRequests.push(request.url()); });
  await page.goto('./');
  await expect(page.locator('#motion-toggle')).toContainText('Включить');
  await page.waitForTimeout(500);
  expect(mediaRequests).toEqual([]);
  await page.locator('#motion-toggle').click();
  await expect.poll(() => page.locator('#hero-video').evaluate(node => node.currentTime), { timeout: 30000 }).toBeGreaterThan(.1);
  await expect(page.locator('#motion-toggle')).toContainText('Пауза');
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
  const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const title of ['Аналитика ТС ПИОТ', 'Бот ФН', 'LIFE PAY ERP', 'Передача заявок партнёрам']) expect(text).toContain(title);
  expect((text.match(/Моя роль/g) || []).length).toBe(4);
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  await testInfo.attach('pdf-info.txt', { body: info, contentType: 'text/plain' });
  await testInfo.attach('portfolio.pdf', { path: file, contentType: 'application/pdf' });
});
