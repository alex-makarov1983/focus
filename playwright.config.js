// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173/index.html',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore'
  },
  projects: [
    // Closest available match to iPhone Safari: real WebKit engine with iPhone 13 viewport, touch and user agent.
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    // Same iPhone profile on Chromium, used for true touch-event drag tests via CDP.
    { name: 'iphone-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
