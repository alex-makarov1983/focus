// @ts-check
const { test, expect } = require('@playwright/test');

const SCREENS = ['Home', 'Inbox', 'Today', 'Upcoming', 'Anytime', 'Someday', 'Logbook', 'Calendar', 'Kanban',
  'Areas', 'Projects', 'Notes', 'Safe Storage', 'Money', 'Major Purchases', 'Most important', 'Follow-up', 'Bookmarks', 'Delegated', 'Settings', 'Habits', 'Whole life', 'Paused', 'Friends', 'Travel planner', 'Watch · Read · Listen', 'Cloud & account', 'Deadlines', 'Journal', 'Regular routines', 'AI assistant', 'All tasks'];

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
  await page.goto('index.html?demo=1' + hash);
  await page.waitForSelector('html[data-ready="1"]');
  return errors;
}
async function mockApis(page) {
  await page.route(/coingecko/, (r) => r.fulfill({ json: { bitcoin: { usd: 97120, rub: 1, idr: 1, eur: 1 }, tether: { usd: 1, rub: 95.4, idr: 16350, eur: 0.92, rub_24h_change: 0.4, idr_24h_change: -0.12 } } }));
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
  await viaMenu(page, 'Projects');
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
  await expect(choices).toHaveText(['Task', 'Assistant', 'Note', 'Safe', 'Income', 'Expense', 'Balance', 'Bookmark']);
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
test('Home: 4 city clocks, USDT/RUB, BTC, weather and traffic where you are, quick tiles', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('focus.geo', JSON.stringify({ lat: -8.65, lon: 115.22, t: Date.now() })));
  await open(page);
  await expect(page.locator('.clock .city')).toHaveText(['Los Angeles', 'New York', 'Moscow', 'Bali']);
  await expect(page.locator('.clock .ctime').first()).toHaveText(/^\d\d:\d\d$/);
  await expect(page.locator('#wUsdt')).toHaveText('95.40 ₽');
  await expect(page.locator('#wBtc')).toHaveText('$97,120');
  await expect(page.locator('#wTemp')).toHaveText('-3°');
  await expect(page.locator('#wTemp').locator('xpath=..')).toContainText('Bali');
  await expect(page.locator('a.widget[href*="google.com/maps/@-8.6500,115.2200"]')).toHaveCount(1);
  await expect(page.locator('a.widget[href*="google.com/maps"]')).toContainText('Bali');
  await expect(page.locator('.tiles.eight .tile .l')).toHaveText(['Inbox', 'Today', 'Most important', 'Follow-up', 'Delegated', 'Someday', 'Done', 'Paused']);
  await expect(page.locator('#screen')).not.toContainText('Waiting on others');
  await press(page, page.locator('.tile', { hasText: 'Most important' }));
  await expect(h1(page)).toHaveText('Most important');
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

test('Voice: dictate into the assistant and into the task title', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSR {
      start() { setTimeout(() => {
        const r = [Object.assign([{ transcript: window.__say || 'Купить молоко. Позвонить маме' }], { isFinal: true })];
        this.onstart && this.onstart(); this.onresult && this.onresult({ resultIndex: 0, results: r }); this.onend && this.onend();
      }, 50); }
      stop() { this.onend && this.onend(); }
      abort() { this.onend && this.onend(); }
    }
    window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
  });
  await open(page);
  await press(page, page.locator('.ai-bar'));
  await press(page, page.locator('#sheet .mic-btn'));
  await expect(page.locator('#aiText')).toHaveValue('Купить молоко. Позвонить маме');
  await expect(page.locator('.ai-item')).toHaveCount(2);
  await press(page, page.locator('#sheet button[type=submit]'));
  await viaMenu(page, 'Inbox');
  await expect(page.locator('#screen .task-title', { hasText: 'Купить молоко' })).toHaveCount(1);
  await page.evaluate(() => { window.__say = 'Book flights'; });
  await press(page, page.locator('[data-act=newTask]').first());
  await press(page, page.locator('#sheet .field.has-mic .mic-btn').first());
  await expect(page.locator('#sheet input[name=title]')).toHaveValue('Book flights');
});

test('Dictate never hangs: without speech support it falls back to the keyboard mic', async ({ page }) => {
  await page.addInitScript(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await open(page, '#/notes');
  await press(page, page.locator('[data-act=newNote]'));
  await press(page, page.locator('[data-act=dictate]'));
  await expect(page.locator('#toast')).toContainText('keyboard');
  await expect(page.locator('.body-in')).toBeFocused();
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
  await page.locator('#sheet input[name=amount]').fill('18000');
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
  expect(labels).toEqual(['Type', 'Name', 'Link', 'Login', 'Pass', 'Note', 'Tag']);
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

/* ===================== v1.2 ===================== */
test('a clean install starts empty (no demo data)', async ({ page }) => {
  await mockApis(page);
  await page.goto('index.html');
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('.tile', { hasText: 'Inbox' }).locator('.n')).toHaveText('0');
  await viaMenu(page, 'Projects');
  await expect(page.locator('#screen .item-card')).toHaveCount(0);
  await viaMenu(page, 'Areas');
  await expect(page.locator('.area-tile h3')).toHaveText(['Personal', 'Business']);
});

test('upgrade removes old demo items but keeps what the user added', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('focus.data.v1'));
    delete d.settings.demoPurged;
    d.tasks.push({ id: 'mine1', title: 'My real task', notes: '', list: 'inbox', date: '', time: '', priority: 'high', status: 'todo', done: false, completedAt: '', area: 'personal', project: '', repeat: '', subtasks: [], photos: [], delegatedTo: '', order: -5 });
    d.finance.push({ id: 'f_mine', kind: 'income', type: 'actual', date: '2026-11-02', amount: 1234, currency: 'USD', category: 'Business', note: '' });
    localStorage.setItem('focus.data.v1', JSON.stringify(d));
  });
  await page.goto('index.html#/inbox');
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('#screen .task-title')).toHaveText(['My real task']);
  const d = await stored(page);
  expect(d.projects).toEqual([]);
  expect(d.finance.map((r) => r.id)).toEqual(['f_mine']);
  expect(d.settings.demoPurged).toBe(true);
});

test('Habits: add a habit, tick today and yesterday, see the streak; tick from Home', async ({ page }) => {
  await open(page, '#/habits');
  await press(page, page.locator('[data-act=newHabit]'));
  await page.locator('#sheet input[name=name]').fill('Meditate');
  await press(page, page.locator('#sheet button[type=submit]'));
  const card = page.locator('[data-habit]', { hasText: 'Meditate' });
  await expect(card.locator('.hday')).toHaveCount(7);
  await press(page, card.locator('.hday').nth(6));
  await press(page, page.locator('[data-habit]', { hasText: 'Meditate' }).locator('.hday').nth(5));
  await expect(page.locator('[data-habit]', { hasText: 'Meditate' }).locator('[data-streak]')).toHaveText('🔥 2 days');
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('[data-habit]', { hasText: 'Meditate' }).locator('[data-streak]')).toHaveText('🔥 2 days');
  await press(page, page.locator('.tab[data-go=home]'));
  const row = page.locator('#screen .task', { hasText: 'Meditate' });
  await expect(row.locator('.check')).toHaveAttribute('aria-checked', 'true');
  await press(page, row.locator('.check'));
  await expect(page.locator('#screen .task', { hasText: 'Meditate' }).locator('.check')).toHaveAttribute('aria-checked', 'false');
});

test('Whole life: 80×52 grid marks the current week for a given birth date', async ({ page }) => {
  await open(page, '#/life');
  await expect(page.locator('#screen .empty')).toContainText('birth date');
  await page.locator('#screen input[data-setting=birthDate]').fill('1983-12-07');
  await page.locator('#screen input[data-setting=birthDate]').dispatchEvent('change');
  await expect(page.locator('#youAreHere')).toHaveCount(1);
  const expected = await page.evaluate(() => {
    const n = new Date(); const t = [n.getFullYear(), n.getMonth() + 1, n.getDate()];
    let y = t[0] - 1983; if (t[1] < 12 || (t[1] === 12 && t[2] < 7)) y--;
    const days = Math.floor((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(1983 + y, 11, 7)) / 864e5);
    return y * 52 + Math.min(51, Math.floor(days / 7));
  });
  await expect(page.locator('svg.life-grid')).toHaveAttribute('data-lived', String(expected));
  await expect(page.locator('[data-k=left]')).toHaveText((4160 - expected).toLocaleString('en-US'));
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('#youAreHere')).toHaveCount(1);
});

/* ===================== v1.3 ===================== */
test('Header: title next to the menu; top-right holds the screen action or the assistant', async ({ page }) => {
  await open(page, '#/projects');
  await expect(page.locator('#miniTitle')).toHaveText('Projects');
  await expect(page.locator('#topActions [data-act=newProject]')).toBeVisible();
  await press(page, page.locator('.tab[data-go=today]'));
  await expect(page.locator('#topActions [data-act=openAssistant]')).toBeVisible();
  const t = await page.locator('#miniTitle').boundingBox(), m = await page.locator('#menuBtn').boundingBox();
  expect(Math.abs((t.y + t.height / 2) - (m.y + m.height / 2))).toBeLessThan(6);
});

test('Home: date under each clock, IDR rate, change vs yesterday, sun tile, my priorities', async ({ page }) => {
  await open(page);
  await expect(page.locator('.clock .cday').first()).toHaveText(/^[A-Z][a-z]{2} \d{1,2}$/);
  await expect(page.locator('#wIdr')).toHaveText('16,350');
  await expect(page.locator('#wUsdtC')).toContainText('▲ 0.40%');
  await expect(page.locator('#wIdrC')).toContainText('▼ 0.12%');
  await expect(page.locator('.widget[data-act=enableGeo]')).toContainText('Tap to use location');
  await expect(page.locator('.pri-chip')).toHaveText(['1Здоровье', '2Свобода', '3Доход', '4Отношения', '5Комфорт', '6Друзья/Близкие']);
  await press(page, page.locator('[data-act=newLifePri]'));
  await page.locator('#sheet input[name=name]').fill('Путешествия');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.pri-chip')).toHaveCount(7);
  await expect(page.locator('.shortcut')).toHaveCount(12);
});

test('Assistant: one message creates a task with date/time/priority, an expense and a note', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.ai-bar'));
  await page.locator('#aiText').fill('Позвонить в банк завтра в 10:00 !\nРасход 1200 руб такси\nЗаметка: идеи для поездки');
  await expect(page.locator('.ai-item')).toHaveCount(3);
  await press(page, page.locator('#sheet button[type=submit]'));
  const d = await stored(page);
  const task = d.tasks.find((x) => x.title === 'Позвонить в банк');
  const tomorrow = await page.evaluate(() => { const n = new Date(); n.setDate(n.getDate() + 1); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); });
  expect(task).toMatchObject({ date: tomorrow, time: '10:00', priority: 'urgent', list: 'inbox' });
  expect(d.finance.find((r) => r.amount === 1200)).toMatchObject({ kind: 'expense', currency: 'RUB', category: 'Transport', note: 'Такси' });
  expect(d.notes.some((n) => n.body === 'идеи для поездки')).toBe(true);
  await press(page, page.locator('.ai-bar'));
  await page.locator('#aiText').fill('Готово позвонить в банк');
  await press(page, page.locator('#sheet button[type=submit]'));
  expect((await stored(page)).tasks.find((x) => x.title === 'Позвонить в банк').done).toBe(true);
});

test('A task added from Today lands in Today; title and description come first', async ({ page }) => {
  await open(page, '#/today');
  await press(page, page.locator('[data-act=newTask]'));
  await expect(page.locator('#sheet .field > span').nth(0)).toHaveText('Task title');
  await expect(page.locator('#sheet .field > span').nth(1)).toHaveText('Description');
  await expect(page.locator('#sheet select[name=list]')).toHaveValue('anytime');
  await page.locator('#sheet input[name=title]').fill('Planned from Today');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task-title', { hasText: 'Planned from Today' })).toHaveCount(1);
  const t = (await stored(page)).tasks.find((x) => x.title === 'Planned from Today');
  expect(t.date).toBe(await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }));
});

test('Paused status keeps a task out of Today and lists it under Paused', async ({ page }) => {
  await open(page, '#/today');
  await press(page, page.locator('#screen .task-body', { hasText: 'Approve renovation budget' }));
  await page.locator('#sheet select[name=status]').selectOption('paused');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task', { hasText: 'Approve renovation budget' })).toHaveCount(0);
  await viaMenu(page, 'Paused');
  await expect(page.locator('#screen .task', { hasText: 'Approve renovation budget' })).toHaveCount(1);
});

test('+ Balance opens the balance record sheet', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.add-btn'));
  await press(page, page.locator('#sheet .choice', { hasText: 'Balance' }));
  await expect(page.locator('#sheetTitle')).toHaveText('Record balances');
});

test('Travel planner: trip with dates and a checklist', async ({ page }) => {
  await open(page, '#/travel');
  await press(page, page.locator('[data-act=newTrip]'));
  await page.locator('#sheet input[name=title]').fill('Ski week');
  await page.locator('#sheet input[name=destination]').fill('Niseko, Japan');
  await page.locator('#sheet input[name=start]').fill('2027-01-20');
  await page.locator('#sheet input[name=end]').fill('2027-01-27');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(h1(page)).toHaveText('Ski week');
  await page.locator('form[data-form=tripItem] input').fill('Passport');
  await page.locator('form[data-form=tripItem] input').press('Enter');
  await press(page, page.locator('#screen .check').first());
  await expect(page.locator('#screen .check').first()).toHaveAttribute('aria-checked', 'true');
  await press(page, page.locator('#backBtn'));
  await expect(page.locator('.item-card', { hasText: 'Ski week' })).toContainText('✓ 1/1');
});

test('Friends: log contact and see when to reach out next', async ({ page }) => {
  await open(page, '#/friends');
  await press(page, page.locator('[data-act=newFriend]'));
  await page.locator('#sheet input[name=name]').fill('Ivan');
  await page.locator('#sheet input[name=contact]').fill('@ivan');
  await press(page, page.locator('#sheet button[type=submit]'));
  const card = page.locator('[data-friend]', { hasText: 'Ivan' });
  await expect(card).toContainText('Reach out');
  await expect(card.locator('a')).toHaveAttribute('href', 'https://t.me/ivan');
  await press(page, card.locator('[data-act=friendContacted]'));
  await expect(page.locator('[data-friend]', { hasText: 'Ivan' })).toContainText('in 30 days');
});

test('Watch · Read · Listen: add a book, mark it done', async ({ page }) => {
  await open(page, '#/media');
  await press(page, page.locator('[data-act=newMedia]'));
  await page.locator('#sheet input[name=title]').fill('Sapiens');
  await page.locator('#sheet select[name=type]').selectOption('Book');
  await page.locator('#sheet input[name=link]').fill('example.com/sapiens');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.bm', { hasText: 'Sapiens' }).locator('a')).toHaveAttribute('href', 'https://example.com/sapiens');
  await press(page, page.locator('.bm', { hasText: 'Sapiens' }).locator('.check'));
  await expect(page.locator('.bm', { hasText: 'Sapiens' })).toHaveCount(0);
  await press(page, page.locator('[data-act=mediaStatus][data-v=Done]'));
  await expect(page.locator('.bm', { hasText: 'Sapiens' })).toHaveCount(1);
});

test('Notes: dates, picture, link; listed by date like Apple Notes', async ({ page }) => {
  await open(page, '#/notes');
  await press(page, page.locator('[data-act=newNote]'));
  await expect(page.locator('.note-dates')).toContainText('Created');
  await page.locator('.title-in').fill('Trip ideas 2027');
  await page.locator('.body-in').fill('See https://example.org/guide');
  await page.locator('[data-note-photo]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#noteThumbs .thumb')).toHaveCount(1);
  await press(page, page.locator('[data-act=noteLink]'));
  await page.locator('#sheet input[name=url]').fill('example.com');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('.att-link')).toHaveCount(2);
  await press(page, page.locator('#backBtn'));
  const card = page.locator('.note-card', { hasText: 'Trip ideas 2027' });
  await expect(card).toContainText('🖼 1');
  await expect(page.locator('#screen .section h2').first()).toContainText(/Pinned|Today/);
});

test('Safe: Document and Bank card show only relevant fields; document photos are encrypted', async ({ page }) => {
  await open(page, '#/safe');
  await page.locator('input[name=pin]').fill('4821'); await page.locator('input[name=pin2]').fill('4821');
  await press(page, page.locator('form[data-form=safeSetup] button[type=submit]'));
  await press(page, page.locator('[data-act=newSafe]'));
  await page.locator('#sheet select[name=type]').selectOption('Document');
  await expect(page.locator('#sheet .field > span')).toHaveText(['Type', 'Document title', 'Number', 'Expiration date', 'Photos', 'Note', 'Tag']);
  await page.locator('#sheet input[name=title]').fill('Passport');
  await page.locator('#sheet input[name=number]').fill('AB1234567');
  await page.locator('#sheet input[name=expires]').fill('2027-01-15');
  await page.locator('[data-safe-photo]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#safeThumbs .thumb')).toHaveCount(1);
  await press(page, page.locator('#sheet button[type=submit]'));
  const card = page.locator('[data-safe]', { hasText: 'Passport' });
  await expect(card).toContainText('•••••');
  await expect(card).not.toContainText('AB1234567');
  const enc = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('focus-photos', 1); r.onsuccess = () => { const g = r.result.transaction('photos').objectStore('photos').getAll(); g.onsuccess = () => res(g.result.filter((x) => x.enc === 1).length); }; }));
  expect(enc).toBe(1);
  await press(page, page.locator('[data-act=newSafe]'));
  await page.locator('#sheet select[name=type]').selectOption('Bank card');
  await expect(page.locator('#sheet .field > span')).toHaveText(['Type', 'Name', 'Card number', 'Expiration (MM/YY)', 'CVV', 'Billing address', 'Photos', 'Note', 'Tag']);
  await page.locator('#sheet input[name=title]').fill('Visa');
  await page.locator('#sheet input[name=cardNumber]').fill('4111 1111 1111 4417');
  await page.locator('#sheet input[name=cardExp]').fill('13/29');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#safeFormErr')).toContainText('08/29');
  await page.locator('#sheet input[name=cardExp]').fill('08/29');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-safe]', { hasText: 'Visa' })).toContainText('•••• 4417');
});

/* ===================== v1.6 ===================== */
const ymdToday = (page) => page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });

test('Quick add: one line + Return adds to the current section and keeps the line open', async ({ page }) => {
  await open(page, '#/someday');
  const input = page.locator('#screen .quick-add .qa-in');
  await expect(input).toHaveAttribute('placeholder', 'Add to Someday');
  await input.fill('Learn to surf');
  await input.press('Enter');
  await expect(page.locator('#toast')).toContainText('Added to Someday');
  await expect(page.locator('#screen .quick-add .qa-in')).toBeFocused();
  await page.locator('#screen .quick-add .qa-in').fill('Visit Iceland');
  await press(page, page.locator('#screen .quick-add .qa-add'));
  const titles = await page.locator('#screen .task-title').allTextContents();
  expect(titles.slice(0, 2)).toEqual(['Visit Iceland', 'Learn to surf']);
  await expect(page.locator('#screen > .page-head + .quick-add')).toHaveCount(1);
  const d = await stored(page);
  expect(d.tasks.find((x) => x.title === 'Learn to surf').list).toBe('someday');
  await press(page, page.locator('#toastBtn'));
  await expect(page.locator('#screen .task-title', { hasText: 'Visit Iceland' })).toHaveCount(0);
});

test('Quick add follows the screen: Today, Most important, Follow-up, a project', async ({ page }) => {
  await open(page, '#/today');
  await page.locator('#screen .quick-add .qa-in').fill('Today item');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  await viaMenu(page, 'Most important');
  await page.locator('#screen .quick-add .qa-in').fill('Urgent item');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  await viaMenu(page, 'Follow-up');
  await page.locator('#screen .quick-add .qa-in').fill('Waiting item');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  await expect(page.locator('#screen .task-title', { hasText: 'Waiting item' })).toHaveCount(1);
  await viaMenu(page, 'Projects');
  await press(page, page.locator('.item-card', { hasText: 'Home renovation' }));
  await page.locator('#screen .quick-add .qa-in').fill('Project item');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  await expect(page.locator('#screen .task-title', { hasText: 'Project item' })).toHaveCount(1);
  const d = await stored(page), t = await ymdToday(page);
  const by = (n) => d.tasks.find((x) => x.title === n);
  expect(by('Today item').date).toBe(t);
  expect(by('Urgent item').priority).toBe('urgent');
  expect(by('Waiting item').status).toBe('waiting');
  expect(by('Project item').project).toBe('p_home');
});

test('+ opens on the current section: a project gets the task, Notes gets a note', async ({ page }) => {
  await open(page, '#/project/p_home');
  await press(page, page.locator('.add-btn'));
  await expect(page.locator('#sheetTitle')).toHaveText('Add to Home renovation');
  await page.locator('#qsTitle').fill('Order tiles');
  await page.locator('#qsTitle').press('Enter');
  await expect(page.locator('#qsTitle')).toHaveValue('');
  await expect(page.locator('#qsTitle')).toBeFocused();
  await page.locator('#qsTitle').fill('Call plumber');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await expect(page.locator('#screen .task-title', { hasText: 'Order tiles' })).toHaveCount(1);
  await expect(page.locator('#screen .task-title', { hasText: 'Call plumber' })).toHaveCount(1);
  await viaMenu(page, 'Notes');
  await press(page, page.locator('.add-btn'));
  await expect(page.locator('#sheetTitle')).toHaveText('Add to Notes');
  await page.locator('#qsTitle').fill('Gift ideas');
  await page.locator('#qsTitle').press('Enter');
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await expect(page.locator('#screen .item-card', { hasText: 'Gift ideas' })).toHaveCount(1);
});

test('Deadlines: add with a date, see it in the menu and on Home; Hard deadline in the task form', async ({ page }) => {
  await open(page, '#/deadlines');
  const t = await ymdToday(page);
  const soon = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await page.locator('#screen .quick-add .qa-in').fill('File taxes');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  await expect(page.locator('#toast')).toContainText('Pick the deadline date');
  await page.locator('#screen .quick-add .qa-date').fill(soon);
  await press(page, page.locator('#screen .quick-add .qa-add'));
  await expect(page.locator('#screen .task', { hasText: 'File taxes' })).toContainText('in 3 days');
  await press(page, page.locator('#screen .task-body', { hasText: 'File taxes' }));
  await expect(page.locator('#sheet input[name=deadline]')).toBeChecked();
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer .nav-link[data-go=deadlines] .nl')).toHaveAttribute('data-sub', 'Next in 3 days');
  await press(page, page.locator('#drawer .nav-link[data-go=home]'));
  await expect(page.locator('#screen .task', { hasText: 'File taxes' })).toHaveCount(1);
  await viaMenu(page, 'Inbox');
  await press(page, page.locator('[data-act=newTask]').first());
  await page.locator('#sheet input[name=title]').fill('Renew passport');
  await page.locator('#sheet input[name=deadline]').check();
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#taskErr')).toHaveText('A deadline needs a date.');
  await page.locator('#sheet input[name=date]').fill(t);
  await press(page, page.locator('#sheet button[type=submit]'));
  expect((await stored(page)).tasks.find((x) => x.title === 'Renew passport').deadline).toBe(true);
});

test('Menu: grouped and collapsible, areas with their projects, Inbox count on the bottom bar', async ({ page }) => {
  await open(page);
  await expect(page.locator('#tabInboxN')).toBeVisible();
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer .group-btn')).toHaveText(['Tasks', 'Views', 'Areas & projects', 'Life', 'Knowledge', 'Vault', 'Money', 'App']);
  await expect(page.locator('#drawer .nav-proj.child', { hasText: 'Home renovation' })).toHaveCount(1);
  await press(page, page.locator('#drawer .group-btn', { hasText: 'Life' }));
  await expect(page.locator('#drawer .nav-link[data-go=habits]')).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer .group-btn', { hasText: 'Life' })).toHaveAttribute('aria-expanded', 'false');
  await press(page, page.locator('#drawer .nav-proj.child', { hasText: 'Home renovation' }));
  await expect(h1(page)).toHaveText('Home renovation');
  await press(page, page.locator('.tab[data-go=inbox]'));
  await expect(h1(page)).toHaveText('Inbox');
});

test('Home: focus first, priorities, habits and How was today at the bottom; money hidden until Show', async ({ page }) => {
  await open(page);
  const order = await page.evaluate(() => Array.from(document.querySelectorAll('#screen .focus-card h2, #screen .section h2')).map((h) => h.firstChild.textContent));
  expect(order[0]).toBe('Today’s focus');
  expect(order.slice(-3)).toEqual(['My priorities', 'Habits today', 'How was today?']);
  await expect(page.locator('.money-card .masked').first()).toHaveText('•••••');
  await press(page, page.locator('[data-act=toggleMoney]'));
  await expect(page.locator('.money-card .masked')).toHaveCount(0);
  await press(page, page.locator('#screen .mood', { hasText: 'Good' }));
  await expect(page.locator('#screen .mood', { hasText: 'Good' })).toHaveAttribute('aria-checked', 'true');
  await press(page, page.locator('#toastBtn'));
  await page.locator('#jText').fill('Shipped the new menu');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .j-note')).toHaveText('Shipped the new menu');
  await viaMenu(page, 'Journal');
  await expect(page.locator('#screen .mood[aria-checked=true]')).toHaveText('Good');
});

/* ===================== v1.6.1 ===================== */
test('Money: add an account with balance and date in one step; monthly entry with debts typed without a minus', async ({ page }) => {
  await page.goto('index.html');
  await mockApis(page);
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('.money-card [data-act=newAccount]')).toBeVisible();
  await viaMenu(page, 'Money');
  await press(page, page.locator('[data-act=moneyTab][data-v=balance]'));
  await press(page, page.locator('[data-act=newAccount]'));
  await page.locator('#sheet input[name=name]').fill('BCA Bali');
  await page.locator('#sheet input[name=amount]').fill('12 500');
  await page.locator('#sheet input[name=date]').fill('2026-10-01');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-sum=bank]')).toHaveText('$12,500');
  await expect(page.locator('.bal-due')).toContainText('aren’t recorded yet');
  await press(page, page.locator('.bal-due [data-act=recordBalances]'));
  const date = await ymdToday(page);
  await expect(page.locator('#sheet input[name=date]')).toHaveValue(date);
  await expect(page.locator('#sheet .bal-field input')).toHaveValue('12 500');
  await page.locator('#sheet .bal-field input').fill('13000');
  await page.locator('#sheet input[name=new_name]').fill('Credit card');
  await page.locator('#sheet select[name=new_cat]').selectOption('mydebt');
  await page.locator('#sheet input[name=new_amount]').fill('2000');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-sum=mydebt]')).toHaveText('−$2,000');
  await expect(page.locator('[data-sum=net]')).toHaveText('$11,000');
  await expect(page.locator('.bal-due')).toHaveCount(0);
  await expect(page.locator('#screen .rec')).toHaveCount(2);
  await press(page, page.locator('[data-act=recordBalances]').first());
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('[data-sum=net]')).toHaveText('$11,000');
});

/* ===================== v1.6.2 ===================== */
test('Money: Credit cards count as money owed; tap an account to add, edit and delete its entries', async ({ page }) => {
  await open(page, '#/finance');
  await press(page, page.locator('[data-act=moneyTab][data-v=balance]'));
  const netBefore = await page.locator('[data-sum=net]').textContent();
  await press(page, page.locator('[data-act=newAccount]'));
  await page.locator('#sheet input[name=name]').fill('Visa Platinum');
  await page.locator('#sheet select[name=category]').selectOption('card');
  await page.locator('#sheet input[name=amount]').fill('1500');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('[data-sum=card]')).toHaveText('−$1,500');
  expect(await page.locator('[data-sum=net]').textContent()).not.toBe(netBefore);
  await expect(page.locator('table.bal tr.grp', { hasText: 'Credit cards' })).toHaveCount(1);
  await press(page, page.locator('table.bal tr.acc-row', { hasText: 'Visa Platinum' }).locator('td').last());
  await expect(page.locator('#sheetTitle')).toHaveText('Visa Platinum');
  await expect(page.locator('#accNow')).toHaveText('−$1,500');
  await page.locator('#sheet form[data-form=accEntry] input[name=amount]').fill('900');
  await page.locator('#sheet form[data-form=accEntry] input[name=date]').fill('2026-01-15');
  await press(page, page.locator('#sheet form[data-form=accEntry] button[type=submit]'));
  await expect(page.locator('#sheet .entry-row')).toHaveCount(2);
  await press(page, page.locator('#sheet .entry-row', { hasText: 'Jan 15' }).first());
  await expect(page.locator('#sheet form[data-form=accEntry] input[name=amount]')).toHaveValue('900');
  await page.locator('#sheet form[data-form=accEntry] input[name=amount]').fill('950');
  await press(page, page.locator('#sheet form[data-form=accEntry] button[type=submit]'));
  let d = await stored(page);
  const acc = d.accounts.find((x) => x.name === 'Visa Platinum');
  expect(d.balances.filter((b) => b.account === acc.id).map((b) => b.amount).sort()).toEqual([-1500, -950]);
  await press(page, page.locator('#sheet .entry-row', { hasText: 'Jan 15' }).first());
  await press(page, page.locator('#sheet [data-act=deleteEntry]'));
  await expect(page.locator('#sheet .entry-row')).toHaveCount(1);
  d = await stored(page);
  expect(d.balances.filter((b) => b.account === acc.id).length).toBe(1);
});

/* ===================== v1.6.3 ===================== */
test('Money: balance required on create, amounts show thousands and currency, accounts move up and down everywhere', async ({ page }) => {
  await open(page, '#/finance');
  await press(page, page.locator('[data-act=moneyTab][data-v=balance]'));
  await press(page, page.locator('[data-act=newAccount]'));
  await expect(page.locator('#sheet .field > span').nth(1)).toHaveText('Current balance');
  await page.locator('#sheet input[name=name]').fill('BCA Bali');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#accErr')).toContainText('Enter the current balance');
  await page.locator('#sheet input[name=amount]').fill('1234567.5');
  await expect(page.locator('#sheet input[name=amount]')).toHaveValue('1 234 567.5');
  await expect(page.locator('#sheet [data-cur-sym]')).toHaveText('$');
  await page.locator('#sheet select[name=currency]').selectOption('IDR');
  await expect(page.locator('#sheet [data-cur-sym]')).toHaveText('Rp');
  await page.locator('#sheet select[name=currency]').selectOption('USD');
  await press(page, page.locator('#sheet button[type=submit]'));
  let d = await stored(page);
  const bca = d.accounts.find((a) => a.name === 'BCA Bali');
  expect(d.balances.find((b) => b.account === bca.id).amount).toBe(1234567.5);
  const banks = async () => page.evaluate(() => {
    const out = []; let inBanks = false;
    document.querySelectorAll('table.bal tbody tr').forEach((tr) => { if (tr.classList.contains('grp')) inBanks = tr.textContent === 'Banks'; else if (inBanks) out.push(tr.querySelector('.cell-btn').textContent); });
    return out;
  });
  expect(await banks()).toEqual(['Main bank (USD)', 'Bank (RUB)', 'BCA Bali']);
  await press(page, page.locator('[data-act=accReorder]'));
  await press(page, page.locator('[data-act=moveAcc][data-id="' + bca.id + '"][data-d="-1"]'));
  await press(page, page.locator('[data-act=moveAcc][data-id="' + bca.id + '"][data-d="-1"]'));
  await expect(page.locator('[data-sort-list="acc-bank"] .ar-name')).toHaveText(['BCA Bali', 'Main bank (USD)', 'Bank (RUB)']);
  await expect(page.locator('[data-act=moveAcc][data-id="' + bca.id + '"][data-d="-1"]')).toBeDisabled();
  await press(page, page.locator('[data-act=accReorder]'));
  expect(await banks()).toEqual(['BCA Bali', 'Main bank (USD)', 'Bank (RUB)']);
  await press(page, page.locator('[data-act=recordBalances]').first());
  const recBanks = await page.evaluate(() => {
    const out = []; let on = false;
    document.querySelectorAll('#sheet .bal-grp, #sheet .bal-field').forEach((el) => { if (el.classList.contains('bal-grp')) on = el.textContent === 'Banks'; else if (on) out.push(el.querySelector('.bf-name').firstChild.textContent); });
    return out;
  });
  expect(recBanks).toEqual(['BCA Bali', 'Main bank (USD)', 'Bank (RUB)']);
  await expect(page.locator('#sheet input[name="acc_' + bca.id + '"]')).toHaveValue('1 234 567.5');
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await press(page, page.locator('table.bal tr.acc-row', { hasText: 'Bank (RUB)' }).locator('td').first());
  await press(page, page.locator('#sheet .acc-move [data-d="-1"]'));
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  expect(await banks()).toEqual(['BCA Bali', 'Bank (RUB)', 'Main bank (USD)']);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  expect(await banks()).toEqual(['BCA Bali', 'Bank (RUB)', 'Main bank (USD)']);
});

/* ===================== v1.6.4 ===================== */
test('Money: saldo = cash+banks+crypto+stocks + debts to me − my debts and cards; net worth = saldo + assets; old positive debts are deducted', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('focus.data.v1')) return;
    const d = { v: 1, tasks: [], projects: [], notes: [], finance: [], purchases: [],
      accounts: [
        { id: 'c1', name: 'Cash', category: 'cash', currency: 'USD' }, { id: 'b1', name: 'BCA', category: 'bank', currency: 'USD' },
        { id: 's1', name: 'Broker', category: 'stocks', currency: 'USD' }, { id: 't1', name: 'Loan to Ivan', category: 'theirdebt', currency: 'USD' },
        { id: 'm1', name: 'Mortgage', category: 'mydebt', currency: 'USD' }, { id: 'k1', name: 'Visa', category: 'card', currency: 'USD' },
        { id: 'h1', name: 'Villa', category: 'asset', currency: 'USD' }],
      balances: [['c1', 1000], ['b1', 20000], ['s1', 5000], ['t1', 2000], ['m1', 10000], ['k1', 1500], ['h1', 300000]].map(([a, v], i) => ({ id: 'x' + i, account: a, date: '2026-11-01', amount: v })),
      settings: { demoPurged: true } };
    localStorage.setItem('focus.data.v1', JSON.stringify(d));
  });
  await mockApis(page);
  await page.goto('index.html#/finance');
  await page.waitForSelector('html[data-ready="1"]');
  await press(page, page.locator('[data-act=moneyTab][data-v=balance]'));
  await expect(page.locator('#balSummary .sum-row:not(.sub) > span:first-child')).toHaveText(['Cash + banks + crypto + stocks', '+ Debts to me', '− My debts and credit cards', 'Total saldo', '+ Assets value', 'Net worth']);
  await expect(page.locator('[data-sum=liquid]')).toHaveText('$26,000');
  await expect(page.locator('[data-sum=theirdebt]')).toHaveText('$2,000');
  await expect(page.locator('[data-sum=debts]')).toHaveText('−$11,500');
  await expect(page.locator('[data-sum=saldo]')).toHaveText('$16,500');
  await expect(page.locator('[data-sum=net]')).toHaveText('$316,500');
  const d = await stored(page);
  expect(d.balances.find((b) => b.account === 'm1').amount).toBe(-10000);
});

/* ===================== v1.7 ===================== */
test('Drag to reorder: notes, habits, priorities, accounts and subtasks keep the new order', async ({ page }) => {
  await open(page, '#/notes');
  const notes = page.locator('#screen [data-sort-list="notes-all"] > .sort-item');
  const n0 = await notes.nth(0).locator('h3').textContent(), n1 = await notes.nth(1).locator('h3').textContent();
  const b0 = await notes.nth(0).boundingBox();
  await dragTo(page, notes.nth(1).locator('.grip'), b0.x + 40, b0.y + 4);
  await expect(notes.nth(0).locator('h3')).toHaveText(n1);
  await expect(notes.nth(1).locator('h3')).toHaveText(n0);
  await page.reload(); await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('#screen [data-sort-list="notes-all"] > .sort-item').nth(0).locator('h3')).toHaveText(n1);

  await viaMenu(page, 'Habits');
  const hb = page.locator('#screen [data-sort-list="habits"] > .sort-item');
  const h0 = await hb.nth(0).locator('.habit-name').textContent(), h1 = await hb.nth(1).locator('.habit-name').textContent();
  const hb0 = await hb.nth(0).boundingBox();
  await dragTo(page, hb.nth(1).locator('.grip').first(), hb0.x + 40, hb0.y + 4);
  await expect(hb.nth(0).locator('.habit-name')).toHaveText(h1);
  await expect(hb.nth(1).locator('.habit-name')).toHaveText(h0);

  await viaMenu(page, 'Home');
  const pri = page.locator('#screen .pri-wrap');
  await pri.nth(0).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const p0 = await pri.nth(0).locator('.pri-chip').textContent();
  const last = await pri.nth(2).boundingBox();
  await dragTo(page, pri.nth(0).locator('.grip'), last.x + last.width - 4, last.y + last.height / 2);
  expect((await stored(page)).lifePriorities[0]).not.toBe(p0.slice(1));

  await viaMenu(page, 'Money');
  await press(page, page.locator('[data-act=moneyTab][data-v=balance]'));
  await press(page, page.locator('[data-act=accReorder]'));
  const banks = page.locator('[data-sort-list="acc-bank"] > .acc-ro');
  await banks.nth(0).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const a0 = await banks.nth(0).locator('.ar-name').textContent(), a1 = await banks.nth(1).locator('.ar-name').textContent();
  const ab0 = await banks.nth(0).boundingBox();
  await dragTo(page, banks.nth(1).locator('.grip'), ab0.x + 40, ab0.y + 4);
  await expect(banks.nth(0).locator('.ar-name')).toHaveText(a1);
  await expect(banks.nth(1).locator('.ar-name')).toHaveText(a0);
});

test('Forms: the main button is at the top next to ✕; the assistant adds to the screen you are on and understands more', async ({ page }) => {
  await open(page, '#/someday');
  await press(page, page.locator('[data-act=newTask]'));
  await expect(page.locator('#sheet .sheet-head button[type=submit]')).toHaveText('Save');
  await page.locator('#sheet input[name=title]').fill('Header save works');
  await press(page, page.locator('#sheet .sheet-head button[type=submit]'));
  expect((await stored(page)).tasks.find((x) => x.title === 'Header save works').list).toBe('someday');
  await viaMenu(page, 'Today');
  await press(page, page.locator('#topActions [data-act=openAssistant]'));
  await expect(page.locator('#sheet .sheet-head button[type=submit]')).toHaveText('Apply');
  await page.locator('#aiText').fill('Купить подарок\nчерез 3 дня отправить отчёт каждую неделю\n1200 руб такси');
  await expect(page.locator('.ai-item')).toHaveCount(3);
  await expect(page.locator('.ai-item').nth(2)).toContainText('Expense');
  await press(page, page.locator('#sheet .sheet-head button[type=submit]'));
  const d = await stored(page), t = await ymdToday(page);
  expect(d.tasks.find((x) => x.title === 'Купить подарок').date).toBe(t);
  const rep = d.tasks.find((x) => x.title === 'Отправить отчёт');
  expect(rep.repeat).toBe('weekly');
  expect(rep.date > t).toBe(true);
  expect(d.finance.some((f) => f.amount === 1200 && f.kind === 'expense')).toBe(true);
  await press(page, page.locator('#toastBtn'));
  expect((await stored(page)).tasks.find((x) => x.title === 'Купить подарок')).toBeUndefined();
});

/* ===================== v1.7.1 ===================== */
test.describe('location follows the phone', () => {
  test.use({ timezoneId: 'Asia/Makassar' });
  test('a saved Moscow position is replaced by Bali when the phone is on Bali time', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('focus.geo', JSON.stringify({ lat: 55.75, lon: 37.62, t: Date.now() - 86400000 })));
    await open(page);
    await expect(page.locator('.widget[data-act=enableGeo] .wl')).toContainText('Bali');
    const g = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.geo')));
    expect(Math.round(g.lat)).toBe(-9);
    await expect(page.locator('a.widget[href*="google.com/maps"]')).toContainText('Bali');
  });
});

test('Closing a form saves the edit; Next week means next Monday', async ({ page }) => {
  await open(page, '#/inbox');
  await press(page, page.locator('#screen .task-body').first());
  await page.locator('#sheet input[name=title]').fill('Renamed by closing');
  await press(page, page.locator('#sheet [data-act=formDate][data-n="7"]'));
  const v = await page.locator('#sheet input[name=date]').inputValue();
  expect(new Date(v + 'T12:00:00').getDay()).toBe(1);
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  await expect(page.locator('.sheet-wrap')).not.toHaveClass(/on/);
  const t = (await stored(page)).tasks.find((x) => x.title === 'Renamed by closing');
  expect(t.date).toBe(v);
  await press(page, page.locator('[data-act=newTask]').first());
  await press(page, page.locator('#sheet [data-act=closeSheet]'));
  expect((await stored(page)).tasks.filter((x) => x.title === '').length).toBe(0);
});

test('Assistant files anything: friend, trip, purchase, balance, journal, idea, link with tag, expense category', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.ai-bar'));
  await page.locator('#aiText').fill(['друг Иван +7 999 123 45 67', 'поездка в Японию', 'хочу купить лодку 30000$', 'баланс Main bank 25000', 'день был отличный', 'идея: подкаст про виллы', 'bookmark https://example.com #work', 'кофе 45000 idr'].join('\n'));
  await expect(page.locator('.ai-item')).toHaveCount(8);
  await expect(page.locator('.ai-item').nth(0)).toContainText('Friend');
  await expect(page.locator('.ai-item').nth(1)).toContainText('Trip');
  await expect(page.locator('.ai-item').nth(2)).toContainText('Purchase');
  await expect(page.locator('.ai-item').nth(3)).toContainText('Main bank');
  await expect(page.locator('.ai-item').nth(4)).toContainText('Journal');
  await press(page, page.locator('#sheet button[type=submit]'));
  const d = await stored(page);
  expect(d.friends.some((f) => f.name === 'Иван' && f.contact.includes('999'))).toBe(true);
  expect(d.trips.some((x) => /Японию/.test(x.title))).toBe(true);
  expect(d.purchases.some((x) => x.title === 'лодку' && x.amount === 30000 && x.currency === 'USD')).toBe(true);
  expect(d.balances.some((b) => b.amount === 25000)).toBe(true);
  expect(d.journal.some((j) => j.mood === 5)).toBe(true);
  expect(d.notes.some((n) => n.body === 'подкаст про виллы')).toBe(true);
  expect(d.bookmarks.some((b) => b.tag === 'work')).toBe(true);
  expect(d.finance.some((f) => f.amount === 45000 && f.category === 'Family living' && f.currency === 'IDR')).toBe(true);
});

/* ===================== v1.8 ===================== */
test('Search everything from the top: finds projects and tasks and opens them', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.home-search'));
  await expect(page.locator('#globalSearch')).toBeFocused();
  await page.locator('#globalSearch').fill('renovation');
  await expect(page.locator('#searchResults .section h2', { hasText: 'Projects' })).toHaveCount(1);
  await expect(page.locator('#searchResults .s-hit mark').first()).toHaveText(/renovation/i);
  await press(page, page.locator('#searchResults .s-hit[data-go=project]').first());
  await expect(h1(page)).toHaveText('Home renovation');
  await press(page, page.locator('.search-top'));
  await expect(page.locator('#globalSearch')).toHaveValue('renovation');
});

test('Regular routines: lists repeating tasks by frequency and adds new ones', async ({ page }) => {
  await open(page);
  await viaMenu(page, 'Regular routines');
  await page.locator('.routine-add .qa-in').fill('Pay villa rent');
  await page.locator('.routine-add select').selectOption('monthly');
  await page.locator('.routine-add .qa-in').press('Enter');
  const sec = page.locator('#screen .section', { hasText: 'Every month' });
  await expect(sec).toHaveCount(1);
  await expect(page.locator('#screen .task-title', { hasText: 'Pay villa rent' })).toHaveCount(1);
  expect((await stored(page)).tasks.find((x) => x.title === 'Pay villa rent').repeat).toBe('monthly');
});

test('AI assistant: uses your key, sends priorities and tasks, can create a task, shows the reply', async ({ page, browserName }) => {
  // Playwright's WebKit can't mock the cross-origin CORS preflight to api.anthropic.com; the logic is covered on Chromium.
  test.skip(browserName === 'webkit', 'Cross-origin API mocking with preflight is not supported in Playwright WebKit');
  const calls = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access', 'access-control-allow-methods': 'POST, OPTIONS' };
  await page.route('https://api.anthropic.com/v1/messages', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
    const body = JSON.parse(req.postData());
    calls.push({ headers: req.headers(), body });
    if (calls.length === 1) {
      await route.fulfill({ headers: cors, json: { content: [{ type: 'text', text: 'Adding it.' }, { type: 'tool_use', id: 'tu1', name: 'create_task', input: { title: 'Call the notary', date: '2030-01-15', priority: 'high' } }], stop_reason: 'tool_use' } });
    } else {
      await route.fulfill({ headers: cors, json: { content: [{ type: 'text', text: 'Done. **Top 3** for today:\n- Review plan\n- Call the notary' }], stop_reason: 'end_turn' } });
    }
  });
  await open(page);
  await viaMenu(page, 'AI assistant');
  await page.locator('form[data-form=aiKey] input[name=key]').fill('sk-ant-test');
  await press(page, page.locator('form[data-form=aiKey] button[type=submit]'));
  await page.locator('#aiChatText').fill('Добавь задачу позвонить нотариусу');
  await press(page, page.locator('.ai-send'));
  await expect(page.locator('.ai-msg.bot').last()).toContainText('Top 3');
  await expect(page.locator('.ai-msg.bot strong')).toHaveText('Top 3');
  await expect(page.locator('.ai-changes')).toContainText('Call the notary');
  expect(calls[0].headers['x-api-key']).toBe('sk-ant-test');
  expect(calls[0].body.system).toContain('Life priorities');
  expect(calls[0].body.system).toContain('Review quarterly growth plan');
  expect(calls[0].body.system).not.toContain('Demo bank');
  expect(calls[0].body.tools.some((x) => x.name === 'web_search')).toBe(true);
  expect(calls[1].body.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu1' });
  const task = (await stored(page)).tasks.find((x) => x.title === 'Call the notary');
  expect(task).toMatchObject({ date: '2030-01-15', priority: 'high' });
  const key = await page.evaluate(() => localStorage.getItem('focus.ai'));
  expect(JSON.stringify(await stored(page))).not.toContain('sk-ant-test');
  expect(key).toContain('sk-ant-test');
});

/* ===================== v1.8.1 ===================== */
test('All tasks: count in the menu and on Home; Safe opens from anywhere on its block; Safe form is full height', async ({ page }) => {
  await open(page);
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1')).tasks.filter((t) => !t.done).length);
  await expect(page.locator('.all-tasks-link b')).toHaveText(String(n));
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer .nav-link[data-go=alltasks] .badge')).toHaveText(String(n));
  await press(page, page.locator('#drawer .nav-link[data-go=alltasks]'));
  await expect(h1(page)).toHaveText('All tasks');
  await expect(page.locator('#screen .task')).toHaveCount(n);
  await viaMenu(page, 'Home');
  await page.locator('.safe-quick strong').click();
  await expect(page.locator('form[data-form=safeSetup], form[data-form=safeUnlock]').first()).toBeVisible();
  await page.locator('input[name=pin]').fill('4821');
  await page.locator('input[name=pin2]').fill('4821');
  await press(page, page.locator('form[data-form=safeSetup] button[type=submit]'));
  await press(page, page.locator('[data-act=newSafe]'));
  const vh = await page.evaluate(() => window.innerHeight);
  const box = await page.locator('#sheet').boundingBox();
  expect(box.height).toBeGreaterThan(vh - 40);
  await page.locator('#sheet input[name=title]').fill('Tap card');
  await press(page, page.locator('#sheet button[type=submit]'));
  await page.locator('.safe-c', { hasText: 'Tap card' }).locator('.sc-top').click({ position: { x: 200, y: 10 } });
  await expect(page.locator('#sheet input[name=title]')).toHaveValue('Tap card');
});
