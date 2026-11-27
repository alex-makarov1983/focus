// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10000 },
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
    { name: 'iphone-webkit', testIgnore: /wide\.spec/, use: { ...devices['iPhone 13'] } },
    // Same iPhone profile on Chromium, used for true touch-event drag tests via CDP.
    { name: 'iphone-chromium', testIgnore: /wide\.spec/, use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    // Narrow desktop window: the phone layout in a browser.
    { name: 'desktop-chromium', testIgnore: /wide\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1000 } } },
    // Wide layouts: iPad in landscape (WebKit) and a desktop browser window.
    { name: 'ipad-webkit', testMatch: /wide\.spec/, use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'desktop-wide', testMatch: /wide\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }
  ]
});
