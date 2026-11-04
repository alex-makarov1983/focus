// @ts-check
const { test, expect } = require('@playwright/test');

const SCREENS = ['Home', 'Inbox', 'Today', 'Upcoming', 'Anytime', 'Someday', 'Logbook', 'Calendar', 'Kanban',
  'Areas', 'Projects', 'Notes', 'Safe Storage', 'Money', 'Major Purchases', 'Urgent', 'Follow-up', 'Bookmarks', 'Delegated', 'Settings'];

/** Tap on touch devices, click elsewhere — exercises the same path a finger uses on iPhone. */
async function press(page, locator) {
  const touch = test.info().project.use.hasTouch;
  if (touch) await locator.tap(); else await locator.click();
}
async function open(page, hash = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await mockApis(page);
  await page.goto('index.html' + hash);
  await page.waitForSelector('html[data-ready="1"]');
  return errors;
}
async function mockApis(page) {
  await page.route(/coingecko/, (r) => r.fulfill({ json: { bitcoin: { usd: 97120, rub: 1, idr: 1, eur: 1 }, tether: { usd: 1, rub: 95.4, idr: 16350, eur: 0.92 } } }));
  await page.route(/open-meteo/, (r) => r.fulfill({ json: { current: { temperature_2m: -3.2, apparent_temperature: -8, weather_code: 71, wind_speed_10m: 4.1 } } }));
}
const h1 = (page) => page.locator('#screen h1').first();
async function viaMenu(page, title) {
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer')).toHaveClass(/on/);
  await press(page, page.locator('#drawer .nav-link', { hasText: new RegExp('^' + title.replace(/[&]/g, '\\&') + '\\d*$') }));
  await expect(page.locator('#drawer')).not.toHaveClass(/on/);
}
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1'))); }

/** Drag with real touch events in Chromium (CDP); mouse-driven pointer events elsewhere. */
async function dragTo(page, from, toX, toY) {
  const box = await from.boundingBox();
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  const steps = 14;
  if (test.info().project.name === 'iphone-chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + (toX - sx) * i / steps, y: sy + (toY - sy) * i / steps }] });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(sx + (toX - sx) * i / steps, sy + (toY - sy) * i / steps); await page.waitForTimeout(16); }
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  await page.waitForTimeout(100);
}

/** Low-level pointer: real touch events in Chromium (CDP), mouse elsewhere. */
async function pointer(page) {
  const touch = test.info().project.name === 'iphone-chromium';
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  let cx = 0, cy = 0;
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  return {
    async down(x, y) { cx = x; cy = y; if (touch) await send('touchStart', x, y); else { await page.mouse.move(x, y); await page.mouse.down(); } },
    async move(x, y, steps = 12) {
      for (let i = 1; i <= steps; i++) {
        const nx = cx + (x - cx) * i / steps, ny = cy + (y - cy) * i / steps;
        if (touch) await send('touchMove', nx, ny); else await page.mouse.move(nx, ny);
        await page.waitForTimeout(16);
      }
      cx = x; cy = y;
    },
    async up() { await page.waitForTimeout(120); if (touch) await send('touchEnd'); else await page.mouse.up(); await page.waitForTimeout(100); }
  };
}

test('boots with no errors and shows Home', async ({ page }) => {
  const errors = await open(page);
  await expect(h1(page)).toHaveText('Home');
  await expect(page.locator('#bootMsg')).toHaveCount(0);
  await expect(page.locator('#menuBtn')).toBeVisible();
  await expect(page.locator('#backBtn')).toBeDisabled();
  const backBox = await page.locator('#backBtn').boundingBox();
  const menuBox = await page.locator('#menuBtn').boundingBox();
  expect(backBox.x).toBeLessThan(40);                 // Back is top-left…
  expect(menuBox.x).toBeGreaterThan(backBox.x);       // …hamburger right after it
  expect(Math.abs(menuBox.y - backBox.y)).toBeLessThan(6); // same row
  expect(errors).toEqual([]);
});

test('hamburger reaches all 15 screens and Back returns to the previous one', async ({ page }) => {
  const errors = await open(page);
  for (const title of SCREENS) {
    await viaMenu(page, title);
    await expect(h1(page)).toHaveText(title);
    await expect(page.locator('#menuBtn')).toBeVisible();
    if (title !== 'Home') {
      await expect(page.locator('#backBtn')).toBeVisible();
      await press(page, page.locator('#backBtn'));
      await expect(h1(page)).toHaveText('Home');
    }
  }
  expect(errors).toEqual([]);
});

test('every button on every screen is wired to a real action', async ({ page }) => {
  await open(page);
  for (const title of SCREENS) {
    await viaMenu(page, title);
    await expect(h1(page)).toHaveText(title);
    const problems = await page.evaluate(() => {
      const known = new Set(window.FocusDebug.actionNames);
      const routes = new Set(window.FocusDebug.routes);
      const out = [];
      document.querySelectorAll('#screen button, .bottom-nav button, .topbar button').forEach((b) => {
        const act = b.getAttribute('data-act'), go = b.getAttribute('data-go');
        if (act && !known.has(act)) out.push('unknown action ' + act);
        else if (go && !routes.has(go)) out.push('unknown route ' + go);
        else if (!act && !go && !b.hasAttribute('data-drag') && b.type !== 'submit') out.push('dead button: ' + b.textContent.trim());
      });
      return out;
    });
    expect(problems, title).toEqual([]);
  }
});

test('multi-step Back, plus browser/iOS swipe back', async ({ page }) => {
  await open(page);
  await press(page, page.locator('#moreTab'));
  await expect(page.locator('#sheet .choice')).toHaveText(['Projects', 'Notes', 'Safe', 'Money']);
  await press(page, page.locator('#sheet .choice', { hasText: 'Projects' }));
  await expect(h1(page)).toHaveText('Projects');
  await press(page, page.locator('.item-card', { hasText: 'Home renovation' }));
  await expect(h1(page)).toHaveText('Home renovation');
  await press(page, page.locator('#backBtn'));
  await expect(h1(page)).toHaveText('Projects');
  await press(page, page.locator('#backBtn'));
  await expect(h1(page)).toHaveText('Home');
  await expect(page.locator('#backBtn')).toBeDisabled();
  await press(page, page.locator('.tab[data-go="calendar"]'));
  await expect(h1(page)).toHaveText('Calendar');
  await page.goBack();
  await expect(h1(page)).toHaveText('Home');
});

test('+ opens chooser; a new task lands in Inbox and survives reload', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.add-btn'));
  const choices = page.locator('#sheet .choice');
  await expect(choices).toHaveText(['Task', 'Voice', 'Note', 'Safe', 'Income', 'Expense', 'Bookmark']);
  await press(page, choices.filter({ hasText: 'Task' }));
  await page.locator('#sheet input[name=title]').fill('Buy printer ink');
  await expect(page.locator('#sheet select[name=list]')).toHaveValue('inbox');
  await expect(page.locator('#sheet select[name=priority] option')).toHaveText(['Urgent', 'High', 'Medium', 'Low']);
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#toast')).toContainText('Added to Inbox');
  await viaMenu(page, 'Inbox');
  await expect(page.locator('#screen .task-title').first()).toHaveText('Buy printer ink');
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await expect(h1(page)).toHaveText('Inbox');
  await expect(page.locator('#screen .task-title', { hasText: 'Buy printer ink' })).toHaveCount(1);
});

test('empty task title is rejected with a message', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.add-btn'));
  await press(page, page.locator('#sheet .choice', { hasText: 'Task' }));
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#taskErr')).toHaveText('Give the task a title.');
  await expect(page.locator('#sheetWrap')).toHaveClass(/on/);
});

test('plan a task for Today, complete it, restore it from Logbook', async ({ page }) => {
  await open(page, '#/inbox');
  await press(page, page.locator('#screen .task-body', { hasText: 'Renew insurance documents' }));
  await press(page, page.locator('#sheet [data-act=formDate][data-n="0"]'));
  await expect(page.locator('#sheet select[name=list]')).toHaveValue('anytime');
  await page.locator('#sheet select[name=priority]').selectOption('urgent');
  await press(page, page.locator('#sheet button[type=submit]'));
  await viaMenu(page, 'Today');
  const row = page.locator('#screen .task', { hasText: 'Renew insurance documents' });
  await expect(row).toContainText('Urgent');
  await press(page, row.locator('.check'));
  await expect(page.locator('#screen .task', { hasText: 'Renew insurance documents' })).toHaveCount(0);
  await viaMenu(page, 'Logbook');
  const done = page.locator('#screen .task', { hasText: 'Renew insurance documents' });
  await expect(done).toHaveCount(1);
  await press(page, done.locator('.check'));
  await expect(page.locator('#screen .task', { hasText: 'Renew insurance documents' })).toHaveCount(0);
  const data = await stored(page);
  expect(data.tasks.find((t) => t.title === 'Renew insurance documents').done).toBe(false);
});

test('repeating task creates the next occurrence when completed', async ({ page }) => {
  await open(page, '#/upcoming');
  const row = page.locator('#screen .task', { hasText: 'Weekly review' });
  await press(page, row.locator('.check'));
  await expect(page.locator('#toast')).toContainText('Next one on');
  const data = await stored(page);
  const all = data.tasks.filter((t) => t.title === 'Weekly review');
  expect(all.length).toBe(2);
  expect(all.filter((t) => !t.done)[0].repeat).toBe('weekly');
});

test('priorities use names, never P1–P4', async ({ page }) => {
  await open(page);
  for (const title of ['Home', 'Today', 'Upcoming', 'Kanban', 'Major Purchases']) {
    await viaMenu(page, title);
    await expect(page.locator('#screen')).not.toContainText(/\bP[1-4]\b/);
  }
});

test('notes: create, autosave and persist', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.add-btn'));
  await press(page, page.locator('#sheet .choice', { hasText: 'Note' }));
  await page.locator('.title-in').fill('Packing list');
  await page.locator('.body-in').fill('Passport\nCharger');
  await expect(page.locator('#noteSaved')).toHaveText('Saved');
  await press(page, page.locator('#backBtn'));
  await viaMenu(page, 'Notes');
  await expect(page.locator('#screen .item-card', { hasText: 'Packing list' })).toHaveCount(1);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('#screen .item-card', { hasText: 'Packing list' })).toHaveCount(1);
  await page.locator('[data-input=noteQuery]').fill('passport');
  await expect(page.locator('#noteResults .item-card')).toHaveCount(1);
});

test('finance: Add Income / Add Expense recalculate planned and actual', async ({ page }) => {
  await open(page, '#/finance');
  await expect(page.getByRole('button', { name: 'Add Income' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Expense' })).toBeVisible();
  async function add(kind, type, amount) {
    await press(page, page.getByRole('button', { name: kind === 'income' ? 'Add Income' : 'Add Expense' }));
    await press(page, page.locator('#sheet [data-act=finType][data-v=' + type + ']'));
    await page.locator('#sheet input[name=amount]').fill(String(amount));
    await page.locator('#sheet select[name=currency]').selectOption('EUR');
    await page.locator('#sheet input[name=category]').fill(kind === 'income' ? 'Salary' : 'Travel');
    await press(page, page.locator('#sheet button[type=submit]'));
    await expect(page.locator('#sheetWrap')).not.toHaveClass(/on/);
  }
  await add('income', 'actual', 1000);
  await add('expense', 'actual', 400);
  await add('expense', 'planned', 500);
  const eur = page.locator('[data-fin-cur=EUR]');
  await expect(eur.locator('[data-k=income-actual]')).toHaveText('€1,000');
  await expect(eur.locator('[data-k=expense-actual]')).toHaveText('€400');
  await expect(eur.locator('[data-k=expense-planned]')).toHaveText('€500');
  await expect(eur.locator('[data-k=balance-actual]')).toHaveText('€600');
  await expect(eur.locator('[data-k=balance-planned]')).toHaveText('−€500');
  // editing a record updates the dashboard
  await press(page, page.locator('#screen .rec', { hasText: 'Travel' }).filter({ hasText: 'Actual' }));
  await page.locator('#sheet input[name=amount]').fill('100');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(eur.locator('[data-k=balance-actual]')).toHaveText('€900');
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('[data-fin-cur=EUR] [data-k=balance-actual]')).toHaveText('€900');
});

test('calendar: Month, Week and Day views with navigation', async ({ page }) => {
  await open(page, '#/calendar');
  await expect(page.locator('.month .day-cell').first()).toBeVisible();
  await press(page, page.locator('[data-act=calView][data-v=week]'));
  await expect(page.locator('.week-day')).toHaveCount(7);
  await press(page, page.locator('[data-act=calView][data-v=day]'));
  await expect(page.locator('.timeline')).toBeVisible();
  await expect(page.locator('.timeline')).toContainText('Review quarterly growth plan');
  const before = await page.locator('#calLabel').textContent();
  await press(page, page.locator('[data-act=calShift][data-n="1"]'));
  await expect(page.locator('#calLabel')).not.toHaveText(before || '');
  await press(page, page.locator('[data-act=calToday]'));
  await expect(page.locator('#calLabel')).toHaveText(before || '');
  await press(page, page.locator('[data-act=calView][data-v=month]'));
  await press(page, page.locator('.day-cell.today'));
  await expect(page.locator('#screen .section h2').first()).toContainText('Today');
});

test('drag a task to reorder Inbox; order persists after reload', async ({ page }) => {
  await open(page, '#/inbox');
  const titles = () => page.locator('#screen .task-title').allTextContents();
  expect(await titles()).toEqual(['Renew insurance documents', 'Pick a CRM for the sales team']);
  const second = page.locator('#screen .task').nth(1);
  const firstBox = await page.locator('#screen .task').nth(0).boundingBox();
  await dragTo(page, second.locator('.grip'), firstBox.x + 20, firstBox.y + 6);
  expect(await titles()).toEqual(['Pick a CRM for the sales team', 'Renew insurance documents']);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  expect(await titles()).toEqual(['Pick a CRM for the sales team', 'Renew insurance documents']);
});

test('drag a Kanban card into another column; status persists', async ({ page }) => {
  await open(page, '#/kanban');
  const card = page.locator('[data-sort-list=todo] .kcard', { hasText: 'Approve renovation budget' });
  await expect(card).toHaveCount(1);
  const id = await card.getAttribute('data-sort-item');
  const box = await card.locator('.grip').boundingBox();
  const vw = page.viewportSize().width;
  const p = await pointer(page);
  await p.down(box.x + box.width / 2, box.y + box.height / 2);
  await p.move(vw - 8, box.y + 40);            // hold at the right edge: the board scrolls itself
  // the board shifts one column; In Progress is now in the middle of the screen
  await expect.poll(() => page.evaluate(() => document.getElementById('board').scrollLeft), { timeout: 5000, intervals: [50] }).toBeGreaterThan(vw > 600 ? -1 : 200);
  await p.move(vw / 2, box.y + 40, 6);
  await expect.poll(() => page.evaluate((i) => document.querySelector('[data-sort-item="' + i + '"]').parentElement.dataset.sortList, id)).toBe('doing');
  await p.up();
  await expect(page.locator('#toast')).toContainText('Moved to In Progress');
  const data = await stored(page);
  expect(data.tasks.find((t) => t.title === 'Approve renovation budget').status).toBe('doing');
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('[data-sort-list=doing] .kcard', { hasText: 'Approve renovation budget' })).toHaveCount(1);
});

test('Kanban fallback: changing status in the task sheet moves the card', async ({ page }) => {
  await open(page, '#/kanban');
  await press(page, page.locator('[data-sort-list=todo] .task-body', { hasText: 'Draft launch announcement' }));
  await page.locator('#sheet select[name=status]').selectOption('waiting');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-sort-list=waiting] .kcard', { hasText: 'Draft launch announcement' })).toHaveCount(1);
});

test('areas are exactly Personal and Business; a project belongs to one area', async ({ page }) => {
  await open(page, '#/areas');
  await expect(page.locator('.area-tile h3')).toHaveText(['Personal', 'Business']);
  await viaMenu(page, 'Projects');
  await press(page, page.locator('[data-act=projFilter][data-v=business]'));
  await press(page, page.locator('[data-act=newProject]'));
  await expect(page.locator('#sheet select[name=area] option')).toHaveText(['Personal', 'Business']);
  await expect(page.locator('#sheet select[name=area]')).toHaveValue('business');
  await page.locator('#sheet input[name=name]').fill('Hiring plan');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(h1(page)).toHaveText('Hiring plan');
  await press(page, page.locator('[data-act=newTask]'));
  await page.locator('#sheet input[name=title]').fill('Write job post');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task-title', { hasText: 'Write job post' })).toHaveCount(1);
  await press(page, page.locator('#backBtn'));
  await press(page, page.locator('[data-act=projFilter][data-v=personal]'));
  await expect(page.locator('#screen .item-card', { hasText: 'Hiring plan' })).toHaveCount(0);
  await viaMenu(page, 'Areas');
  await press(page, page.locator('.area-tile', { hasText: 'Business' }));
  await expect(page.locator('#screen .item-card', { hasText: 'Hiring plan' })).toHaveCount(1);
});

test('major purchases: adding one updates the total', async ({ page }) => {
  await open(page, '#/purchases');
  await expect(page.locator('[data-pur-cur=USD] [data-k=budget]')).toHaveText('$20,400');
  await press(page, page.locator('[data-act=newPurchase]'));
  await page.locator('#sheet input[name=title]').fill('E-bike');
  await page.locator('#sheet input[name=amount]').fill('3600');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-pur-cur=USD] [data-k=budget]')).toHaveText('$24,000');
});

test('works offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service worker offline check runs on Chromium');
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await expect(h1(page)).toHaveText('Home');
  await context.setOffline(false);
});

/* ===================== v1.1 features ===================== */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMBQkAOz0/wa5LZ1wAAAAASUVORK5CYII=', 'base64');
test('Home: 4 city clocks, USDT/RUB, BTC, Moscow weather, traffic link, quick tiles', async ({ page }) => {
  await open(page);
  await expect(page.locator('.clock .city')).toHaveText(['Bali', 'Moscow', 'New York', 'Los Angeles']);
  await expect(page.locator('.clock .ctime').first()).toHaveText(/^\d\d:\d\d$/);
  await expect(page.locator('#wUsdt')).toHaveText('95.40 ₽');
  await expect(page.locator('#wBtc')).toHaveText('$97,120');
  await expect(page.locator('#wTemp')).toHaveText('-3°');
  await expect(page.locator('a.widget[href*="yandex.ru/maps"]')).toHaveCount(1);
  await expect(page.locator('.tiles.five .tile .l')).toHaveText(['Today', 'Urgent', 'Inbox', 'Someday', 'Follow-up', 'Delegated']);
  await expect(page.locator('#screen')).not.toContainText('Waiting on others');
  await press(page, page.locator('.tile', { hasText: 'Urgent' }));
  await expect(h1(page)).toHaveText('Urgent');
  await expect(page.locator('#screen .task-title')).toHaveText(['Review quarterly growth plan']);
});

test('Home: Safe notes quick Open / Add', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.safe-quick [data-act=homeSafeAdd]'));
  await expect(h1(page)).toHaveText('Safe Storage');
  await press(page, page.locator('#backBtn'));
  await press(page, page.locator('.safe-quick [data-go=safe]'));
  await expect(h1(page)).toHaveText('Safe Storage');
});

test('Inbox: add a named section line; it persists and can be renamed', async ({ page }) => {
  await open(page, '#/inbox');
  await press(page, page.locator('[data-act=newHeading]'));
  await page.locator('#sheet input[name=title]').fill('Calls');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.heading-row', { hasText: 'Calls' })).toHaveCount(1);
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await press(page, page.locator('.heading-btn', { hasText: 'Calls' }));
  await page.locator('#sheet input[name=title]').fill('Phone calls');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.heading-row', { hasText: 'Phone calls' })).toHaveCount(1);
});

test('Areas: create a new area and use it for a project; Kanban groups by area and project', async ({ page }) => {
  await open(page, '#/areas');
  await press(page, page.locator('[data-act=newArea]'));
  await page.locator('#sheet input[name=name]').fill('Family');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.area-tile h3')).toHaveText(['Personal', 'Business', 'Family']);
  await viaMenu(page, 'Projects');
  await press(page, page.locator('[data-act=newProject]').first());
  await expect(page.locator('#sheet select[name=area] option')).toHaveText(['Personal', 'Business', 'Family']);
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await viaMenu(page, 'Kanban');
  await press(page, page.locator('[data-act=kanbanBy][data-v=area]'));
  await expect(page.locator('.column h3')).toContainText(['Personal', 'Business', 'Family', 'No area']);
  await press(page, page.locator('[data-act=kanbanBy][data-v=project]'));
  await expect(page.locator('.column h3').first()).toContainText('Website relaunch');
  // move a card to another project via the sheet (drag is covered by the status test)
  await press(page, page.locator('[data-sort-list=_none] .task-body').first());
  await page.locator('#sheet select[name=project]').selectOption({ label: 'Product launch' });
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-sort-list=p_launch] .kcard')).toHaveCount(3);
});

test('Task: attach a photo; it survives reload', async ({ page }) => {
  await open(page, '#/inbox');
  await press(page, page.locator('#screen .task-body', { hasText: 'Renew insurance documents' }));
  await page.locator('#sheet [data-photo-input]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#thumbs .thumb')).toHaveCount(1);
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task', { hasText: 'Renew insurance documents' })).toContainText('📷 1');
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await press(page, page.locator('#screen .task-body', { hasText: 'Renew insurance documents' }));
  await expect(page.locator('#thumbs .thumb img')).toHaveAttribute('src', /^blob:/);
  await press(page, page.locator('#thumbs .thumb-img'));
  await expect(page.locator('.viewer img')).toBeVisible();
});

test('Voice: dictated sentences become Inbox tasks; mic in task form fills the title', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSR {
      start() { setTimeout(() => {
        const r = [Object.assign([{ transcript: window.__say || 'Купить молоко. Позвонить маме' }], { isFinal: true })];
        this.onresult && this.onresult({ resultIndex: 0, results: r }); this.onend && this.onend();
      }, 50); }
      stop() { this.onend && this.onend(); }
    }
    window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
  });
  await open(page);
  await press(page, page.locator('.add-btn'));
  await press(page, page.locator('#sheet .choice', { hasText: 'Voice' }));
  await press(page, page.locator('#sheet .mic-btn'));
  await expect(page.locator('#voiceText')).toHaveValue('Купить молоко. Позвонить маме');
  await press(page, page.locator('#sheet button[type=submit]'));
  await viaMenu(page, 'Inbox');
  await expect(page.locator('#screen .task-title', { hasText: 'Купить молоко' })).toHaveCount(1);
  await expect(page.locator('#screen .task-title', { hasText: 'Позвонить маме' })).toHaveCount(1);
  await page.evaluate(() => { window.__say = 'Book flights'; });
  await press(page, page.locator('[data-act=newTask]'));
  await press(page, page.locator('#sheet .field.has-mic .mic-btn').first());
  await expect(page.locator('#sheet input[name=title]')).toHaveValue('Book flights');
});

test('Bookmarks: save a link with a tag and filter by it', async ({ page }) => {
  await open(page, '#/bookmarks');
  await press(page, page.locator('[data-act=newBookmark]'));
  await page.locator('#sheet input[name=url]').fill('example.com');
  await page.locator('#sheet input[name=tag]').fill('Work');
  await press(page, page.locator('#sheet button[type=submit]'));
  const link = page.locator('.bm a', { hasText: 'example.com' });
  await expect(link).toHaveAttribute('href', 'https://example.com');
  await press(page, page.locator('[data-act=bmTag][data-v=Work]'));
  await expect(page.locator('.bm')).toHaveCount(1);
});

test('Delegated: delegate a task to an assistant', async ({ page }) => {
  await open(page, '#/delegated');
  await press(page, page.locator('[data-act=newTask]').first());
  await page.locator('#sheet input[name=title]').fill('Pay the electricity bill');
  await expect(page.locator('#sheet select[name=delegatedTo]')).toHaveValue('Assistant');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task', { hasText: 'Pay the electricity bill' })).toContainText('→ Assistant');
});

test('Settings: theme and assistants are saved', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('[data-setting=theme]').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('[data-setting=assistants]').fill('Katya, Oleg');
  await page.locator('[data-setting=assistants]').press('Enter');
  await page.locator('[data-setting=assistants]').blur();
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await viaMenu(page, 'Delegated');
  await expect(page.locator('#screen .section h2')).toContainText(['Katya', 'Oleg']);
});

test('Money: Earned/Spent this month and My balance with negatives, currency switch, chart', async ({ page }) => {
  await open(page, '#/finance');
  await expect(page.locator('#earned')).toHaveText('$11,300');
  await expect(page.locator('#spent')).toHaveText('$5,760');
  await press(page, page.locator('[data-act=moneyTab][data-v=balance]'));
  await expect(page.locator('[data-sum=mydebt]')).toHaveText('−$2,300');
  await expect(page.locator('#netChart circle')).toHaveCount(3);
  await press(page, page.locator('[data-act=recordBalances]').first());
  await page.locator('#sheet input[name=acc_a5]').fill('-5000');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-sum=mydebt]')).toHaveText('−$5,000');
  const liquid = await page.locator('[data-sum=liquid]').textContent();
  await press(page, page.locator('[data-act=balCur][data-v=RUB]'));
  await expect(page.locator('[data-sum=net]')).toContainText('₽');
  await press(page, page.locator('[data-act=newAccount]'));
  await page.locator('#sheet input[name=name]').fill('Car');
  await page.locator('#sheet select[name=category]').selectOption('asset');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('table.bal')).toContainText('Car');
  expect(liquid).toMatch(/^\$/);
});

test('Safe: 4-digit PIN, fields, types, tags; asks only once per launch; encrypted at rest', async ({ page }) => {
  await open(page, '#/safe');
  await page.locator('input[name=pin]').fill('12ab');
  await page.locator('input[name=pin2]').fill('12ab');
  await press(page, page.locator('form[data-form=safeSetup] button[type=submit]'));
  await expect(page.locator('#safeErr')).toHaveText('Use exactly 4 digits.');
  await page.locator('input[name=pin]').fill('4821');
  await page.locator('input[name=pin2]').fill('4821');
  await press(page, page.locator('form[data-form=safeSetup] button[type=submit]'));
  await press(page, page.locator('[data-act=newSafe]'));
  const labels = await page.locator('#sheet .field > span').allTextContents();
  expect(labels).toEqual(['Name', 'Link', 'Login', 'Pass', 'Note', 'Type', 'Tag']);
  await expect(page.locator('#sheet select[name=type] option')).toHaveText(['Login', 'Address', 'Document', 'Bank card', 'Bank account', 'Safenote']);
  await page.locator('#sheet input[name=title]').fill('Demo bank');
  await page.locator('#sheet input[name=secret]').fill('not-a-real-secret-42');
  await page.locator('#sheet select[name=type]').selectOption('Bank account');
  await page.locator('#sheet input[name=tags]').fill('family, bali');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('[data-act=safeView][data-v=tag]'));
  await expect(page.locator('#screen .section h2')).toContainText(['#bali', '#family']);
  await press(page, page.locator('[data-act=safeView][data-v=type]'));
  await expect(page.locator('#screen .section h2')).toContainText(['Bank account']);
  // navigating away and back does not ask for the PIN again
  await press(page, page.locator('.tab[data-go=home]'));
  await viaMenu(page, 'Safe Storage');
  await expect(page.locator('[data-safe]')).toHaveCount(1);
  const raw = await page.evaluate(() => localStorage.getItem('focus.vault.v2'));
  expect(raw).not.toContain('not-a-real-secret-42');
  expect(raw).not.toContain('Demo bank');
  // a new launch asks once
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await page.locator('input[name=pin]').fill('0000');
  await press(page, page.locator('form[data-form=safeUnlock] button[type=submit]'));
  await expect(page.locator('#safeErr')).toHaveText('Wrong PIN.');
  await page.locator('input[name=pin]').fill('4821');
  await press(page, page.locator('form[data-form=safeUnlock] button[type=submit]'));
  await expect(page.locator('[data-safe]', { hasText: 'Demo bank' })).toHaveCount(1);
});

test('Safe: Face ID unlock via platform passkey (WebAuthn PRF)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Virtual authenticator is Chromium-only');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  await open(page, '#/safe');
  await page.locator('input[name=pin]').fill('4821');
  await page.locator('input[name=pin2]').fill('4821');
  await press(page, page.locator('form[data-form=safeSetup] button[type=submit]'));
  await press(page, page.locator('[data-act=newSafe]'));
  await page.locator('#sheet input[name=title]').fill('Face test');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('#screen [data-act=faceIdOn]'));
  await expect(page.locator('#toast')).toContainText('Face ID unlock is on');
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await press(page, page.locator('[data-act=safeFaceId]'));
  await expect(page.locator('[data-safe]', { hasText: 'Face test' })).toHaveCount(1);
});
