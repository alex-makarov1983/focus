// @ts-check
/* Focus 1.10: lists, statuses and tags you manage; drag between lists on All tasks; Home tiles; layout settings. */
const { test, expect } = require('@playwright/test');

/* A tall screen so every list on All tasks is visible at once for drag tests. */
test.use({ viewport: { width: 390, height: 2400 } });

async function press(page, locator) {
  if (test.info().project.use.hasTouch) await locator.tap(); else await locator.click();
}
async function open(page, hash = '') {
  const errors = [];
  /* WebKit reports mocked cross-origin requests as blocked; that is the test harness, not the app. */
  page.on('pageerror', (e) => { if (!/access control checks|Load failed|Failed to fetch/i.test(e.message)) errors.push(e.message); });
  await page.route(/coingecko|open-meteo/, (r) => r.fulfill({ json: {} }));
  await page.goto('index.html?demo=1' + hash);
  await page.waitForSelector('html[data-ready="1"]');
  return errors;
}
const h1 = (page) => page.locator('#screen h1').first();
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1')));
const todayYmd = (page) => page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
async function go(page, route) { await page.evaluate((r) => { location.hash = '#/' + r; }, route); await expect(page.locator('#screen')).toHaveAttribute('data-route', route); }

async function dragTo(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox(), b = await to.boundingBox();
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2, tx = b.x + b.width / 2, ty = b.y + b.height - 10, steps = 16;
  if (test.info().project.name === 'iphone-chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + (tx - sx) * i / steps, y: sy + (ty - sy) * i / steps }] }); await page.waitForTimeout(16); }
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(sx + (tx - sx) * i / steps, sy + (ty - sy) * i / steps); await page.waitForTimeout(16); }
    await page.waitForTimeout(150); await page.mouse.up();
  }
  await page.waitForTimeout(150);
}
const grip = (page, title) => page.locator('#screen .task', { hasText: title }).locator('[data-drag]');
const dropZone = (page, id) => page.locator(`[data-sort-list="all:${id}"]`);
const listIdByName = async (page, name) => (await stored(page)).lists.find((l) => l.name === name).id;

async function newList(page, name) {
  await go(page, 'structure');
  await press(page, page.locator('[data-act=newList]'));
  await page.locator('#sheet input[name=name]').fill(name);
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(h1(page)).toHaveText(name);
}

test('Home: a tile with the count for every list, Follow-up, Delegated, Paused, Done and All; tiles open their list', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('.list-tiles .tile .l')).toHaveText(['Inbox', 'Today', 'Most important', 'Anytime', 'Someday', 'Follow-up', 'Delegated', 'Paused', 'Done', 'All']);
  const d = await stored(page);
  const open_ = d.tasks.filter((t) => !t.done);
  await expect(page.locator('.tile[data-tile="list:inbox"] .n')).toHaveText(String(open_.filter((t) => t.list === 'inbox').length));
  await expect(page.locator('.tile[data-tile="tag:followup"] .n')).toHaveText('1');
  await expect(page.locator('.tile[data-tile=all] .n')).toHaveText(String(open_.length));
  await press(page, page.locator('.tile[data-tile="list:anytime"]'));
  await expect(h1(page)).toHaveText('Anytime');
  await go(page, 'home');
  await press(page, page.locator('.tile[data-tile=all]'));
  await expect(h1(page)).toHaveText('All tasks');
  expect(errors).toEqual([]);
});

test('Lists: create one, it shows on Home, in the menu and on All tasks; drag a task into it and undo', async ({ page }) => {
  await open(page);
  await newList(page, 'Errands');
  const id = await listIdByName(page, 'Errands');
  await go(page, 'home');
  await expect(page.locator('.list-tiles .tile .l')).toHaveText(['Inbox', 'Today', 'Most important', 'Anytime', 'Someday', 'Errands', 'Follow-up', 'Delegated', 'Paused', 'Done', 'All']);
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator(`#drawer .nav-link[data-go="${id}"]`)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await go(page, 'alltasks');
  await expect(page.locator('#screen .section h2')).toContainText(['Inbox', 'Today', 'Most important & Urgent', 'Anytime', 'Someday', 'Errands']);
  await dragTo(page, grip(page, 'Renew insurance documents'), dropZone(page, id));
  await expect(page.locator(`[data-sort-list="all:${id}"] .task-title`)).toHaveText(['Renew insurance documents']);
  expect((await stored(page)).tasks.find((t) => t.id === 't5').list).toBe(id);
  await expect(page.locator('#toast')).toContainText('Moved to Errands');
  await press(page, page.locator('#toastBtn'));
  await expect(page.locator('[data-sort-list="all:inbox"] .task-title', { hasText: 'Renew insurance documents' })).toHaveCount(1);
  expect((await stored(page)).tasks.find((t) => t.id === 't5').list).toBe('inbox');
  /* the list's own page and quick add */
  await go(page, id);
  await expect(h1(page)).toHaveText('Errands');
  await page.locator('#screen .quick-add .qa-in').fill('Buy stamps');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  await expect(page.locator('#screen .task-title', { hasText: 'Buy stamps' })).toHaveCount(1);
  expect((await stored(page)).tasks.find((t) => t.title === 'Buy stamps').list).toBe(id);
  /* the task form offers the list */
  await press(page, page.locator('#screen .task-body', { hasText: 'Buy stamps' }));
  await expect(page.locator('#sheet select[name=list] option:checked')).toHaveText('Errands');
});

test('All tasks: dragging into Today, Most important and Someday changes the task accordingly', async ({ page }) => {
  await open(page, '#/alltasks');
  const t = await todayYmd(page);
  await dragTo(page, grip(page, 'Research new supplier options'), dropZone(page, 'today'));
  let task = (await stored(page)).tasks.find((x) => x.id === 't7');
  expect(task.date).toBe(t);
  await dragTo(page, grip(page, 'Pick a CRM for the sales team'), dropZone(page, 'urgent'));
  task = (await stored(page)).tasks.find((x) => x.id === 't6');
  expect(task.priority).toBe('urgent');
  expect(task.list).toBe('anytime');
  await expect(page.locator('[data-sort-list="all:urgent"] .task-title', { hasText: 'Pick a CRM' })).toHaveCount(1);
  await dragTo(page, grip(page, 'Plan weekend hike route'), dropZone(page, 'someday'));
  expect((await stored(page)).tasks.find((x) => x.id === 't8').list).toBe('someday');
  /* into Anytime: no longer today, no longer urgent */
  await dragTo(page, grip(page, 'Pick a CRM for the sales team'), dropZone(page, 'anytime'));
  task = (await stored(page)).tasks.find((x) => x.id === 't6');
  expect(task.priority).toBe('high');
  await expect(page.locator('[data-sort-list="all:anytime"] .task-title', { hasText: 'Pick a CRM' })).toHaveCount(1);
});

test('Lists: rename, sort, hide and delete', async ({ page }) => {
  await open(page, '#/structure');
  await press(page, page.locator('.sort-item[data-sort-item=anytime] [data-act=editList]'));
  await page.locator('#sheet input[name=name]').fill('Next');
  await page.locator('#sheet select[name=sort]').selectOption('title');
  await press(page, page.locator('#sheet button[type=submit]'));
  await go(page, 'anytime');
  await expect(h1(page)).toHaveText('Next');
  const titles = await page.locator('#screen .task-title').allTextContents();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  await go(page, 'home');
  await expect(page.locator('.tile[data-tile="list:anytime"] .l')).toHaveText('Next');
  /* hide Someday: gone from Home, menu and All tasks */
  await go(page, 'structure');
  await press(page, page.locator('.sort-item[data-sort-item=someday] [data-act=listVis]'));
  await go(page, 'home');
  await expect(page.locator('.tile[data-tile="list:someday"]')).toHaveCount(0);
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer .nav-link[data-go=someday]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await go(page, 'alltasks');
  await expect(page.locator('[data-sort-list="all:someday"]')).toHaveCount(0);
  await expect(page.locator('#screen .task-title', { hasText: 'Learn to sail' })).toHaveCount(1);
  /* built-in lists cannot be deleted; your own can, and their tasks go to Inbox */
  await go(page, 'structure');
  await press(page, page.locator('.sort-item[data-sort-item=inbox] [data-act=editList]'));
  await expect(page.locator('#sheet [data-act=deleteList]')).toHaveCount(0);
  await page.locator('#sheet [data-act=closeSheet]').click();
  await newList(page, 'Calls');
  const id = await listIdByName(page, 'Calls');
  await page.locator('#screen .quick-add .qa-in').fill('Call Aldo');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  page.on('dialog', (d) => d.accept());
  await press(page, page.locator('[data-act=editList]'));
  await press(page, page.locator('#sheet [data-act=deleteList]'));
  await expect(h1(page)).toHaveText('Lists, tags & layout');
  const d = await stored(page);
  expect(d.lists.some((l) => l.id === id)).toBe(false);
  expect(d.tasks.find((t) => t.title === 'Call Aldo').list).toBe('inbox');
});

test('Statuses: Not started, In progress, Done, Paused, Archive; archive hides a task; add and delete your own', async ({ page }) => {
  await open(page, '#/inbox');
  await press(page, page.locator('#screen .task-body', { hasText: 'Renew insurance documents' }));
  await expect(page.locator('#sheet select[name=status] option')).toHaveText(['Not started', 'In progress', 'Done', 'Paused', 'Archive']);
  await page.locator('#sheet select[name=status]').selectOption('archived');
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task-title', { hasText: 'Renew insurance documents' })).toHaveCount(0);
  await go(page, 'archive');
  await expect(page.locator('#screen .task-title')).toHaveText(['Renew insurance documents']);
  await go(page, 'alltasks');
  await expect(page.locator('#screen .task-title', { hasText: 'Renew insurance documents' })).toHaveCount(0);
  /* your own status */
  await go(page, 'structure');
  await press(page, page.locator('[data-act=newStatus]'));
  await page.locator('#sheet input[name=name]').fill('Waiting for payment');
  await page.locator('#sheet select[name=color]').selectOption('red');
  await press(page, page.locator('#sheet button[type=submit]'));
  await go(page, 'inbox');
  await press(page, page.locator('#screen .task-body', { hasText: 'Pick a CRM' }));
  const st = (await stored(page)).statuses.find((s) => s.name === 'Waiting for payment');
  await page.locator('#sheet select[name=status]').selectOption(st.id);
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task', { hasText: 'Pick a CRM' }).locator('.chip.tg-red')).toHaveText('Waiting for payment');
  await go(page, 'status_' + st.id);
  await expect(page.locator('#screen .task-title')).toHaveText(['Pick a CRM for the sales team']);
  /* Not started and Done can only be renamed */
  await go(page, 'structure');
  await press(page, page.locator('.sort-item[data-sort-item=todo] [data-act=editStatus]'));
  await expect(page.locator('#sheet [data-act=deleteStatus]')).toHaveCount(0);
  await page.locator('#sheet [data-act=closeSheet]').click();
  page.on('dialog', (d) => d.accept());
  await press(page, page.locator(`.sort-item[data-sort-item="${st.id}"] [data-act=editStatus]`));
  await press(page, page.locator('#sheet [data-act=deleteStatus]'));
  const d = await stored(page);
  expect(d.statuses.some((s) => s.id === st.id)).toBe(false);
  expect(d.tasks.find((t) => t.id === 't6').status).toBe('todo');
});

test('Tags: Follow-up and Delegated are tags; create a tag, put it on a task, open its list, delete it', async ({ page }) => {
  await open(page, '#/structure');
  await expect(page.locator('[data-sort-list=tags] .st-name')).toContainText(['#Follow-up', '#Delegated']);
  await press(page, page.locator('[data-act=newTag]'));
  await page.locator('#sheet input[name=name]').fill('Betterplace');
  await press(page, page.locator('#sheet button[type=submit]'));
  const g = (await stored(page)).tags.find((x) => x.name === 'Betterplace');
  await go(page, 'inbox');
  await press(page, page.locator('#screen .task-body', { hasText: 'Pick a CRM' }));
  await press(page, page.locator('#sheet .tag-chip', { hasText: 'Betterplace' }));
  await press(page, page.locator('#sheet .tag-chip', { hasText: 'Follow-up' }));
  await press(page, page.locator('#sheet button[type=submit]'));
  await expect(page.locator('#screen .task', { hasText: 'Pick a CRM' }).locator('.chip.tg')).toHaveText(['#Follow-up', '#Betterplace']);
  expect((await stored(page)).tasks.find((t) => t.id === 't6').tags).toEqual(['followup', g.id]);
  await go(page, 'followup');
  await expect(page.locator('#screen .task-title', { hasText: 'Pick a CRM' })).toHaveCount(1);
  await press(page, page.locator('#menuBtn'));
  await press(page, page.locator(`#drawer .nav-link[data-go="tag_${g.id}"]`));
  await expect(h1(page)).toHaveText('Betterplace');
  await expect(page.locator('#screen .task-title')).toHaveText(['Pick a CRM for the sales team']);
  /* new task from a tag page carries the tag */
  await page.locator('#screen .quick-add .qa-in').fill('Owner report');
  await page.locator('#screen .quick-add .qa-in').press('Enter');
  expect((await stored(page)).tasks.find((t) => t.title === 'Owner report').tags).toEqual([g.id]);
  page.on('dialog', (d) => d.accept());
  await press(page, page.locator('[data-act=editTag]'));
  await press(page, page.locator('#sheet [data-act=deleteTag]'));
  const d = await stored(page);
  expect(d.tags.some((x) => x.id === g.id)).toBe(false);
  expect(d.tasks.find((t) => t.id === 't6').tags).toEqual(['followup']);
});

test('Older data: Follow-up status and Delegated-to become tags; delegating adds the tag, removing the tag un-delegates', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('focus.data.v1'));
    delete d.tags; delete d.statuses; delete d.lists;
    d.tasks.forEach((t) => { delete t.tags; });
    d.tasks.find((t) => t.id === 't7').status = 'waiting';
    localStorage.setItem('focus.data.v1', JSON.stringify(d));
  });
  await page.goto('index.html#/followup');
  await page.waitForSelector('html[data-ready="1"]');
  await expect(page.locator('#screen .task-title', { hasText: 'Research new supplier options' })).toHaveCount(1);
  let d = await stored(page);
  const t7 = d.tasks.find((t) => t.id === 't7');
  expect(t7.status).toBe('todo');
  expect(t7.tags).toContain('followup');
  expect(d.tasks.find((t) => t.id === 't4').tags).toContain('delegated');
  /* untick Delegated in the form: the task is no longer delegated */
  await go(page, 'delegated');
  await press(page, page.locator('#screen .task-body', { hasText: 'Draft launch announcement' }));
  await press(page, page.locator('#sheet .tag-chip', { hasText: 'Delegated' }));
  await press(page, page.locator('#sheet button[type=submit]'));
  d = await stored(page);
  expect(d.tasks.find((t) => t.id === 't4').delegatedTo).toBe('');
  expect(d.tasks.find((t) => t.id === 't4').tags).not.toContain('delegated');
});

test('Layout settings: Home tiles on/off and order, menu items, start page, tags on rows', async ({ page }) => {
  await open(page, '#/structure');
  await page.locator('[data-chg=tileVis][data-id="status:paused"]').uncheck();
  await page.locator('[data-chg=tileVis][data-id=upcoming]').check();
  await page.locator('[data-chg=menuVis][data-id=kanban]').uncheck();
  await page.locator('[data-chg=setLayout][data-k=start]').selectOption('alltasks');
  await page.locator('[data-chg=setLayout][data-k=rowTags]').uncheck();
  await go(page, 'home');
  const labels = await page.locator('.list-tiles .tile .l').allTextContents();
  expect(labels).not.toContain('Paused');
  expect(labels).toContain('Upcoming');
  await press(page, page.locator('#menuBtn'));
  await expect(page.locator('#drawer .nav-link[data-go=kanban]')).toHaveCount(0);
  await expect(page.locator('#drawer .nav-link[data-go=calendar]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await go(page, 'today');
  await expect(page.locator('#screen .chip.tg', { hasText: '#Follow-up' })).toHaveCount(0);
  await page.goto('index.html');
  await page.waitForSelector('html[data-ready="1"]');
  await expect(h1(page)).toHaveText('All tasks');
  const d = await stored(page);
  expect(d.settings.start).toBe('alltasks');
  expect(d.settings.layout.menuHidden).toContain('kanban');
});
