// @ts-check
const { test, expect } = require('@playwright/test');

async function press(page, locator) {
  const touch = test.info().project.use.hasTouch;
  if (touch) await locator.tap(); else await locator.click();
}
async function open(page, hash = '', demo = true) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/coingecko/, (r) => r.fulfill({ json: { bitcoin: { usd: 97120, usd_24h_change: 1.2 }, tether: { usd: 1, rub: 95.4, idr: 16350, eur: 0.92, aud: 1.53, rub_24h_change: 0.4, idr_24h_change: -0.12, eur_24h_change: 0.1, aud_24h_change: -0.3 } } }));
  await page.route(/open-meteo/, (r) => r.fulfill({ json: { current: { temperature_2m: 29.4, apparent_temperature: 33, weather_code: 2, wind_speed_10m: 3 }, daily: { sunrise: ['2026-11-18T05:41'], sunset: ['2026-11-18T18:12'] } } }));
  await page.goto('index.html' + (demo ? '?demo=1' : '') + hash);
  await expect(page.locator('#screen h1').first()).toBeVisible();
  return errors;
}
const h1 = (page) => page.locator('#screen h1').first();
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1'))); }

/* Sections from the feature list (Places visited, Message inboxes, Copy-paste data, Shopping lists, My social media, Feature requests), Home extras, media quick add. */

test('home: EUR and AUD rates, S&P and Dow, calculator, Readme mindset', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#wEur')).toHaveText('1.087');
  await expect(page.locator('#wAud')).toHaveText('0.654');
  await expect(page.locator('a.widget', { hasText: 'S&P 500' })).toHaveAttribute('href', /INX/);
  await expect(page.locator('a.widget', { hasText: 'Dow Jones' })).toHaveAttribute('href', /DJI/);
  await press(page, page.locator('button.widget', { hasText: 'Calculator' }));
  for (const k of ['1', '2', '×', '3', '+', '4', '=']) await press(page, page.locator(`[data-calc="${k}"]`));
  await expect(page.locator('#calcIn')).toHaveText('40');
  expect(await page.evaluate(() => [window.FocusDebug.calcEval('2+3×4'), window.FocusDebug.calcEval('(1+2)÷4'), window.FocusDebug.calcEval('50%×200')])).toEqual([14, 0.75, 100]);
  await page.keyboard.press('Escape');
  await press(page, page.locator('[data-act=editMindset]').first());
  await page.locator('#sheet textarea[name=text]').fill('Health first.\nOne thing at a time.');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.mindset')).toContainText('One thing at a time.');
  /* the widgets can be switched off */
  await page.evaluate(() => { location.hash = '#/structure'; });
  await page.locator('[data-chg=widget][data-k=calc]').uncheck();
  await page.evaluate(() => { location.hash = '#/home'; });
  await expect(page.locator('button.widget', { hasText: 'Calculator' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('shopping lists: add several items, tick, clear, new list', async ({ page }) => {
  const errors = await open(page, '#/shopping', false);
  await expect(h1(page)).toHaveText('Shopping lists');
  await expect(page.locator('.chips .chip-btn')).toHaveCount(3);
  await page.locator('#listAddIn').fill('Milk, Bread');
  await page.locator('#listAddIn').press('Enter');
  await expect(page.locator('#screen .task-title')).toHaveText(['Milk', 'Bread']);
  await expect(page.locator('#listAddIn')).toBeFocused();
  await press(page, page.locator('[data-act=listToggle]').first());
  await expect(page.locator('.section', { hasText: 'Done' })).toBeVisible();
  await press(page, page.locator('[data-act=clearListDone]'));
  await expect(page.locator('#screen .task-title')).toHaveText(['Bread']);
  await press(page, page.locator('[data-act=newShopList]'));
  await page.locator('#sheet input[name=name]').fill('Pharmacy');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.chip-btn[aria-pressed=true]')).toHaveText('Pharmacy');
  expect(errors).toEqual([]);
});

test('places visited: count and filter, countries and US parks', async ({ page }) => {
  const errors = await open(page, '#/visited', false);
  await expect(h1(page)).toHaveText('Places visited');
  await expect(page.locator('.visit-sum')).toContainText('0 of 200');
  await page.locator('[data-vfilter]').fill('indonesia');
  await expect(page.locator('#screen [data-vname]:visible')).toHaveCount(1);
  await press(page, page.locator('#screen [data-vname]:visible [data-act=visitToggle]'));
  await expect(page.locator('.visit-sum')).toContainText('1 of 200');
  await press(page, page.locator('[data-act=visitedTab][data-v=parks]'));
  await expect(page.locator('.visit-sum')).toContainText('0 of 63');
  expect(errors).toEqual([]);
});

test('message inboxes, copy-paste data, my social media, feature requests', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = await open(page, '#/inboxes', false);
  await press(page, page.locator('[data-act=newInbox]'));
  await page.locator('#sheet input[name=name]').fill('Telegram');
  await page.locator('#sheet input[name=link]').fill('tg://resolve');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('a[data-inbox-open]')).toHaveAttribute('href', 'tg://resolve');
  await press(page, page.locator('[data-act=inboxCheck]'));
  await expect(page.locator('.section', { hasText: 'Checked today' })).toContainText('1/1');

  await page.evaluate(() => { location.hash = '#/snippets'; });
  await press(page, page.locator('[data-act=newSnippet]'));
  await page.locator('#sheet input[name=label]').fill('Home address');
  await page.locator('#sheet textarea[name=value]').fill('Jl. Example 1, Bali');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('[data-act=copySnippet]'));
  await expect(page.locator('#toastMsg')).toContainText(/Copied|Copy failed/);

  await page.evaluate(() => { location.hash = '#/socials'; });
  await press(page, page.locator('[data-act=newSocial]'));
  await page.locator('#sheet input[name=handle]').fill('@alex');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen a.link-tiny')).toHaveAttribute('href', 'https://instagram.com/alex');

  await page.evaluate(() => { location.hash = '#/features'; });
  await page.locator('#featAddIn').fill('Dark home widgets');
  await page.locator('#featAddIn').press('Enter');
  await expect(page.locator('#screen .task-title')).toHaveText(['Dark home widgets']);
  const d = await stored(page);
  expect(d.snippets[0].value).toBe('Jl. Example 1, Bali');
  expect(errors).toEqual([]);
});
test('the new sections are in the menu', async ({ page }) => {
  await open(page);
  await press(page, page.locator('#menuBtn'));
  for (const r of ['visited', 'inboxes', 'socials', 'snippets', 'shopping', 'features']) await expect(page.locator(`#drawer .nav-link[data-go=${r}]`)).toHaveCount(1);
});


test('media: add with just a title, or just a link', async ({ page }) => {
  const errors = await open(page, '#/media', false);
  const f = page.locator('form[data-form=mediaQuick]');
  await f.locator('input[name=title]').fill('Dune');
  await f.locator('input[name=title]').press('Enter');
  await expect(page.locator('#screen .media-body strong')).toHaveText(['Dune']);
  await f.locator('input[name=title]').fill('https://www.youtube.com/watch?v=abc');
  await f.locator('input[name=title]').press('Enter');
  const d = await stored(page);
  expect(d.media.map((m) => m.type).sort()).toEqual(['Movie', 'YouTube']);
  await press(page, page.locator('[data-act=newMedia]').first());
  await expect(page.locator('#sheet input[name=by]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
