// @ts-check
const { test, expect } = require('@playwright/test');

const SCREENS = ['Home', 'Inbox', 'Today', 'Upcoming', 'Anytime', 'Someday', 'Logbook', 'Calendar', 'Kanban',
  'Areas', 'Projects', 'Notes', 'Safe Storage', 'Income & Expenses', 'Major Purchases'];

/** Tap on touch devices, click elsewhere — exercises the same path a finger uses on iPhone. */
async function press(page, locator) {
  const touch = test.info().project.use.hasTouch;
  if (touch) await locator.tap(); else await locator.click();
}
async function open(page, hash = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('index.html' + hash);
  await page.waitForSelector('html[data-ready="1"]');
  return errors;
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
  await expect(page.locator('#backBtn')).toBeHidden();
  const menuBox = await page.locator('#menuBtn').boundingBox();
  expect(menuBox.x).toBeLessThan(40); // hamburger sits on the left
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
  await press(page, page.locator('.tab[data-go="projects"]'));
  await expect(h1(page)).toHaveText('Projects');
  await press(page, page.locator('.item-card', { hasText: 'Home renovation' }));
  await expect(h1(page)).toHaveText('Home renovation');
  await press(page, page.locator('#backBtn'));
  await expect(h1(page)).toHaveText('Projects');
  await press(page, page.locator('#backBtn'));
  await expect(h1(page)).toHaveText('Home');
  await expect(page.locator('#backBtn')).toBeHidden();
  await press(page, page.locator('.tab[data-go="calendar"]'));
  await expect(h1(page)).toHaveText('Calendar');
  await page.goBack();
  await expect(h1(page)).toHaveText('Home');
});

test('+ opens chooser; a new task lands in Inbox and survives reload', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.add-btn'));
  const choices = page.locator('#sheet .choice');
  await expect(choices).toHaveText(['Task', 'Note', 'Safe', 'Income', 'Expense']);
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

test('Safe Storage: create, add, lock, reject wrong password, unlock; encrypted at rest', async ({ page }) => {
  await open(page);
  await press(page, page.locator('.add-btn'));
  await press(page, page.locator('#sheet .choice', { hasText: 'Safe' }));
  await expect(h1(page)).toHaveText('Safe Storage');
  await page.locator('input[name=pw]').fill('correct horse 1');
  await page.locator('input[name=pw2]').fill('correct horse 1');
  await press(page, page.locator('form[data-form=safeSetup] button[type=submit]'));
  await press(page, page.locator('[data-act=newSafe]'));
  await page.locator('#sheet input[name=title]').fill('Demo bank');
  await page.locator('#sheet input[name=login]').fill('demo.user@example.com');
  await page.locator('#sheet input[name=secret]').fill('not-a-real-secret-42');
  await press(page, page.locator('#sheet button[type=submit]'));
  const card = page.locator('[data-safe]', { hasText: 'Demo bank' });
  await expect(card).toContainText('••••••••');
  await press(page, card.locator('[data-act=safeReveal]'));
  await expect(card).toContainText('not-a-real-secret-42');
  const raw = await page.evaluate(() => localStorage.getItem('focus.vault.v1'));
  expect(raw).not.toContain('not-a-real-secret-42');
  expect(raw).not.toContain('Demo bank');
  await press(page, page.locator('[data-act=safeLock]'));
  await expect(page.locator('form[data-form=safeUnlock]')).toBeVisible();
  await page.locator('input[name=pw]').fill('wrong password');
  await press(page, page.locator('form[data-form=safeUnlock] button[type=submit]'));
  await expect(page.locator('#safeErr')).toHaveText('Wrong password.');
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await page.locator('input[name=pw]').fill('correct horse 1');
  await press(page, page.locator('form[data-form=safeUnlock] button[type=submit]'));
  await expect(page.locator('[data-safe]', { hasText: 'Demo bank' })).toHaveCount(1);
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
