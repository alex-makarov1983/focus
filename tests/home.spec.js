// @ts-check
/* Focus 1.12: Home sections fold and move; Today shows 5, Most important 10 more, never the same task twice. */
const { test, expect } = require('@playwright/test');
test.use({ viewport: { width: 390, height: 2600 } });

async function press(page, locator) { if (test.info().project.use.hasTouch) await locator.tap(); else await locator.click(); }
async function open(page) {
  await page.route(/coingecko|open-meteo/, (r) => r.fulfill({ json: {} }));
  await page.goto('index.html?demo=1');
  await page.waitForSelector('html[data-ready="1"]');
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1')));
async function drag(page, from, to, atTop) {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox(), b = await to.boundingBox();
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2, tx = b.x + b.width / 2, ty = atTop ? b.y + 6 : b.y + b.height - 6, steps = 16;
  if (test.info().project.name === 'iphone-chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + (tx - sx) * i / steps, y: sy + (ty - sy) * i / steps }] }); await page.waitForTimeout(16); }
    await page.waitForTimeout(150); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps); await page.waitForTimeout(16); }
    await page.waitForTimeout(150); await page.mouse.up();
  }
  await page.waitForTimeout(200);
}

test('Home: Today shows five tasks, Most important the next ten urgent ones, no task twice', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('focus.data.v1')), n = new Date();
    const td = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    for (let i = 1; i <= 14; i++) d.tasks.push({ id: 'u' + i, title: 'Urgent ' + i, notes: '', list: 'anytime', date: i <= 4 ? td : '', time: '', priority: 'urgent', status: 'todo', area: '', project: '', repeat: '', subtasks: [], done: false, completedAt: '', order: 100 + i, createdAt: 1, photos: [], tags: [] });
    localStorage.setItem('focus.data.v1', JSON.stringify(d));
  });
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  const today = await page.locator('.fc-title').allTextContents();
  const imp = await page.locator('[data-hb=important] .task-title').allTextContents();
  expect(today).toHaveLength(5);
  expect(imp).toHaveLength(10);
  expect(imp.filter((x) => today.includes(x))).toEqual([]);
  await expect(page.locator('[data-hb=important] .section [data-go=urgent]')).toHaveCount(1);
});

test('Home: every section folds and unfolds, can be dragged up or down, and Reset brings the default back', async ({ page }) => {
  await open(page);
  const keys = await page.locator('.hblock').evaluateAll((xs) => xs.map((x) => x.dataset.hb));
  for (const k of ['search', 'clocks', 'widgets', 'ai', 'focus', 'important', 'tiles', 'schedule', 'timeleft', 'money', 'shortcuts', 'mindset', 'priorities', 'habits', 'journal']) expect(keys).toContain(k);
  /* fold Clocks and Today; they stay folded after a reload */
  await press(page, page.locator('[data-hb=clocks] .hb-fold'));
  await press(page, page.locator('[data-hb=focus] .hb-fold'));
  await expect(page.locator('#clocks')).toBeHidden();
  await expect(page.locator('.fc-list')).toBeHidden();
  await expect(page.locator('.focus-card h2')).toBeVisible();
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('[data-hb=clocks]')).toHaveClass(/folded/);
  await press(page, page.locator('[data-hb=clocks] .hb-fold'));
  await expect(page.locator('#clocks')).toBeVisible();
  /* drag Lists above Search */
  await drag(page, page.locator('[data-hb=tiles] .hb-head .grip'), page.locator('[data-hb=search]'), true);
  await expect(page.locator('.hblock').first()).toHaveAttribute('data-hb', 'tiles');
  expect((await stored(page)).settings.layout.homeOrder[0]).toBe('tiles');
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('.hblock').first()).toHaveAttribute('data-hb', 'tiles');
  await press(page, page.locator('[data-act=resetHome]'));
  await expect(page.locator('.hblock').first()).toHaveAttribute('data-hb', 'search');
  await expect(page.locator('[data-hb=focus]')).not.toHaveClass(/folded/);
});
