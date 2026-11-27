// @ts-check
const { test, expect } = require('@playwright/test');

async function open(page, hash = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/coingecko|open-meteo/, (r) => r.fulfill({ json: {} }));
  await page.goto('index.html?demo=1' + hash);
  await page.waitForSelector('html[data-ready="1"]');
  return errors;
}

test('wide screen: sidebar stays open, no bottom bar, content sits beside it', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('html')).toHaveClass(/wide/);
  const drawer = page.locator('#drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('#menuBtn')).toBeHidden();
  const side = await drawer.boundingBox(), screen = await page.locator('#screen').boundingBox();
  expect(screen.x).toBeGreaterThanOrEqual(side.x + side.width - 1);
  await page.locator('#drawer .nav-link', { hasText: /^Notes/ }).click();
  await expect(page.locator('#screen h1').first()).toHaveText('Notes');
  await expect(page.locator('#drawer .nav-link[aria-current=page]')).toContainText('Notes');
  await expect(drawer).toBeVisible();
  expect(errors).toEqual([]);
});

test('wide screen: New opens a centered dialog; keyboard shortcuts work', async ({ page }) => {
  await open(page);
  await page.locator('.side-add').click();
  const sheet = page.locator('#sheet');
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox(), vp = page.viewportSize();
  expect(box.y).toBeGreaterThan(10);
  expect(box.y + box.height).toBeLessThan(vp.height - 10);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheetWrap')).not.toHaveClass(/on/);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('/');
  await expect(page).toHaveURL(/#\/search/);
});
