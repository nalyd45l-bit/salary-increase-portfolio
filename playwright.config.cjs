const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  outputDir: 'test-results/browser',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'test-results/report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/salary-increase-portfolio/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node tests/serve.cjs',
    url: 'http://127.0.0.1:4173/salary-increase-portfolio/',
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'android-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'iphone-safari', use: { ...devices['iPhone 13'] } },
    { name: 'ipad-safari', use: { ...devices['iPad (gen 7)'] } }
  ]
});
